import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalStorage } from '@/lib/storage/local';
import { NetlifyBlobStorage, onNetlify, type BlobStore } from '@/lib/storage/netlify';
import { assemble, discard, savePart, PartError } from '@/lib/parts';
import { MAX_PARTS, PART_BYTES, parseUploadRef, partsFor } from '@/lib/uploadParts';
import { schemaFor } from '../scripts/prisma-schema.mjs';
import { readiness } from '../scripts/readiness.mjs';

function fakeStore(): BlobStore & { data: Map<string, ArrayBuffer>; meta: Map<string, unknown> } {
  const data = new Map<string, ArrayBuffer>();
  const meta = new Map<string, unknown>();
  return {
    data,
    meta,
    async set(key, value, opts) {
      data.set(key, value as ArrayBuffer);
      meta.set(key, opts?.metadata);
    },
    async get(key) {
      return data.get(key) ?? null;
    },
    async delete(key) {
      data.delete(key);
    },
  };
}

describe('Netlify storage', () => {
  it('stores bytes with their content type and reads them back', async () => {
    const store = fakeStore();
    const s = new NetlifyBlobStorage(store);
    await s.putObject('campaigns/x/v1/01.png', Buffer.from([1, 2, 3]), 'image/png');
    expect(store.meta.get('campaigns/x/v1/01.png')).toEqual({ contentType: 'image/png' });
    expect(await s.getObject('campaigns/x/v1/01.png')).toEqual(Buffer.from([1, 2, 3]));
    expect(await s.getObject('missing')).toBeNull();
    await s.delete('campaigns/x/v1/01.png');
    expect(await s.getObject('campaigns/x/v1/01.png')).toBeNull();
  });
  it('serves through the files route, like local storage', () => {
    expect(new NetlifyBlobStorage(fakeStore()).getUrl('campaigns/a b/v1/01.png')).toBe('/files/campaigns/a%20b/v1/01.png');
  });
  it('knows when it runs on Netlify', () => {
    expect(onNetlify({})).toBe(false);
    expect(onNetlify({ NETLIFY: 'true' })).toBe(true);
    expect(onNetlify({ NETLIFY_BLOBS_CONTEXT: 'x' })).toBe(true);
  });
});

describe('uploads in parts', () => {
  const ID = 'a'.repeat(32);
  async function tmpStorage() {
    return new LocalStorage(await fs.mkdtemp(path.join(os.tmpdir(), 'bank-parts-')));
  }
  it('puts the parts back together in order and removes them', async () => {
    const storage = await tmpStorage();
    await savePart({ id: ID, index: 1, parts: 2, body: Buffer.from('world') }, storage);
    await savePart({ id: ID, index: 0, parts: 2, body: Buffer.from('hello ') }, storage);
    const whole = await assemble({ upload: ID, name: 'a.png', type: 'image/png', size: 11, parts: 2 }, storage);
    expect(whole.toString()).toBe('hello world');
    expect(await storage.getObject(`tmp/uploads/${ID}/00`)).toBeNull();
  });
  it('refuses a file that did not arrive whole, and cleans up', async () => {
    const storage = await tmpStorage();
    await savePart({ id: ID, index: 0, parts: 2, body: Buffer.from('hello ') }, storage);
    await expect(assemble({ upload: ID, name: 'a.png', type: 'image/png', size: 11, parts: 2 }, storage)).rejects.toThrow(/did not arrive whole/);
    expect(await storage.getObject(`tmp/uploads/${ID}/00`)).toBeNull();
    await savePart({ id: ID, index: 0, parts: 1, body: Buffer.from('short') }, storage);
    await expect(assemble({ upload: ID, name: 'a.png', type: 'image/png', size: 99, parts: 1 }, storage)).rejects.toBeInstanceOf(PartError);
    await discard({ upload: ID, parts: 1 }, storage);
  });
  it('checks every number before touching storage', async () => {
    const storage = await tmpStorage();
    await expect(savePart({ id: 'nope', index: 0, parts: 1, body: Buffer.from('x') }, storage)).rejects.toBeInstanceOf(PartError);
    await expect(savePart({ id: ID, index: 2, parts: 2, body: Buffer.from('x') }, storage)).rejects.toBeInstanceOf(PartError);
    await expect(savePart({ id: ID, index: 0, parts: MAX_PARTS + 1, body: Buffer.from('x') }, storage)).rejects.toThrow(/too large/);
    await expect(savePart({ id: ID, index: 0, parts: 1, body: Buffer.alloc(PART_BYTES + 1) }, storage)).rejects.toBeInstanceOf(PartError);
  });
  it('reads the reference the form carries and rejects tampered ones', () => {
    const ok = { upload: ID, name: 'a.png', type: 'image/png', size: 5_000_000, parts: 2 };
    expect(parseUploadRef(JSON.stringify(ok))).toEqual(ok);
    expect(parseUploadRef('not json')).toBeNull();
    expect(parseUploadRef(JSON.stringify({ ...ok, upload: '../x' }))).toBeNull();
    expect(parseUploadRef(JSON.stringify({ ...ok, parts: 0 }))).toBeNull();
    expect(parseUploadRef(JSON.stringify({ ...ok, size: 3 * PART_BYTES }))).toBeNull();
    expect(partsFor(1)).toBe(1);
    expect(partsFor(PART_BYTES)).toBe(1);
    expect(partsFor(PART_BYTES + 1)).toBe(2);
    expect(partsFor(25 * 1024 * 1024)).toBeLessThanOrEqual(MAX_PARTS);
  });
});

describe('hosting scripts', () => {
  it('picks the Postgres schema from the database address', () => {
    expect(schemaFor('file:./dev.db')).toBe('prisma/schema.prisma');
    expect(schemaFor('postgresql://u:p@host/db')).toBe('prisma/schema.postgres.prisma');
    expect(schemaFor('postgres://u:p@host/db')).toBe('prisma/schema.postgres.prisma');
    expect(schemaFor('')).toBe('prisma/schema.prisma');
  });
  it('refuses to deploy with the example secrets or a file database', () => {
    const example = 'SESSION_SECRET="example-secret-example-secret-example"\nADMIN_PASSWORD="example"\nCRON_SECRET="example-cron"\n';
    const good = { DATABASE_URL: 'postgresql://u:p@host/db', SESSION_SECRET: 'x'.repeat(40), CRON_SECRET: 'y'.repeat(20), ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'a long real password' };
    expect(readiness(good, example)).toEqual([]);
    expect(readiness({ ...good, DATABASE_URL: 'file:./dev.db' }, example).join(' ')).toMatch(/DATABASE_URL/);
    expect(readiness({ ...good, SESSION_SECRET: 'example-secret-example-secret-example' }, example).join(' ')).toMatch(/SESSION_SECRET/);
    expect(readiness({ ...good, SESSION_SECRET: 'short' }, example).join(' ')).toMatch(/SESSION_SECRET/);
    expect(readiness({ ...good, ADMIN_PASSWORD: 'example' }, example).join(' ')).toMatch(/ADMIN_PASSWORD/);
    expect(readiness({ ...good, CRON_SECRET: '' }, example).join(' ')).toMatch(/CRON_SECRET/);
    expect(readiness({ ...good, ADMIN_EMAIL: '' }, example).join(' ')).toMatch(/ADMIN_EMAIL/);
  });
});

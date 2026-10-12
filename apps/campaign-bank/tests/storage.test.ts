import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { S3Storage } from '@/lib/storage/s3';
import { LocalStorage } from '@/lib/storage/local';
import { contentTypeFor } from '@/lib/storage/types';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';

function mockClient() {
  const sent: unknown[] = [];
  const client = {
    send: vi.fn(async (cmd: unknown) => {
      sent.push(cmd);
      if (cmd instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
      return {};
    }),
  } as unknown as S3Client;
  return { client, sent };
}

describe('S3Storage', () => {
  it('puts objects with content type and long cache headers', async () => {
    const { client, sent } = mockClient();
    const s = new S3Storage({ bucket: 'b', region: 'us-east-1', client });
    await s.putObject('campaigns/x/v1/01.png', Buffer.from('hi'), 'image/png');
    const cmd = sent[0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: 'b', Key: 'campaigns/x/v1/01.png', ContentType: 'image/png' });
    expect(cmd.input.CacheControl).toContain('immutable');
  });

  it('deletes objects', async () => {
    const { client, sent } = mockClient();
    const s = new S3Storage({ bucket: 'b', region: 'us-east-1', client });
    await s.delete('k');
    expect(sent[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((sent[0] as DeleteObjectCommand).input).toMatchObject({ Bucket: 'b', Key: 'k' });
  });

  it('reads objects back as a Buffer', async () => {
    const { client } = mockClient();
    const s = new S3Storage({ bucket: 'b', region: 'us-east-1', client });
    const buf = await s.getObject('k');
    expect(buf).toEqual(Buffer.from([1, 2, 3]));
  });

  it('builds public URLs from S3_PUBLIC_URL or the bucket', () => {
    const { client } = mockClient();
    expect(new S3Storage({ bucket: 'b', region: 'eu-west-1', client }).getUrl('a/b.png')).toBe('https://b.s3.eu-west-1.amazonaws.com/a/b.png');
    expect(new S3Storage({ bucket: 'b', region: 'eu-west-1', publicUrl: 'https://cdn.example.com/', client }).getUrl('a/b.png')).toBe('https://cdn.example.com/a/b.png');
  });
});

describe('LocalStorage', () => {
  it('round trips a file and refuses paths outside the root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-storage-'));
    const s = new LocalStorage(root);
    await s.putObject('a/b/c.txt', Buffer.from('hello'), 'text/plain');
    expect((await s.getObject('a/b/c.txt'))?.toString()).toBe('hello');
    expect(s.getUrl('a/b c.txt')).toBe('/files/a/b%20c.txt');
    await expect(s.putObject('../escape.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow();
    await s.delete('a/b/c.txt');
    expect(await s.getObject('a/b/c.txt')).toBeNull();
    await fs.rm(root, { recursive: true, force: true });
  });
});

describe('contentTypeFor', () => {
  it('maps extensions', () => {
    expect(contentTypeFor('x.PNG')).toBe('image/png');
    expect(contentTypeFor('x.jpg')).toBe('image/jpeg');
    expect(contentTypeFor('x.pdf')).toBe('application/pdf');
    expect(contentTypeFor('x.bin')).toBe('application/octet-stream');
  });
});

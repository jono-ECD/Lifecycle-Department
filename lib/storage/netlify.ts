import { getStore } from '@netlify/blobs';
import type { Storage } from './types';

/** The part of a Netlify Blobs store this adapter uses. Tests pass their own. */
export interface BlobStore {
  set(key: string, data: ArrayBuffer | Blob | string, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  get(key: string, opts: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

/**
 * Netlify Blobs, for hosts with no disk. Needs no keys on Netlify: the site supplies them.
 * Files are served by app/files/[...key]/route.ts, the same as local storage.
 * Reads are strongly consistent, so a file is there as soon as the upload returns.
 */
export class NetlifyBlobStorage implements Storage {
  private store: BlobStore | null;

  constructor(
    store?: BlobStore,
    private name = 'campaign-bank',
  ) {
    this.store = store ?? null;
  }

  // opened on first use: the site context only exists inside a request
  private open(): BlobStore {
    if (!this.store) this.store = getStore({ name: this.name, consistency: 'strong' }) as unknown as BlobStore;
    return this.store;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const bytes = new Uint8Array(body).buffer as ArrayBuffer;
    await this.open().set(key, bytes, { metadata: { contentType } });
  }

  async getObject(key: string): Promise<Buffer | null> {
    const data = await this.open().get(key, { type: 'arrayBuffer' });
    return data ? Buffer.from(data) : null;
  }

  getUrl(key: string): string {
    return `/files/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async delete(key: string): Promise<void> {
    await this.open().delete(key);
  }
}

/** True inside a Netlify build or function. */
export function onNetlify(e: Record<string, string | undefined> = process.env): boolean {
  return e.NETLIFY === 'true' || !!e.NETLIFY_BLOBS_CONTEXT || !!e.DEPLOY_ID || typeof (globalThis as { Netlify?: unknown }).Netlify !== 'undefined';
}

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Storage } from './types';

export interface S3Options {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  client?: S3Client;
}

/** S3 compatible storage (AWS S3, Cloudflare R2, MinIO). Objects are public read; set S3_PUBLIC_URL to the bucket's public base. */
export class S3Storage implements Storage {
  private client: S3Client;

  constructor(private opts: S3Options) {
    this.client =
      opts.client ??
      new S3Client({
        region: opts.region,
        endpoint: opts.endpoint || undefined,
        forcePathStyle: !!opts.endpoint,
        credentials: opts.accessKeyId && opts.secretAccessKey ? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } : undefined,
      });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }),
    );
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  getUrl(key: string): string {
    const base = this.opts.publicUrl?.replace(/\/$/, '') || `https://${this.opts.bucket}.s3.${this.opts.region}.amazonaws.com`;
    return `${base}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
}

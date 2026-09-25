import path from 'node:path';
import { env } from '@/lib/env';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { Storage } from './types';

export type { Storage } from './types';
export { contentTypeFor } from './types';

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (instance) return instance;
  if (env('STORAGE_DRIVER', 'local') === 's3') {
    instance = new S3Storage({
      bucket: env('S3_BUCKET'),
      region: env('S3_REGION', 'us-east-1'),
      endpoint: env('S3_ENDPOINT') || undefined,
      accessKeyId: env('S3_ACCESS_KEY_ID') || undefined,
      secretAccessKey: env('S3_SECRET_ACCESS_KEY') || undefined,
      publicUrl: env('S3_PUBLIC_URL') || undefined,
    });
  } else {
    instance = new LocalStorage(path.resolve(process.cwd(), env('STORAGE_DIR', './storage')));
  }
  return instance;
}

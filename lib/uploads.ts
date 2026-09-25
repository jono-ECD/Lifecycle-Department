import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { getStorage } from '@/lib/storage';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_PDF_BYTES, PDF_TYPE, extFor, pdfThumbnail, processImage } from '@/lib/images';

export interface IncomingFile {
  name: string;
  type: string;
  buffer: Buffer;
}

export class UploadError extends Error {}

export function validateFile(f: { name: string; type: string; size: number }): void {
  if (IMAGE_TYPES.includes(f.type)) {
    if (f.size > MAX_IMAGE_BYTES) throw new UploadError(`${f.name} is over 15 MB.`);
    return;
  }
  if (f.type === PDF_TYPE) {
    if (f.size > MAX_PDF_BYTES) throw new UploadError(`${f.name} is over 25 MB.`);
    return;
  }
  throw new UploadError(`${f.name} is not a PNG, JPG, WEBP or PDF.`);
}

/**
 * Stores a full set of files as one version of a campaign. Order of `files` is the order in the drawer.
 * Old versions are kept in storage and in the database so the thread can still link to them.
 */
export async function storeVersion(campaignId: string, version: number, files: IncomingFile[], uploadedBy: string) {
  const storage = getStorage();
  const created = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    validateFile({ name: f.name, type: f.type, size: f.buffer.length });
    const isPdf = f.type === PDF_TYPE;
    const ext = extFor(f.type, f.name);
    const base = `campaigns/${campaignId}/v${version}/${String(i + 1).padStart(2, '0')}-${randomBytes(4).toString('hex')}`;
    const key = `${base}.${ext}`;
    await storage.putObject(key, f.buffer, f.type);

    const processed = isPdf ? await pdfThumbnail(f.buffer) : await processImage(f.buffer);
    let thumbPath: string | null = null;
    if (processed?.thumb) {
      thumbPath = `${base}-thumb.jpg`;
      await storage.putObject(thumbPath, processed.thumb, 'image/jpeg');
    }
    created.push(
      await db.campaignAsset.create({
        data: {
          campaignId,
          version,
          kind: isPdf ? 'pdf' : 'image',
          path: key,
          thumbPath,
          width: processed?.width ?? null,
          height: processed?.height ?? null,
          orderIndex: i,
          originalName: f.name,
          size: f.buffer.length,
          uploadedBy,
        },
      }),
    );
  }
  return created;
}

export function assetUrl(path: string | null | undefined): string | null {
  return path ? getStorage().getUrl(path) : null;
}

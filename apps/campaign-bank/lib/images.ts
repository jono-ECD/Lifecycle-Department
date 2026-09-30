import sharp from 'sharp';

export const THUMB_WIDTH = 480;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const PDF_TYPE = 'application/pdf';
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export interface Processed {
  width: number | null;
  height: number | null;
  thumb: Buffer | null;
}

/** Reads dimensions and makes a 480px wide JPEG thumbnail for the gallery. */
export async function processImage(buf: Buffer): Promise<Processed> {
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const thumb = await sharp(buf, { failOn: 'none' }).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return { width: meta.width ?? null, height: meta.height ?? null, thumb };
}

/** Tries to rasterize page 1 of a PDF. Returns null when that is not possible; the UI then shows a generic PDF card. */
export async function pdfThumbnail(buf: Buffer): Promise<Processed | null> {
  try {
    const mod = (await import('pdf-to-img')) as { pdf: (data: Buffer, opts?: { scale?: number }) => Promise<AsyncIterable<Buffer>> };
    const doc = await mod.pdf(buf, { scale: 1.5 });
    for await (const page of doc) {
      return processImage(page);
    }
    return null;
  } catch (err) {
    console.warn('[images] PDF thumbnail failed, using generic card:', (err as Error).message);
    return null;
  }
}

export function extFor(contentType: string, name: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === PDF_TYPE) return 'pdf';
  return (name.split('.').pop() || 'bin').toLowerCase();
}

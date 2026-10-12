import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processImage, pdfThumbnail, THUMB_WIDTH } from '@/lib/images';
import { validateFile, UploadError } from '@/lib/uploads';

describe('processImage', () => {
  it('reads dimensions and makes a 480px thumbnail', async () => {
    const src = await sharp({ create: { width: 1200, height: 2000, channels: 3, background: '#ccc' } }).png().toBuffer();
    const out = await processImage(src);
    expect(out.width).toBe(1200);
    expect(out.height).toBe(2000);
    const meta = await sharp(out.thumb!).metadata();
    expect(meta.width).toBe(THUMB_WIDTH);
    expect(meta.format).toBe('jpeg');
  });

  it('does not enlarge small images', async () => {
    const src = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#ccc' } }).png().toBuffer();
    const out = await processImage(src);
    expect((await sharp(out.thumb!).metadata()).width).toBe(200);
  });
});

describe('pdfThumbnail', () => {
  it('returns null for a broken PDF instead of throwing', async () => {
    expect(await pdfThumbnail(Buffer.from('not a pdf'))).toBeNull();
  });
});

describe('validateFile', () => {
  it('accepts images up to 15 MB and PDFs up to 25 MB', () => {
    expect(() => validateFile({ name: 'a.png', type: 'image/png', size: 15 * 1024 * 1024 })).not.toThrow();
    expect(() => validateFile({ name: 'a.pdf', type: 'application/pdf', size: 25 * 1024 * 1024 })).not.toThrow();
  });
  it('rejects oversized and unknown files', () => {
    expect(() => validateFile({ name: 'a.png', type: 'image/png', size: 15 * 1024 * 1024 + 1 })).toThrow(UploadError);
    expect(() => validateFile({ name: 'a.pdf', type: 'application/pdf', size: 25 * 1024 * 1024 + 1 })).toThrow(UploadError);
    expect(() => validateFile({ name: 'a.gif', type: 'image/gif', size: 10 })).toThrow(UploadError);
  });
});

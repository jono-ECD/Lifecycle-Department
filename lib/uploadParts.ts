// Large files travel in parts. Shared by the browser and the server, so no server imports here.
// Hosts that run on functions refuse requests over about 4.5 MB, and a design at 2x is often bigger.

/** Size of one part. */
export const PART_BYTES = 3 * 1024 * 1024;
/** Forms whose files add up to less than this go in one request, as before. */
export const DIRECT_LIMIT = 3.5 * 1024 * 1024;
/** 25 MB, the largest file accepted, is 9 parts. */
export const MAX_PARTS = 10;

export const UPLOAD_ID = /^[a-f0-9]{32}$/;

/** What the form carries in place of a file that was sent in parts. */
export interface UploadRef {
  upload: string;
  name: string;
  type: string;
  size: number;
  parts: number;
}

export function parseUploadRef(value: string): UploadRef | null {
  try {
    const r = JSON.parse(value) as Partial<UploadRef>;
    if (typeof r.upload !== 'string' || !UPLOAD_ID.test(r.upload)) return null;
    if (typeof r.name !== 'string' || !r.name || r.name.length > 300) return null;
    if (typeof r.type !== 'string' || typeof r.size !== 'number' || typeof r.parts !== 'number') return null;
    if (!Number.isInteger(r.parts) || r.parts < 1 || r.parts > MAX_PARTS) return null;
    if (!Number.isInteger(r.size) || r.size < 1 || r.size > r.parts * PART_BYTES) return null;
    return { upload: r.upload, name: r.name, type: r.type, size: r.size, parts: r.parts };
  } catch {
    return null;
  }
}

export const partsFor = (size: number) => Math.max(1, Math.ceil(size / PART_BYTES));

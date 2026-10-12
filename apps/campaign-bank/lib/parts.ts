// Server side of uploads in parts: each part is kept in storage until the form that names it arrives.
import { getStorage, type Storage } from '@/lib/storage';
import { UserError } from '@/lib/errors';
import { MAX_PARTS, PART_BYTES, UPLOAD_ID, type UploadRef } from '@/lib/uploadParts';

export class PartError extends UserError {}

/** Not served by the files route. */
export const PARTS_PREFIX = 'tmp/uploads/';

const partKey = (id: string, index: number) => `${PARTS_PREFIX}${id}/${String(index).padStart(2, '0')}`;

export async function savePart(input: { id: string; index: number; parts: number; body: Buffer }, storage: Storage = getStorage()): Promise<void> {
  if (!UPLOAD_ID.test(input.id)) throw new PartError('That upload is not valid. Try again.');
  if (!Number.isInteger(input.parts) || input.parts < 1 || input.parts > MAX_PARTS) throw new PartError('That file is too large.');
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= input.parts) throw new PartError('That upload is not valid. Try again.');
  if (input.body.length === 0 || input.body.length > PART_BYTES) throw new PartError('That upload is not valid. Try again.');
  await storage.putObject(partKey(input.id, input.index), input.body, 'application/octet-stream');
}

/** Puts the parts back together, checks the size, and removes them. */
export async function assemble(ref: UploadRef, storage: Storage = getStorage()): Promise<Buffer> {
  const bufs: Buffer[] = [];
  try {
    for (let i = 0; i < ref.parts; i++) {
      const b = await storage.getObject(partKey(ref.upload, i));
      if (!b) throw new PartError(`${ref.name} did not arrive whole. Upload it again.`);
      bufs.push(b);
    }
    const whole = Buffer.concat(bufs);
    if (whole.length !== ref.size) throw new PartError(`${ref.name} did not arrive whole. Upload it again.`);
    return whole;
  } finally {
    await discard(ref, storage);
  }
}

export async function discard(ref: Pick<UploadRef, 'upload' | 'parts'>, storage: Storage = getStorage()): Promise<void> {
  for (let i = 0; i < ref.parts; i++) await storage.delete(partKey(ref.upload, i)).catch(() => {});
}

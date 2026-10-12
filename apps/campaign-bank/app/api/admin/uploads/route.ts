import { ApiError, handler, json, requireAdminActor } from '@/lib/api';
import { savePart } from '@/lib/parts';
import { PART_BYTES } from '@/lib/uploadParts';

// One part of a large file. The form that follows names the upload and the file is put back together there.
export const POST = handler(async (req) => {
  await requireAdminActor();
  const form = await req.formData();
  const part = form.get('part');
  if (!(part instanceof File) || part.size === 0) throw new ApiError(400, 'That upload is not valid. Try again.');
  if (part.size > PART_BYTES) throw new ApiError(400, 'That upload is not valid. Try again.');
  await savePart({ id: String(form.get('id') ?? ''), index: Number(form.get('index')), parts: Number(form.get('parts')), body: Buffer.from(await part.arrayBuffer()) });
  return json({ ok: true });
});

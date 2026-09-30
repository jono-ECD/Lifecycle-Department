import sharp from 'sharp';
import { db } from '@/lib/db';
import { ApiError, handler, json, requireAdminActor } from '@/lib/api';
import { getStorage } from '@/lib/storage';
import { IMAGE_TYPES } from '@/lib/images';

type Ctx = { params: Promise<{ id: string }> };

// Upload the workspace mark shown in the bank header. Resized to 160px tall PNG.
export const POST = handler(async (req, ctx: Ctx) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const ws = await db.workspace.findUnique({ where: { id } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const form = await req.formData();
  const file = form.get('logo');
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, 'Choose an image.');
  if (!IMAGE_TYPES.includes(file.type)) throw new ApiError(400, 'The logo must be a PNG, JPG or WEBP.');
  // under the request limit of hosts that run on functions
  if (file.size > 4 * 1024 * 1024) throw new ApiError(400, 'The logo must be under 4 MB.');
  const png = await sharp(Buffer.from(await file.arrayBuffer())).resize({ height: 160, withoutEnlargement: true }).png().toBuffer();
  const key = `workspaces/${ws.slug}/mark-${Date.now()}.png`;
  await getStorage().putObject(key, png, 'image/png');
  if (ws.logoPath) await getStorage().delete(ws.logoPath).catch(() => {});
  await db.workspace.update({ where: { id }, data: { logoPath: key } });
  return json({ url: getStorage().getUrl(key) });
});

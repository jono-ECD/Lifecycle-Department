import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { slugify } from '@/lib/admin';
import { WorkspaceFields } from '@/lib/workspaces';

export const POST = handler(async (req) => {
  await requireAdminActor();
  const input = await parseBody(req, WorkspaceFields);
  const slug = slugify(input.slug || input.name) || 'workspace';
  if (await db.workspace.findUnique({ where: { slug } })) throw new ApiError(400, 'That slug is taken.');
  const ws = await db.workspace.create({
    data: { name: input.name, slug, timezone: input.timezone, windowDays: input.windowDays, maxPerDay: input.maxPerDay, brandColor: input.brandColor || null },
  });
  return json({ id: ws.id, slug: ws.slug });
});

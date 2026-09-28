import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireFullAdminActor } from '@/lib/api';
import { slugify } from '@/lib/admin';
import { WorkspaceFields } from '@/lib/workspaces';

// Adding the next client is config, not code.
export const POST = handler(async (req) => {
  await requireFullAdminActor();
  const input = await parseBody(req, WorkspaceFields);
  const slug = slugify(input.slug || input.name) || 'workspace';
  if (await db.workspace.findUnique({ where: { slug } })) throw new ApiError(400, 'That slug is taken.');
  const ws = await db.workspace.create({
    data: { name: input.name, slug, timezone: input.timezone, windowDays: input.windowDays, maxPerDay: input.maxPerDay, brandColor: input.brandColor || null, clientSeesDrafts: input.clientSeesDrafts, slotMode: input.slotMode },
  });
  return json({ id: ws.id, slug: ws.slug });
});

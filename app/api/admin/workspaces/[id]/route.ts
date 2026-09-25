import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { slugify } from '@/lib/admin';
import { WorkspaceFields } from '@/lib/workspaces';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req, ctx: Ctx) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const input = await parseBody(req, WorkspaceFields);
  const ws = await db.workspace.findUnique({ where: { id } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const slug = input.slug ? slugify(input.slug) : ws.slug;
  if (slug !== ws.slug && (await db.workspace.findUnique({ where: { slug } }))) throw new ApiError(400, 'That slug is taken.');
  const updated = await db.workspace.update({
    where: { id },
    data: { name: input.name, slug, timezone: input.timezone, windowDays: input.windowDays, maxPerDay: input.maxPerDay, brandColor: input.brandColor || null },
  });
  return json({ id: updated.id, slug: updated.slug });
});

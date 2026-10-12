import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { addVersion, filesFrom } from '@/lib/admin';

type Ctx = { params: Promise<{ id: string }> };

// Upload a new version: replaces the visible set, increments the version, records it in the thread.
// An approval covers one version, so a new one sends approved work back to review.
export const POST = handler(async (req, ctx: Ctx) => {
  const actor = await requireAdminActor();
  const { id } = await ctx.params;
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  const form = await req.formData();
  const files = await filesFrom(form);
  const r = await addVersion(id, { files }, actor);
  return json({ version: r.version, count: r.count, reopened: r.reopened });
});

const Order = z.object({ order: z.array(z.string().min(1)).min(1) });

// Reorder the current version's files.
export const PATCH = handler(async (req, ctx: Ctx) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const { order } = await parseBody(req, Order);
  const c = await db.campaign.findUnique({ where: { id }, include: { assets: true } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  const current = c.assets.filter((a) => a.version === c.currentVersion);
  const ids = new Set(current.map((a) => a.id));
  if (order.length !== current.length || !order.every((x) => ids.has(x))) throw new ApiError(400, 'Order does not match the current files.');
  await db.$transaction(order.map((assetId, i) => db.campaignAsset.update({ where: { id: assetId }, data: { orderIndex: i } })));
  return json({ ok: true });
});

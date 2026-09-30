import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';

const Body = z.object({ campaignId: z.string().min(1).nullable() });

// Link a Klaviyo campaign to a campaign in the bank by hand, or unlink it. Manual links survive syncs.
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const { campaignId } = await parseBody(req, Body);
  const row = await db.klaviyoCampaign.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, 'That sent email is not here.');
  if (campaignId) {
    const c = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!c || c.workspaceId !== row.workspaceId) throw new ApiError(400, 'Pick a campaign from this workspace.');
  }
  await db.klaviyoCampaign.update({ where: { id }, data: { campaignId, linkedBy: 'manual' } });
  return json({ ok: true });
});

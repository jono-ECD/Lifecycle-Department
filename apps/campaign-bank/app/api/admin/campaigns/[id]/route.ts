import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor, requireFullAdminActor } from '@/lib/api';
import { CampaignFields, addVersion, applyAdminStatus, campaignData, deleteCampaign } from '@/lib/admin';

type Ctx = { params: Promise<{ id: string }> };

// Edit metadata and, when changed, the status. New SMS copy becomes the next version.
export const PATCH = handler(async (req, ctx: Ctx) => {
  const actor = await requireAdminActor();
  const { id } = await ctx.params;
  const input = await parseBody(req, CampaignFields);
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  const data = campaignData(input);
  if (data.asanaTaskGid && (await db.campaign.findFirst({ where: { workspaceId: c.workspaceId, asanaTaskGid: data.asanaTaskGid, id: { not: id } } }))) throw new ApiError(400, 'Another campaign is already linked to that Asana task.');
  await db.campaign.update({ where: { id }, data });
  let reopened = false;
  if (input.channel === 'sms' && input.smsBody) reopened = (await addVersion(id, { smsText: input.smsBody }, actor, { skipUnchanged: true })).reopened;
  // a new version already decided the status; the form still holds the old one
  if (!reopened) await applyAdminStatus(id, actor, input.status, input.scheduledDate || undefined);
  return json({ ok: true, reopened });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  await requireFullAdminActor();
  const { id } = await ctx.params;
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  await deleteCampaign(id);
  return json({ ok: true });
});

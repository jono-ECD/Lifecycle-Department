import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { ymdToDate } from '@/lib/dates';
import { CampaignFields, applyAdminStatus, deleteCampaign } from '@/lib/admin';
import { parseFigmaUrl } from '@/lib/integrations/figma';

type Ctx = { params: Promise<{ id: string }> };

// Edit metadata and, when changed, the status.
export const PATCH = handler(async (req, ctx: Ctx) => {
  const actor = await requireAdminActor();
  const { id } = await ctx.params;
  const input = await parseBody(req, CampaignFields);
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  await db.campaign.update({
    where: { id },
    data: {
      name: input.name,
      subtitle: input.subtitle,
      type: input.type,
      builtDate: ymdToDate(input.builtDate),
      figmaUrl: input.figmaUrl || null,
      figmaNodeId: input.figmaUrl ? (parseFigmaUrl(input.figmaUrl)?.nodeId ?? null) : null,
    },
  });
  await applyAdminStatus(id, actor, input.status, input.scheduledDate || undefined);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  await deleteCampaign(id);
  return json({ ok: true });
});

import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseWith, requireAdminActor } from '@/lib/api';
import { ymdToDate } from '@/lib/dates';
import { CampaignFields, addVersion, applyAdminStatus, filesFrom } from '@/lib/admin';
import { parseFigmaUrl } from '@/lib/integrations/figma';

const Body = CampaignFields.extend({ workspaceId: z.string().min(1) });

// Create a campaign. Multipart: fields plus files[] in display order.
export const POST = handler(async (req) => {
  const actor = await requireAdminActor();
  const form = await req.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v;
  const input = parseWith(Body, raw);
  const ws = await db.workspace.findUnique({ where: { id: input.workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const files = await filesFrom(form);
  const last = await db.campaign.aggregate({ where: { workspaceId: ws.id }, _max: { position: true } });
  const c = await db.campaign.create({
    data: {
      workspaceId: ws.id,
      name: input.name,
      subtitle: input.subtitle,
      type: input.type,
      status: 'draft',
      builtDate: ymdToDate(input.builtDate),
      position: (last._max.position ?? 0) + 1,
      createdBy: actor.name,
      figmaUrl: input.figmaUrl || null,
      figmaNodeId: input.figmaUrl ? (parseFigmaUrl(input.figmaUrl)?.nodeId ?? null) : null,
    },
  });
  if (files.length) await addVersion(c.id, files, actor);
  if (input.status !== 'draft') await applyAdminStatus(c.id, actor, input.status, input.scheduledDate || undefined);
  return json({ id: c.id });
});

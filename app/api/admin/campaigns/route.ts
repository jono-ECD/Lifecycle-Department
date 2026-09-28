import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseWith, requireAdminActor } from '@/lib/api';
import { CampaignFields, addVersion, applyAdminStatus, campaignData, filesFrom } from '@/lib/admin';

const Body = CampaignFields.and(z.object({ workspaceId: z.string().min(1) }));

// Create a campaign. Multipart: fields plus files[] in display order, or the SMS copy.
export const POST = handler(async (req) => {
  const actor = await requireAdminActor();
  const form = await req.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v;
  const input = parseWith(Body, raw);
  const ws = await db.workspace.findUnique({ where: { id: input.workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const data = campaignData(input);
  if (data.asanaTaskGid && (await db.campaign.findFirst({ where: { workspaceId: ws.id, asanaTaskGid: data.asanaTaskGid } }))) throw new ApiError(400, 'Another campaign is already linked to that Asana task.');
  const files = input.channel === 'sms' ? [] : await filesFrom(form);
  const last = await db.campaign.aggregate({ where: { workspaceId: ws.id }, _max: { position: true } });
  const c = await db.campaign.create({ data: { workspaceId: ws.id, status: 'draft', position: (last._max.position ?? 0) + 1, createdBy: actor.name, ...data } });
  if (input.channel === 'sms' && input.smsBody) await addVersion(c.id, { smsText: input.smsBody }, actor);
  else if (files.length) await addVersion(c.id, { files }, actor);
  if (input.status !== 'draft') await applyAdminStatus(c.id, actor, input.status, input.scheduledDate || undefined);
  return json({ id: c.id });
});

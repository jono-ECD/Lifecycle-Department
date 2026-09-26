// Runs a status action on a campaign: validates, updates, writes the thread entry, triggers notifications.
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { actorCanAccess, type Actor } from '@/lib/auth';
import { applyAction, threadLineFor, toastFor, type Action } from '@/lib/transitions';
import { checkSlot } from '@/lib/slots';
import { dateToYmd, isYmd, todayYmd, ymdToDate } from '@/lib/dates';
import { isStatus } from '@/lib/status';
import { notifyStatusChange } from '@/lib/notify';
import { getSendProvider } from '@/lib/sendProvider';
import { emit } from '@/lib/integrations/dispatch';
import { payloadFor } from '@/lib/integrations/payload';
import type { IntegrationEventType } from '@/lib/integrations/types';

export interface ActionInput {
  action: Action;
  note?: string;
  date?: string;
}

export async function performAction(campaignId: string, actor: Actor, input: ActionInput) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, include: { workspace: true } });
  if (!campaign || !actorCanAccess(actor, campaign.workspaceId)) throw new ApiError(404, 'That campaign is not here.');
  if (!isStatus(campaign.status)) throw new ApiError(500, 'Unknown status.');

  const note = (input.note ?? '').trim();
  const result = applyAction(campaign.status, input.action, actor.role, note);
  if (!result.ok) throw new ApiError(400, result.reason);
  const { def, to } = result;

  let date: string | undefined;
  if (def.needsDate) {
    if (!input.date || !isYmd(input.date)) throw new ApiError(400, 'Pick an open slot.');
    date = input.date;
    const ws = campaign.workspace;
    const today = todayYmd(ws.timezone);
    const [others, blocks] = await Promise.all([
      db.campaign.findMany({ where: { workspaceId: ws.id, status: 'scheduled', id: { not: campaign.id }, scheduledDate: { not: null } }, select: { scheduledDate: true } }),
      db.calendarBlock.findMany({ where: { workspaceId: ws.id }, select: { date: true } }),
    ]);
    const counts: Record<string, number> = {};
    for (const o of others) {
      const k = dateToYmd(o.scheduledDate!);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const check = checkSlot({ today, windowDays: ws.windowDays, maxPerDay: ws.maxPerDay, counts, blocked: blocks.map((b) => dateToYmd(b.date)), role: actor.role }, date);
    if (!check.ok) throw new ApiError(400, check.reason);
  }

  const now = new Date();
  const data: Parameters<typeof db.campaign.update>[0]['data'] = { status: to, lastActivityAt: now };
  if (to === 'scheduled') data.scheduledDate = ymdToDate(date!);
  else if (campaign.scheduledDate) data.scheduledDate = null;
  if (to === 'sent') data.sentDate = now;
  else if (campaign.sentDate) data.sentDate = null;
  if (to === 'review' && campaign.status !== 'review') {
    data.reviewEnteredAt = now;
    data.reviewNotifiedAt = null;
  }

  const [, entry] = await db.$transaction([
    db.campaign.update({ where: { id: campaign.id }, data }),
    db.comment.create({
      data: {
        campaignId: campaign.id,
        authorKind: actor.role,
        authorName: actor.name,
        authorId: actor.id,
        body: note || threadLineFor(input.action, date),
        kind: 'status',
        fromStatus: campaign.status,
        toStatus: to,
      },
    }),
  ]);

  if (to === 'sent') {
    await getSendProvider().onMarkedSent({
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      name: campaign.name,
      scheduledDate: campaign.scheduledDate ? dateToYmd(campaign.scheduledDate) : null,
      actorName: actor.name,
    });
  }

  await notifyStatusChange({ campaignId: campaign.id, workspaceId: campaign.workspaceId, actor, action: input.action, from: campaign.status, to, note, date });

  const eventType = EVENT_FOR_ACTION[input.action];
  const payload = await payloadFor(campaign.id, actor, eventType, { text: note || undefined, commentId: entry.id, date });
  if (payload) await emit(payload);

  return { toast: toastFor(input.action, date), workspaceId: campaign.workspaceId };
}

const EVENT_FOR_ACTION: Record<Action, IntegrationEventType> = {
  approve: 'approved',
  request_changes: 'change_request',
  hold: 'hold',
  back_to_review: 'back_to_review',
  schedule: 'scheduled',
  unschedule: 'unscheduled',
  move_to_review: 'moved_to_review',
  mark_sent: 'marked_sent',
  move_date: 'scheduled',
  reopen: 'hold',
};

export async function addComment(campaignId: string, actor: Actor, body: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !actorCanAccess(actor, campaign.workspaceId)) throw new ApiError(404, 'That campaign is not here.');
  const [entry] = await db.$transaction([
    db.comment.create({ data: { campaignId, authorKind: actor.role, authorName: actor.name, authorId: actor.id, body, kind: 'comment' } }),
    db.campaign.update({ where: { id: campaignId }, data: { lastActivityAt: new Date() } }),
  ]);
  const payload = await payloadFor(campaignId, actor, 'comment', { text: body, commentId: entry.id });
  if (payload) await emit(payload);
  return { workspaceId: campaign.workspaceId };
}

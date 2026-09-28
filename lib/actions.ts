// The only way a status changes. Checks role and allowed move, then writes the campaign, the thread
// entry and the queued side effects. Nothing here waits on Asana, Slack or Klaviyo.
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { actorCanAccess, canDecide, type Actor } from '@/lib/auth';
import { applyAction, threadLineFor, toastFor, type Action } from '@/lib/transitions';
import { checkSlot } from '@/lib/slots';
import { dateToYmd, isYmd, ymdToDate } from '@/lib/dates';
import { HOLDS_A_DAY, isStatus, type Status } from '@/lib/status';
import { notifyStatusChange } from '@/lib/notify';
import { getSendProvider } from '@/lib/sendProvider';
import { slotInputFor } from '@/lib/schedule';
import { emit } from '@/lib/integrations/dispatch';
import { payloadFor } from '@/lib/integrations/payload';
import type { IntegrationEventType } from '@/lib/integrations/types';

export interface ActionInput {
  action: Action;
  note?: string;
  date?: string;
}

/** Statuses under review again: an earlier approval no longer describes them. */
const CLEARS_APPROVAL: Status[] = ['draft', 'review', 'changes'];

export async function performAction(campaignId: string, actor: Actor, input: ActionInput) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, include: { workspace: true } });
  if (!campaign || !actorCanAccess(actor, campaign.workspaceId)) throw new ApiError(404, 'That campaign is not here.');
  if (!isStatus(campaign.status)) throw new ApiError(500, 'Unknown status.');
  if (actor.role === 'reviewer' && campaign.status === 'draft' && !campaign.workspace.clientSeesDrafts) throw new ApiError(404, 'That campaign is not here.');

  const note = (input.note ?? '').trim();
  const result = applyAction(campaign.status, input.action, actor.role, note, canDecide(actor));
  if (!result.ok) throw new ApiError(result.reason.startsWith('You can leave notes') ? 403 : 400, result.reason);
  const { def, to } = result;

  let date: string | undefined;
  if (def.needsDate) {
    if (!input.date || !isYmd(input.date)) throw new ApiError(400, 'Pick an open slot.');
    date = input.date;
    const check = checkSlot(await slotInputFor(campaign.workspace, campaign, actor.role), date);
    if (!check.ok) throw new ApiError(400, check.reason);
  } else if (def.keepsDate) {
    if (!campaign.scheduledDate) throw new ApiError(400, 'There is no requested date to confirm. Pick a slot instead.');
    date = dateToYmd(campaign.scheduledDate);
  }

  const now = new Date();
  const data: Parameters<typeof db.campaign.update>[0]['data'] = { status: to, lastActivityAt: now };
  if (HOLDS_A_DAY.includes(to)) data.scheduledDate = ymdToDate(date!);
  else if (campaign.scheduledDate) data.scheduledDate = null;
  if (to === 'sent') data.sentDate = now;
  else if (campaign.sentDate) data.sentDate = null;
  if (to === 'review' && campaign.status !== 'review') {
    data.reviewEnteredAt = now;
    data.reviewNotifiedAt = null;
  }
  // An approval covers one design version, by one person, at one time.
  if (input.action === 'approve') Object.assign(data, { approvedVersion: campaign.currentVersion, approvedBy: actor.name, approvedAt: now });
  else if (CLEARS_APPROVAL.includes(to)) Object.assign(data, { approvedVersion: null, approvedBy: null, approvedAt: null });

  const [, entry] = await db.$transaction([
    db.campaign.update({ where: { id: campaign.id }, data }),
    db.comment.create({
      data: {
        campaignId: campaign.id,
        authorKind: actor.role,
        authorName: actor.name,
        authorId: actor.id,
        body: note || threadLineFor(input.action, date, campaign.currentVersion || undefined),
        kind: 'status',
        fromStatus: campaign.status,
        toStatus: to,
        version: input.action === 'approve' && campaign.currentVersion ? campaign.currentVersion : null,
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

  const payload = await payloadFor(campaign.id, actor, EVENT_FOR_ACTION[input.action], { text: note || undefined, commentId: entry.id, date });
  if (payload) await emit(payload);

  return { toast: toastFor(input.action, date), workspaceId: campaign.workspaceId };
}

const EVENT_FOR_ACTION: Record<Action, IntegrationEventType> = {
  approve: 'approved',
  request_changes: 'change_request',
  hold: 'hold',
  back_to_review: 'back_to_review',
  request_date: 'date_requested',
  withdraw_date: 'unscheduled',
  confirm_date: 'scheduled',
  schedule: 'scheduled',
  unschedule: 'unscheduled',
  move_to_review: 'moved_to_review',
  mark_sent: 'marked_sent',
  move_date: 'scheduled',
  reopen: 'hold',
};

export async function addComment(campaignId: string, actor: Actor, body: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, include: { workspace: true } });
  if (!campaign || !actorCanAccess(actor, campaign.workspaceId)) throw new ApiError(404, 'That campaign is not here.');
  if (actor.role === 'reviewer' && campaign.status === 'draft' && !campaign.workspace.clientSeesDrafts) throw new ApiError(404, 'That campaign is not here.');
  const [entry] = await db.$transaction([
    db.comment.create({ data: { campaignId, authorKind: actor.role, authorName: actor.name, authorId: actor.id, body, kind: 'comment' } }),
    db.campaign.update({ where: { id: campaignId }, data: { lastActivityAt: new Date() } }),
  ]);
  const payload = await payloadFor(campaignId, actor, 'comment', { text: body, commentId: entry.id });
  if (payload) await emit(payload);
  return { workspaceId: campaign.workspaceId };
}

// Outbox. A decision is saved in the Bank first; emit() then queues one job per target and tries to
// deliver at once. The cron endpoint retries failures with backoff. Each job has a unique key, so the
// same side effect is never queued twice. Nothing here throws into the request that caused the event.
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getStorage } from '@/lib/storage';
import { buildSlackMessage, postSlack } from './slack';
import { AsanaClient, buildAsanaComment, buildAsanaReply, buildAsanaTask, parseStageMap, stageFor } from './asana';
import { postWebhook } from './webhook';
import { ACTIONABLE, DECISIONS, type EventPayload, type IntegrationTarget } from './types';
import { pushSheetTab } from './sheetTab';

const MAX_ATTEMPTS = 5;
const QUIET_TYPES = new Set(['approved', 'hold', 'back_to_review', 'date_requested', 'scheduled', 'unscheduled', 'moved_to_review', 'marked_sent', 'version_uploaded']);

export async function emit(payload: EventPayload): Promise<void> {
  try {
    const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId: payload.workspace.id } });
    if (!cfg) return;
    const targets: IntegrationTarget[] = [];
    if (cfg.slackWebhookUrl && !(cfg.slackQuietUpdates && QUIET_TYPES.has(payload.type))) targets.push('slack');
    if (env('ASANA_ACCESS_TOKEN') && asanaWants(payload, !!cfg.asanaProjectGid)) targets.push('asana');
    if (cfg.webhookUrl) targets.push('webhook');
    if (cfg.googleSheetId && env('GOOGLE_SERVICE_ACCOUNT_JSON')) targets.push('sheet');
    if (targets.length === 0) return;
    const body = JSON.stringify(payload);
    const ref = payload.commentId ?? payload.pin?.threadId ?? payload.at;
    for (const target of targets) {
      // the sheet tab is rewritten whole, so many changes collapse into one pending job
      const dedupKey = target === 'sheet' ? `sheet:${payload.workspace.id}:pending` : `${target}:${payload.type}:${payload.campaign.id}:${ref}`;
      const existing = await db.integrationEvent.findFirst({ where: { dedupKey, ...(target === 'sheet' ? { status: 'pending' } : {}) } });
      if (existing) continue;
      await db.integrationEvent.create({ data: { workspaceId: payload.workspace.id, campaignId: payload.campaign.id, type: payload.type, target, payload: body, dedupKey } });
    }
    void deliverPending().catch((err) => console.error('[integrations] deliver failed:', err));
  } catch (err) {
    console.error('[integrations] emit failed:', err);
  }
}

/**
 * When the campaign is linked to its Asana task, the Bank writes client decisions and notes onto that task.
 * Without a link, a project is enough to create tasks for what the client asks of ECD.
 */
function asanaWants(p: EventPayload, hasProject: boolean): boolean {
  if (p.type === 'pin_resolved' || p.type === 'pin_reopened' || p.type === 'pin_reply') return true;
  if (p.campaign.asanaTaskGid) return DECISIONS.includes(p.type) || (ACTIONABLE.includes(p.type) && p.actor.role === 'reviewer');
  return hasProject && ACTIONABLE.includes(p.type) && p.actor.role === 'reviewer';
}

let running = false;

export async function deliverPending(limit = 25): Promise<{ sent: number; failed: number }> {
  if (running) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const rows = await db.integrationEvent.findMany({
      where: { type: { not: 'sync_error' }, OR: [{ status: 'pending' }, { status: 'failed', attempts: { lt: MAX_ATTEMPTS } }] },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    for (const row of rows) {
      if (row.status === 'failed' && row.sentAt && Date.now() - row.sentAt.getTime() < backoffMs(row.attempts)) continue;
      try {
        const result = await deliverOne(row.id, row.target as IntegrationTarget, JSON.parse(row.payload) as EventPayload);
        await db.integrationEvent.update({ where: { id: row.id }, data: { status: result === 'skipped' ? 'skipped' : 'sent', result, error: null, attempts: { increment: 1 }, sentAt: new Date() } });
        sent++;
      } catch (err) {
        failed++;
        const attempts = row.attempts + 1;
        await db.integrationEvent.update({
          where: { id: row.id },
          // after the last attempt the job is parked as dead, where ECD can see it and retry by hand
          data: { status: attempts >= MAX_ATTEMPTS ? 'dead' : 'failed', error: (err as Error).message.slice(0, 500), attempts, sentAt: new Date() },
        });
      }
    }
  } finally {
    running = false;
  }
  return { sent, failed };
}

function backoffMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** attempts);
}

export async function retryEvent(id: string): Promise<void> {
  await db.integrationEvent.update({ where: { id }, data: { status: 'pending', attempts: 0, error: null } });
  await deliverPending();
}

async function attachCrop(asana: AsanaClient, taskGid: string, threadId: string, number: number) {
  const thread = await db.pinThread.findUnique({ where: { id: threadId } });
  if (!thread?.cropPath) return;
  const buf = await getStorage().getObject(thread.cropPath);
  if (buf) await asana.attach(taskGid, buf, `note-${number}.jpg`, 'image/jpeg').catch((err) => console.warn('[asana] attachment failed:', (err as Error).message));
}

async function deliverOne(eventId: string, target: IntegrationTarget, p: EventPayload): Promise<string> {
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId: p.workspace.id } });
  if (!cfg) return 'skipped';
  switch (target) {
    case 'slack': {
      if (!cfg.slackWebhookUrl) return 'skipped';
      await postSlack(cfg.slackWebhookUrl, buildSlackMessage(p));
      return 'posted';
    }
    case 'webhook': {
      if (!cfg.webhookUrl) return 'skipped';
      await postWebhook(cfg.webhookUrl, cfg.webhookSecret, eventId, p);
      return 'posted';
    }
    case 'sheet': {
      const rows = await pushSheetTab(p.workspace.id);
      return `tab rewritten, ${rows} rows`;
    }
    case 'asana': {
      const token = env('ASANA_ACCESS_TOKEN');
      if (!token) return 'skipped';
      const asana = new AsanaClient(token);

      // follow ups on a note's own task
      if (p.pin && (p.type === 'pin_reply' || p.type === 'pin_resolved' || p.type === 'pin_reopened')) {
        const thread = await db.pinThread.findUnique({ where: { id: p.pin.threadId } });
        if (!thread?.asanaTaskGid) return 'skipped';
        if (p.type === 'pin_reply') await asana.addComment(thread.asanaTaskGid, buildAsanaReply(p));
        else await asana.setCompleted(thread.asanaTaskGid, p.type === 'pin_resolved');
        return `task ${thread.asanaTaskGid}`;
      }

      // the campaign has its own Asana task: comment there, set Stage, notes become subtasks
      const taskGid = p.campaign.asanaTaskGid;
      if (taskGid) {
        const done: string[] = [];
        if (p.type === 'pin_created' && p.pin) {
          const { name, notes } = buildAsanaTask(p);
          const sub = await asana.createSubtask(taskGid, { name, notes, assigneeEmail: cfg.asanaAssigneeEmail });
          await db.pinThread.update({ where: { id: p.pin.threadId }, data: { asanaTaskGid: sub.gid } }).catch(() => {});
          await attachCrop(asana, sub.gid, p.pin.threadId, p.pin.number);
          done.push(`subtask ${sub.gid}`);
        }
        await asana.addComment(taskGid, buildAsanaComment(p));
        done.push('comment');
        const option = cfg.asanaStageFieldGid ? stageFor(p, parseStageMap(cfg.asanaStageMap)) : undefined;
        if (cfg.asanaStageFieldGid && option) {
          await asana.setStage(taskGid, cfg.asanaStageFieldGid, option);
          // remember our own write, so the next pull sees it and ignores it
          await db.campaign.update({ where: { id: p.campaign.id }, data: { asanaStageWrote: option, asanaStageGid: option } }).catch(() => {});
          done.push('stage');
        }
        if (p.commentId) await db.comment.update({ where: { id: p.commentId }, data: { asanaTaskGid: taskGid } }).catch(() => {});
        return `task ${taskGid}: ${done.join(', ')}`;
      }

      // no link: a new task in the client's project for what the client asked
      if (!cfg.asanaProjectGid) return 'skipped';
      if (p.type === 'change_request' || p.type === 'comment' || p.type === 'pin_created') {
        const { name, notes } = buildAsanaTask(p);
        const task = await asana.createTask({ projectGid: cfg.asanaProjectGid, sectionGid: null, name, notes, assigneeEmail: cfg.asanaAssigneeEmail });
        if (p.pin) {
          await db.pinThread.update({ where: { id: p.pin.threadId }, data: { asanaTaskGid: task.gid } }).catch(() => {});
          await attachCrop(asana, task.gid, p.pin.threadId, p.pin.number);
        } else if (p.commentId) {
          await db.comment.update({ where: { id: p.commentId }, data: { asanaTaskGid: task.gid } }).catch(() => {});
        }
        return `task ${task.gid}`;
      }
      return 'skipped';
    }
  }
}

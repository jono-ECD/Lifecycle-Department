// Outbox. emit() records one row per configured target and tries to deliver at once; the cron endpoint
// retries failures with backoff. Nothing here throws into the request that caused the event.
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getStorage } from '@/lib/storage';
import { buildSlackMessage, postSlack } from './slack';
import { AsanaClient, buildAsanaReply, buildAsanaTask } from './asana';
import { postWebhook } from './webhook';
import { ACTIONABLE, type EventPayload, type IntegrationTarget } from './types';

const MAX_ATTEMPTS = 5;
const QUIET_TYPES = new Set(['approved', 'hold', 'back_to_review', 'scheduled', 'unscheduled', 'moved_to_review', 'marked_sent', 'version_uploaded']);

export async function emit(payload: EventPayload): Promise<void> {
  try {
    const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId: payload.workspace.id } });
    if (!cfg) return;
    const targets: IntegrationTarget[] = [];
    if (cfg.slackWebhookUrl && !(cfg.slackQuietUpdates && QUIET_TYPES.has(payload.type))) targets.push('slack');
    if (cfg.asanaProjectGid && env('ASANA_ACCESS_TOKEN') && asanaWants(payload)) targets.push('asana');
    if (cfg.webhookUrl) targets.push('webhook');
    if (targets.length === 0) return;
    const body = JSON.stringify(payload);
    await db.integrationEvent.createMany({
      data: targets.map((target) => ({ workspaceId: payload.workspace.id, campaignId: payload.campaign.id, type: payload.type, target, payload: body })),
    });
    void deliverPending().catch((err) => console.error('[integrations] deliver failed:', err));
  } catch (err) {
    console.error('[integrations] emit failed:', err);
  }
}

/** Asana gets tasks for what the client asks of ECD, and follow ups on those tasks. */
function asanaWants(p: EventPayload): boolean {
  if (p.type === 'pin_resolved' || p.type === 'pin_reopened') return true;
  if (p.type === 'pin_reply') return true;
  return ACTIONABLE.includes(p.type) && p.actor.role === 'reviewer';
}

let running = false;

export async function deliverPending(limit = 25): Promise<{ sent: number; failed: number }> {
  if (running) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const rows = await db.integrationEvent.findMany({
      where: { OR: [{ status: 'pending' }, { status: 'failed', attempts: { lt: MAX_ATTEMPTS } }] },
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
        await db.integrationEvent.update({
          where: { id: row.id },
          data: { status: 'failed', error: (err as Error).message.slice(0, 500), attempts: { increment: 1 }, sentAt: new Date() },
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
    case 'asana': {
      const token = env('ASANA_ACCESS_TOKEN');
      if (!token || !cfg.asanaProjectGid) return 'skipped';
      const asana = new AsanaClient(token);
      if (p.type === 'change_request' || p.type === 'comment' || p.type === 'pin_created') {
        const { name, notes } = buildAsanaTask(p);
        const task = await asana.createTask({ projectGid: cfg.asanaProjectGid, sectionGid: cfg.asanaSectionGid, name, notes, assigneeEmail: cfg.asanaAssigneeEmail });
        if (p.pin) {
          await db.pinThread.update({ where: { id: p.pin.threadId }, data: { asanaTaskGid: task.gid } }).catch(() => {});
          const thread = await db.pinThread.findUnique({ where: { id: p.pin.threadId } });
          if (thread?.cropPath) {
            const buf = await getStorage().getObject(thread.cropPath);
            if (buf) await asana.attach(task.gid, buf, `note-${p.pin.number}.jpg`, 'image/jpeg').catch((err) => console.warn('[asana] attachment failed:', (err as Error).message));
          }
        } else if (p.commentId) {
          await db.comment.update({ where: { id: p.commentId }, data: { asanaTaskGid: task.gid } }).catch(() => {});
        }
        return `task ${task.gid}`;
      }
      if (p.pin && (p.type === 'pin_reply' || p.type === 'pin_resolved' || p.type === 'pin_reopened')) {
        const thread = await db.pinThread.findUnique({ where: { id: p.pin.threadId } });
        if (!thread?.asanaTaskGid) return 'skipped';
        if (p.type === 'pin_reply') await asana.addComment(thread.asanaTaskGid, buildAsanaReply(p));
        else await asana.setCompleted(thread.asanaTaskGid, p.type === 'pin_resolved');
        return `task ${thread.asanaTaskGid}`;
      }
      return 'skipped';
    }
  }
}

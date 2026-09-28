// Notification events: reviewer actions to admins, review digests to reviewers, daily reminders.
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { renderMail, type MailItem } from '@/lib/mail/templates';
import { assetUrl } from '@/lib/uploads';
import { signEmailLink } from '@/lib/tokens';
import { fmtShort, todayYmd } from '@/lib/dates';
import { digestSubject, reminderDue, reminderSubject, selectDigest, selectReminders } from './rules';
import type { StatusChangeEvent } from './index';
import { contextLine, headline, type EventPayload } from '@/lib/integrations/types';

const appUrl = () => env('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
const batchMs = () => Number(env('REVIEW_BATCH_MS', '600000')) || 600000;

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${appUrl()}${url}`;
}

async function thumbFor(campaignId: string, version: number): Promise<string | null> {
  const a = await db.campaignAsset.findFirst({ where: { campaignId, version }, orderBy: { orderIndex: 'asc' } });
  return absolute(assetUrl(a?.thumbPath ?? a?.path));
}

// ---- reviewer actions to admins ----

const ACTION_LINE: Record<string, string> = {
  approve: 'approved',
  request_changes: 'requested changes on',
  hold: 'put on hold',
  request_date: 'requested a send date for',
  withdraw_date: 'withdrew the send date of',
  back_to_review: 'moved back to review',
};

export async function notifyStatusChangeImpl(ev: StatusChangeEvent): Promise<void> {
  try {
    if (ev.actor.role === 'admin' && ev.to === 'review') {
      scheduleDigest(ev.workspaceId);
      return;
    }
    if (ev.actor.role === 'reviewer' && ACTION_LINE[ev.action]) {
      const c = await db.campaign.findUnique({ where: { id: ev.campaignId }, include: { workspace: true } });
      if (!c) return;
      const admins = await db.adminUser.findMany({ select: { email: true } });
      const verb = ACTION_LINE[ev.action];
      const when = ev.date ? ` for ${fmtShort(ev.date)}` : '';
      const heading = `${ev.actor.name} ${verb} ${c.name}${when}`;
      const { html, text } = renderMail({
        heading,
        intro: `${c.workspace.name}. Status is now ${ev.to === 'draft' ? 'draft, back with ECD' : ev.to}.`,
        items: [{ name: c.name, sub: c.subtitle, thumbUrl: await thumbFor(c.id, c.currentVersion), line: ev.note ? `Note: ${ev.note}` : null }],
        cta: { label: 'Open the bank', url: `${appUrl()}/admin/w/${c.workspace.slug}` },
        footer: 'Sent to ECD admins by the Campaign Bank.',
      });
      await sendMail({ to: admins.map((a) => a.email), subject: heading, html, text }, { type: 'reviewer_action', workspaceId: c.workspaceId, campaignId: c.id });
    }
  } catch (err) {
    console.error('[notify] failed:', err);
  }
}

// ---- pinned notes from the client to admins ----

export async function notifyPin(p: EventPayload): Promise<void> {
  try {
    const admins = await db.adminUser.findMany({ select: { email: true } });
    const heading = headline(p);
    const { html, text } = renderMail({
      heading,
      intro: contextLine(p),
      items: [{ name: p.campaign.name, sub: p.campaign.subtitle, thumbUrl: p.pin?.cropUrl ?? (await thumbFor(p.campaign.id, p.campaign.version)), line: p.text ? `Note: ${p.text}` : null }],
      cta: { label: 'Open in the bank', url: p.links.admin },
      footer: 'Sent to ECD admins by the Campaign Bank.',
    });
    await sendMail({ to: admins.map((a) => a.email), subject: heading, html, text }, { type: 'pin', workspaceId: p.workspace.id, campaignId: p.campaign.id });
  } catch (err) {
    console.error('[notify] pin email failed:', err);
  }
}

// ---- review digest to reviewers, batched ----

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Waits for the batch window so several campaigns moved together become one email. Safe across restarts: the flag lives on the campaign. */
export function scheduleDigest(workspaceId: string) {
  if (timers.has(workspaceId)) return;
  const t = setTimeout(() => {
    timers.delete(workspaceId);
    flushDigest(workspaceId).catch((err) => console.error('[notify] digest failed:', err));
  }, batchMs());
  if (typeof t === 'object' && 'unref' in t) t.unref();
  timers.set(workspaceId, t);
}

export async function flushDigest(workspaceId: string, force = false, now: Date = new Date()): Promise<number> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { reviewers: { where: { revokedAt: null } } } });
  if (!ws) return 0;
  const inReview = await db.campaign.findMany({ where: { workspaceId, status: 'review' }, orderBy: { reviewEnteredAt: 'asc' } });
  const fresh = selectDigest(inReview, now, batchMs(), force);
  if (fresh.length === 0) return 0;
  const items: MailItem[] = [];
  for (const c of fresh) items.push({ name: c.name, sub: c.subtitle, thumbUrl: await thumbFor(c.id, c.currentVersion) });
  const subject = digestSubject(inReview.length);
  const intro = fresh.length === inReview.length ? 'Approve it, ask for a change, or park it for later. Nothing is ever lost.' : `${fresh.length} new since the last email. Approve, ask for a change, or park it for later.`;
  for (const r of ws.reviewers) {
    const { html, text } = renderMail({
      heading: subject,
      intro,
      items,
      cta: { label: 'Open the bank', url: `${appUrl()}/e/${signEmailLink(r.id)}` },
    });
    await sendMail({ to: [r.email], subject, html, text }, { type: 'review_digest', workspaceId });
  }
  await db.campaign.updateMany({ where: { id: { in: fresh.map((c) => c.id) } }, data: { reviewNotifiedAt: now } });
  return fresh.length;
}

/** Sends every digest whose window has passed. Called by the cron endpoint and the scheduler, and on startup. */
export async function flushAllDigests(force = false): Promise<number> {
  const pending = await db.campaign.findMany({ where: { status: 'review', reviewNotifiedAt: null }, select: { workspaceId: true }, distinct: ['workspaceId'] });
  let n = 0;
  for (const p of pending) n += await flushDigest(p.workspaceId, force);
  return n;
}

// ---- daily reminders ----

export async function sendReminders(now: Date = new Date()): Promise<number> {
  const workspaces = await db.workspace.findMany({ include: { reviewers: { where: { revokedAt: null } } } });
  let sent = 0;
  for (const ws of workspaces) {
    if (ws.reviewers.length === 0) continue;
    const today = todayYmd(ws.timezone, now);
    const key = `reminder:${ws.id}:${today}`;
    const already = await db.notificationLog.findFirst({ where: { dedupKey: { startsWith: key } } });
    if (!reminderDue(ws.timezone, now, !!already)) continue;
    const inReview = await db.campaign.findMany({ where: { workspaceId: ws.id, status: 'review' }, orderBy: { reviewEnteredAt: 'asc' } });
    const waiting = selectReminders(inReview, now);
    if (waiting.length === 0) continue;
    const items: MailItem[] = [];
    for (const c of waiting) items.push({ name: c.name, sub: c.subtitle, thumbUrl: await thumbFor(c.id, c.currentVersion) });
    const subject = reminderSubject(waiting.length);
    for (const r of ws.reviewers) {
      const { html, text } = renderMail({
        heading: subject,
        intro: 'These are waiting in the bank whenever you have a minute. Approve, ask for a change, or park them for later.',
        items,
        cta: { label: 'Open the bank', url: `${appUrl()}/e/${signEmailLink(r.id)}` },
      });
      const res = await sendMail({ to: [r.email], subject, html, text }, { type: 'reminder', workspaceId: ws.id, dedupKey: key });
      sent += res.sent;
    }
  }
  return sent;
}

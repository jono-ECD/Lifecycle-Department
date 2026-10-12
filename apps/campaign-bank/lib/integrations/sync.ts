// Periodic jobs: read each client's content calendar, and pull sent campaigns and results from Klaviyo.
// Called by the cron endpoint, the in process scheduler, and the "Sync now" buttons.
import { db } from '@/lib/db';
import { addDays, todayYmd, ymdToDate } from '@/lib/dates';
import { decryptSecret } from '@/lib/secrets';
import { fetchCalendar, sameCampaign } from './sheet';
import { KlaviyoClient, SENT_STATUSES } from './klaviyo';
import { FigmaClient } from './figma';
import { ASANA_EVERY_MS, pullAsana } from './asanaSync';
import { systemActor } from './payload';
import { env } from '@/lib/env';
import { fmtShort } from '@/lib/dates';
import { addVersion } from '@/lib/admin';
import { renderFrames } from '@/lib/figmaImport';

export const SHEET_EVERY_MS = 15 * 60 * 1000;
export const KLAVIYO_EVERY_MS = 3 * 60 * 60 * 1000;

export async function syncSheet(workspaceId: string, fetchImpl: typeof fetch = fetch): Promise<{ count: number; dateColumn: string | null; nameColumn: string | null }> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { integration: true } });
  const cfg = ws?.integration;
  if (!ws || !cfg?.sheetUrl) throw new Error('Save a spreadsheet link first.');
  const today = todayYmd(ws.timezone);
  try {
    const res = await fetchCalendar(cfg.sheetUrl, { dateColumn: cfg.sheetDateColumn, nameColumn: cfg.sheetNameColumn, filterColumn: cfg.sheetFilterColumn, filterValue: cfg.sheetFilterValue }, today, fetchImpl);
    // keep a window around today; older rows are history, far future rows are not on the calendar yet
    const from = addDays(today, -30);
    const to = addDays(today, 180);
    const seen = new Set<string>();
    const items = res.items.filter((i) => {
      const k = `${i.date}|${i.label.toLowerCase()}`;
      if (i.date < from || i.date > to || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    await db.$transaction([
      db.scheduleItem.deleteMany({ where: { workspaceId, source: 'sheet' } }),
      db.scheduleItem.createMany({ data: items.map((i) => ({ workspaceId, date: ymdToDate(i.date), label: i.label, note: i.note, source: 'sheet' })) }),
      db.workspaceIntegration.update({ where: { workspaceId }, data: { sheetSyncedAt: new Date(), sheetError: null, sheetCount: items.length } }),
    ]);
    return { count: items.length, dateColumn: res.dateColumn, nameColumn: res.nameColumn };
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { sheetSyncedAt: new Date(), sheetError: message } });
    throw new Error(message);
  }
}

export async function syncKlaviyo(workspaceId: string, fetchImpl: typeof fetch = fetch): Promise<{ campaigns: number; sent: number; linked: number; advanced: number }> {
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const key = cfg?.klaviyoKeyEnc ? decryptSecret(cfg.klaviyoKeyEnc) : null;
  if (!cfg || !key) throw new Error('Save the Klaviyo private key first.');
  const client = new KlaviyoClient(key, fetchImpl);
  try {
    const campaigns = await client.campaigns();
    let metricId = cfg.klaviyoMetricId;
    let hasRevenue = true;
    if (!metricId) {
      const m = await client.conversionMetricId();
      metricId = m?.id ?? null;
      hasRevenue = !!m?.isOrder;
      if (m?.isOrder) await db.workspaceIntegration.update({ where: { workspaceId }, data: { klaviyoMetricId: m.id } });
    }
    const stats = metricId ? await client.campaignValues(metricId, hasRevenue) : new Map();
    const bank = await db.campaign.findMany({ where: { workspaceId }, select: { id: true, name: true, klaviyoCampaignId: true } });
    const tz = (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).timezone;
    let advanced = 0;
    const existing = new Map((await db.klaviyoCampaign.findMany({ where: { workspaceId } })).map((k) => [k.klaviyoId, k]));
    let linked = 0;
    let sent = 0;
    for (const c of campaigns) {
      const s = stats.get(c.id);
      const prev = existing.get(c.id);
      const isSent = SENT_STATUSES.includes(c.status);
      if (isSent) sent++;
      // The campaign id from the Asana task is the strongest link, then a link made by hand, then the name.
      let campaignId = prev?.campaignId ?? null;
      let linkedBy = prev?.linkedBy ?? null;
      const byId = bank.find((b) => b.klaviyoCampaignId === c.id);
      if (byId) {
        campaignId = byId.id;
        linkedBy = 'id';
      } else if (linkedBy !== 'manual') {
        const match = bank.find((b) => sameCampaign(b.name, c.name));
        campaignId = match?.id ?? null;
        linkedBy = match ? 'auto' : null;
      }
      // Klaviyo owns what actually sends. Only a sure link (id or by hand) may move a status.
      if (campaignId && (linkedBy === 'id' || linkedBy === 'manual')) {
        const when = c.sendTime ?? c.scheduledAt;
        const moved = await followKlaviyo(campaignId, c.status, when ? new Date(when) : null, tz);
        if (moved) advanced++;
      }
      if (campaignId) linked++;
      const data = {
        name: c.name,
        subject: c.subject,
        status: c.status,
        sendTime: c.sendTime ? new Date(c.sendTime) : c.scheduledAt ? new Date(c.scheduledAt) : null,
        recipients: s?.recipients ?? prev?.recipients ?? null,
        delivered: s?.delivered ?? prev?.delivered ?? null,
        opens: s?.opens ?? prev?.opens ?? null,
        openRate: s?.openRate ?? prev?.openRate ?? null,
        clicks: s?.clicks ?? prev?.clicks ?? null,
        clickRate: s?.clickRate ?? prev?.clickRate ?? null,
        unsubscribes: s?.unsubscribes ?? prev?.unsubscribes ?? null,
        bounceRate: s?.bounceRate ?? prev?.bounceRate ?? null,
        conversions: s?.conversions ?? prev?.conversions ?? null,
        revenue: s?.revenue ?? prev?.revenue ?? null,
        campaignId,
        linkedBy,
        syncedAt: new Date(),
      };
      await db.klaviyoCampaign.upsert({ where: { workspaceId_klaviyoId: { workspaceId, klaviyoId: c.id } }, update: data, create: { workspaceId, klaviyoId: c.id, ...data } });
    }
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { klaviyoSyncedAt: new Date(), klaviyoError: null } });
    return { campaigns: campaigns.length, sent, linked, advanced };
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { klaviyoSyncedAt: new Date(), klaviyoError: message } });
    throw new Error(message);
  }
}

/** Moves a campaign to Scheduled or Sent when Klaviyo says so. Returns true when it moved. */
async function followKlaviyo(campaignId: string, klaviyoStatus: string, when: Date | null, tz: string): Promise<boolean> {
  const c = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!c) return false;
  const isSent = SENT_STATUSES.includes(klaviyoStatus);
  if (isSent && ['approved', 'requested', 'scheduled'].includes(c.status)) {
    await db.$transaction([
      db.campaign.update({ where: { id: c.id }, data: { status: 'sent', sentDate: when ?? new Date(), lastActivityAt: new Date() } }),
      db.comment.create({ data: { campaignId: c.id, authorKind: 'admin', authorName: 'Klaviyo', kind: 'status', fromStatus: c.status, toStatus: 'sent', body: `Sent from Klaviyo${when ? ` on ${fmtShort(todayYmd(tz, when))}` : ''}.` } }),
    ]);
    return true;
  }
  if (klaviyoStatus === 'Scheduled' && when && ['approved', 'requested'].includes(c.status)) {
    const day = todayYmd(tz, when);
    await db.$transaction([
      db.campaign.update({ where: { id: c.id }, data: { status: 'scheduled', scheduledDate: ymdToDate(day), lastActivityAt: new Date() } }),
      db.comment.create({ data: { campaignId: c.id, authorKind: 'admin', authorName: 'Klaviyo', kind: 'status', fromStatus: c.status, toStatus: 'scheduled', body: `Scheduled in Klaviyo for ${fmtShort(day)}.` } }),
    ]);
    return true;
  }
  return false;
}

/** Re-renders Figma frames of campaigns still in play when their file changed. Unchanged frames are skipped by hash. */
export async function syncFigma(workspaceId: string): Promise<{ checked: number; updated: number }> {
  const token = env('FIGMA_ACCESS_TOKEN');
  if (!token) return { checked: 0, updated: 0 };
  const campaigns = await db.campaign.findMany({ where: { workspaceId, channel: 'email', figmaFileKey: { not: null }, figmaNodeIds: { not: null }, status: { in: ['review', 'changes', 'approved', 'requested'] } } });
  const figma = new FigmaClient(token);
  const modified = new Map<string, string | null>();
  let updated = 0;
  for (const c of campaigns) {
    const key = c.figmaFileKey!;
    if (!modified.has(key)) modified.set(key, await figma.lastModified(key).catch(() => null));
    const stamp = modified.get(key);
    if (!stamp || stamp === c.figmaFileModified) continue;
    try {
      const files = await renderFrames(key, c.figmaNodeIds!.split(',').filter(Boolean));
      const r = await addVersion(c.id, { files }, systemActor('Figma'), { skipUnchanged: true, source: 'Figma' });
      await db.campaign.update({ where: { id: c.id }, data: { figmaFileModified: stamp } });
      if (!r.unchanged) updated++;
    } catch (err) {
      console.warn('[figma] refresh failed:', (err as Error).message);
    }
  }
  return { checked: campaigns.length, updated };
}

/** Runs whatever is due. Errors are stored on the workspace and shown in Connections. */
export async function syncDue(now: Date = new Date()): Promise<{ sheets: number; klaviyo: number; asana: number; figma: number }> {
  const all = await db.workspaceIntegration.findMany();
  let sheets = 0;
  let klaviyo = 0;
  let asana = 0;
  let figma = 0;
  for (const cfg of all) {
    if (cfg.asanaProjectGid && env('ASANA_ACCESS_TOKEN') && (!cfg.asanaPulledAt || now.getTime() - cfg.asanaPulledAt.getTime() >= ASANA_EVERY_MS)) {
      await pullAsana(cfg.workspaceId)
        .then(() => asana++)
        .catch(() => {});
    }
    figma += (await syncFigma(cfg.workspaceId).catch(() => ({ updated: 0 }))).updated;
    if (cfg.sheetUrl && (!cfg.sheetSyncedAt || now.getTime() - cfg.sheetSyncedAt.getTime() >= SHEET_EVERY_MS)) {
      await syncSheet(cfg.workspaceId)
        .then(() => sheets++)
        .catch(() => {});
    }
    if (cfg.klaviyoKeyEnc && (!cfg.klaviyoSyncedAt || now.getTime() - cfg.klaviyoSyncedAt.getTime() >= KLAVIYO_EVERY_MS)) {
      await syncKlaviyo(cfg.workspaceId)
        .then(() => klaviyo++)
        .catch(() => {});
    }
  }
  return { sheets, klaviyo, asana, figma };
}

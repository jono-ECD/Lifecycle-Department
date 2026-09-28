// Periodic jobs: read each client's content calendar, and pull sent campaigns and results from Klaviyo.
// Called by the cron endpoint, the in process scheduler, and the "Sync now" buttons.
import { db } from '@/lib/db';
import { addDays, todayYmd, ymdToDate } from '@/lib/dates';
import { decryptSecret } from '@/lib/secrets';
import { fetchCalendar, sameCampaign } from './sheet';
import { KlaviyoClient, SENT_STATUSES } from './klaviyo';

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

export async function syncKlaviyo(workspaceId: string, fetchImpl: typeof fetch = fetch): Promise<{ campaigns: number; sent: number; linked: number }> {
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
    const bank = await db.campaign.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const existing = new Map((await db.klaviyoCampaign.findMany({ where: { workspaceId } })).map((k) => [k.klaviyoId, k]));
    let linked = 0;
    let sent = 0;
    for (const c of campaigns) {
      const s = stats.get(c.id);
      const prev = existing.get(c.id);
      const isSent = SENT_STATUSES.includes(c.status);
      if (isSent) sent++;
      // manual links are never overwritten; automatic links follow the name
      let campaignId = prev?.campaignId ?? null;
      let linkedBy = prev?.linkedBy ?? null;
      if (linkedBy !== 'manual') {
        const match = bank.find((b) => sameCampaign(b.name, c.name));
        campaignId = match?.id ?? null;
        linkedBy = match ? 'auto' : null;
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
    return { campaigns: campaigns.length, sent, linked };
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { klaviyoSyncedAt: new Date(), klaviyoError: message } });
    throw new Error(message);
  }
}

/** Runs whatever is due. Errors are stored on the workspace and shown in Connections. */
export async function syncDue(now: Date = new Date()): Promise<{ sheets: number; klaviyo: number }> {
  const all = await db.workspaceIntegration.findMany({ where: { OR: [{ sheetUrl: { not: null } }, { klaviyoKeyEnc: { not: null } }] } });
  let sheets = 0;
  let klaviyo = 0;
  for (const cfg of all) {
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
  return { sheets, klaviyo };
}

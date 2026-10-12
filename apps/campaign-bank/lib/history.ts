// Sent history: every campaign marked sent in the bank, plus everything Klaviyo reports as sent,
// with results where Klaviyo has them. Shown to ECD and to the client.
import type { Workspace } from '@prisma/client';
import { db } from '@/lib/db';
import { assetUrl } from '@/lib/uploads';
import { fmtShort, todayYmd } from '@/lib/dates';
import { SENT_STATUSES } from '@/lib/integrations/klaviyo';
import { TYPES, type CampaignType } from '@/lib/status';

export interface HistoryRow {
  key: string;
  campaignId: string | null;
  klaviyoRowId: string | null;
  name: string;
  subject: string | null;
  type: string | null;
  thumbUrl: string | null;
  sentYmd: string | null;
  sentOn: string;
  recipients: number | null;
  openRate: number | null;
  clickRate: number | null;
  unsubscribes: number | null;
  revenue: number | null;
  conversions: number | null;
  source: 'bank' | 'klaviyo' | 'both';
}

export interface HistorySummary {
  sent: number;
  recipients: number;
  openRate: number | null;
  clickRate: number | null;
  revenue: number | null;
  days: number;
}

export interface HistoryPayload {
  workspace: { id: string; name: string; slug: string; logoUrl: string | null };
  connected: boolean;
  syncedOn: string | null;
  rows: HistoryRow[];
  summary: HistorySummary;
  linkable: { id: string; name: string }[];
}

const SUMMARY_DAYS = 90;

export async function loadHistory(workspace: Workspace): Promise<HistoryPayload> {
  const tz = workspace.timezone;
  const [sentCampaigns, klaviyo, cfg, all] = await Promise.all([
    db.campaign.findMany({ where: { workspaceId: workspace.id, status: 'sent' }, include: { assets: { orderBy: [{ version: 'desc' }, { orderIndex: 'asc' }] } } }),
    db.klaviyoCampaign.findMany({ where: { workspaceId: workspace.id, status: { in: SENT_STATUSES } }, orderBy: { sendTime: 'desc' } }),
    db.workspaceIntegration.findUnique({ where: { workspaceId: workspace.id } }),
    db.campaign.findMany({ where: { workspaceId: workspace.id }, select: { id: true, name: true, currentVersion: true, assets: { select: { thumbPath: true, version: true, orderIndex: true } } }, orderBy: { name: 'asc' } }),
  ]);

  const thumbOf = (id: string) => {
    const c = all.find((x) => x.id === id);
    const a = c?.assets.filter((x) => x.version === c.currentVersion).sort((x, y) => x.orderIndex - y.orderIndex)[0];
    return assetUrl(a?.thumbPath);
  };

  const rows: HistoryRow[] = [];
  const used = new Set<string>();
  for (const c of sentCampaigns) {
    const k = klaviyo.find((x) => x.campaignId === c.id);
    if (k) used.add(k.id);
    const when = k?.sendTime ?? c.sentDate ?? c.lastActivityAt;
    const ymd = todayYmd(tz, when);
    rows.push({
      key: `c-${c.id}`,
      campaignId: c.id,
      klaviyoRowId: k?.id ?? null,
      name: c.name,
      subject: k?.subject ?? null,
      type: TYPES[c.type as CampaignType] ?? null,
      thumbUrl: thumbOf(c.id),
      sentYmd: ymd,
      sentOn: fmtShort(ymd),
      recipients: k?.recipients ?? null,
      openRate: k?.openRate ?? null,
      clickRate: k?.clickRate ?? null,
      unsubscribes: k?.unsubscribes ?? null,
      revenue: k?.revenue ?? null,
      conversions: k?.conversions ?? null,
      source: k ? 'both' : 'bank',
    });
  }
  for (const k of klaviyo) {
    if (used.has(k.id)) continue;
    const ymd = k.sendTime ? todayYmd(tz, k.sendTime) : null;
    rows.push({
      key: `k-${k.id}`,
      campaignId: k.campaignId,
      klaviyoRowId: k.id,
      name: k.name,
      subject: k.subject,
      type: null,
      thumbUrl: k.campaignId ? thumbOf(k.campaignId) : null,
      sentYmd: ymd,
      sentOn: ymd ? fmtShort(ymd) : '',
      recipients: k.recipients,
      openRate: k.openRate,
      clickRate: k.clickRate,
      unsubscribes: k.unsubscribes,
      revenue: k.revenue,
      conversions: k.conversions,
      source: 'klaviyo',
    });
  }
  rows.sort((a, b) => (b.sentYmd ?? '').localeCompare(a.sentYmd ?? ''));

  // Summary over the last 90 days. Rates are weighted by recipients so a small send cannot skew them.
  const from = todayYmd(tz, new Date(Date.now() - SUMMARY_DAYS * 86400000));
  const recent = rows.filter((r) => r.sentYmd && r.sentYmd >= from);
  const withStats = recent.filter((r) => r.recipients && r.openRate != null);
  const recipients = withStats.reduce((n, r) => n + (r.recipients ?? 0), 0);
  const weighted = (pick: (r: HistoryRow) => number | null) => (recipients > 0 ? withStats.reduce((n, r) => n + (pick(r) ?? 0) * (r.recipients ?? 0), 0) / recipients : null);
  const revenueRows = recent.filter((r) => r.revenue != null);

  return {
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, logoUrl: assetUrl(workspace.logoPath) },
    connected: !!cfg?.klaviyoKeyEnc,
    syncedOn: cfg?.klaviyoSyncedAt ? fmtShort(todayYmd(tz, cfg.klaviyoSyncedAt)) : null,
    rows,
    summary: { sent: recent.length, recipients, openRate: weighted((r) => r.openRate), clickRate: weighted((r) => r.clickRate), revenue: revenueRows.length ? revenueRows.reduce((n, r) => n + (r.revenue ?? 0), 0) : null, days: SUMMARY_DAYS },
    linkable: all.map((c) => ({ id: c.id, name: c.name })),
  };
}


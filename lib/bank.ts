// Builds the payload the bank page renders. Shared by the reviewer page, the admin page, polling and actions.
import type { Workspace } from '@prisma/client';
import { db } from '@/lib/db';
import { assetUrl } from '@/lib/uploads';
import { dateToYmd, fmtLong, fmtShort, fmtStamp, todayYmd, dayOfMonth, weekday2, type Ymd } from '@/lib/dates';
import { windowDates } from '@/lib/slots';
import type { Actor } from '@/lib/auth';
import type { CampaignType, Role, Status } from '@/lib/status';
import { describePosition } from '@/lib/integrations/describe';
import { unmatched, type Planned } from '@/lib/schedule';
import { SENT_STATUSES } from '@/lib/integrations/klaviyo';

export interface BankAsset {
  id: string;
  kind: 'image' | 'pdf';
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  name: string;
}

export interface BankComment {
  id: string;
  who: string;
  you: boolean;
  when: string;
  body: string;
  kind: string;
  pinNumber: number | null;
  files: { url: string; name: string }[];
}

export interface BankPinComment {
  id: string;
  who: string;
  you: boolean;
  when: string;
  body: string;
}

export interface BankPin {
  id: string;
  assetId: string;
  version: number;
  em: number;
  number: number;
  x: number;
  y: number;
  w: number | null;
  h: number | null;
  status: 'open' | 'resolved';
  position: string;
  cropUrl: string | null;
  author: string;
  mine: boolean;
  when: string;
  resolvedBy: string | null;
  comments: BankPinComment[];
}

export interface BankCampaign {
  id: string;
  name: string;
  sub: string;
  type: CampaignType;
  status: Status;
  since: string;
  built: string;
  scheduled: Ymd | null;
  sent: Ymd | null;
  version: number;
  late: boolean;
  figmaUrl: string | null;
  openNotes: number;
  results: BankResults | null;
  assets: BankAsset[];
  pins: BankPin[];
  thread: BankComment[];
}

export interface BankResults {
  sentOn: string | null;
  subject: string | null;
  recipients: number | null;
  openRate: number | null;
  clickRate: number | null;
  opens: number | null;
  clicks: number | null;
  unsubscribes: number | null;
  revenue: number | null;
  conversions: number | null;
}

export interface BankDay {
  ymd: Ymd;
  day: number;
  wd: string;
  today: boolean;
  scheduled: { id: string; name: string }[];
  /** Items from the content calendar that are not one of the scheduled campaigns. They take the day. */
  planned: Planned[];
  blocked: string | null;
}

export interface BankPayload {
  workspace: { id: string; name: string; slug: string; logoUrl: string | null; timezone: string; windowDays: number; maxPerDay: number };
  role: Role;
  viewerName: string;
  today: Ymd;
  todayLong: string;
  days: BankDay[];
  campaigns: BankCampaign[];
}

export async function loadBank(workspace: Workspace, actor: Actor): Promise<BankPayload> {
  const tz = workspace.timezone;
  const today = todayYmd(tz);
  const [campaigns, blocks] = await Promise.all([
    db.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        assets: { orderBy: [{ version: 'asc' }, { orderIndex: 'asc' }] },
        comments: { orderBy: { createdAt: 'asc' } },
        pins: { orderBy: { number: 'asc' }, include: { comments: { orderBy: { createdAt: 'asc' } } } },
      },
    }),
    db.calendarBlock.findMany({ where: { workspaceId: workspace.id } }),
  ]);
  const [plannedRows, klaviyoRows] = await Promise.all([
    db.scheduleItem.findMany({ where: { workspaceId: workspace.id }, orderBy: { date: 'asc' } }),
    db.klaviyoCampaign.findMany({ where: { workspaceId: workspace.id, campaignId: { not: null }, status: { in: SENT_STATUSES } }, orderBy: { sendTime: 'desc' } }),
  ]);
  const resultsFor = new Map<string, BankResults>();
  for (const k of klaviyoRows) {
    if (!k.campaignId || resultsFor.has(k.campaignId)) continue;
    resultsFor.set(k.campaignId, { sentOn: k.sendTime ? fmtStamp(k.sendTime, tz) : null, subject: k.subject, recipients: k.recipients, openRate: k.openRate, clickRate: k.clickRate, opens: k.opens, clicks: k.clicks, unsubscribes: k.unsubscribes, revenue: k.revenue, conversions: k.conversions });
  }

  const isMine = (kind: string, id: string | null) => kind === actor.role && id === actor.id;
  const whoFor = (kind: string, name: string, id: string | null) => (isMine(kind, id) ? 'You' : kind === 'admin' ? (actor.role === 'admin' ? name : 'ECD') : kind === 'system' ? 'ECD' : name);

  const items: BankCampaign[] = campaigns.map((c) => {
    const current = c.assets.filter((a) => a.version === c.currentVersion);
    const byVersion = new Map<number, { url: string; name: string }[]>();
    for (const a of c.assets) {
      const list = byVersion.get(a.version) ?? [];
      list.push({ url: assetUrl(a.path)!, name: a.originalName || `File ${a.orderIndex + 1}` });
      byVersion.set(a.version, list);
    }
    const scheduled = c.scheduledDate ? dateToYmd(c.scheduledDate) : null;
    const emIndex = (assetId: string, version: number) => {
      const list = c.assets.filter((a) => a.version === version).sort((a, b) => a.orderIndex - b.orderIndex);
      return list.findIndex((a) => a.id === assetId) + 1;
    };
    const pins: BankPin[] = c.pins.map((p) => ({
      id: p.id,
      assetId: p.assetId,
      version: p.version,
      em: emIndex(p.assetId, p.version),
      number: p.number,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      status: p.status === 'resolved' ? 'resolved' : 'open',
      position: describePosition(p.x, p.y, p.w, p.h),
      cropUrl: assetUrl(p.cropPath),
      author: whoFor(p.authorKind, p.authorName, p.authorId),
      mine: isMine(p.authorKind, p.authorId),
      when: fmtStamp(p.createdAt, tz),
      resolvedBy: p.resolvedBy,
      comments: p.comments.map((m) => ({ id: m.id, who: whoFor(m.authorKind, m.authorName, m.authorId), you: isMine(m.authorKind, m.authorId) || (actor.role === 'admin' && m.authorKind === 'admin'), when: fmtStamp(m.createdAt, tz), body: m.body })),
    }));
    return {
      id: c.id,
      name: c.name,
      sub: c.subtitle,
      type: c.type as CampaignType,
      status: c.status as Status,
      since: fmtStamp(c.lastActivityAt, tz),
      built: fmtShort(dateToYmd(c.builtDate)),
      scheduled,
      sent: c.sentDate ? todayYmd(tz, c.sentDate) : null,
      version: c.currentVersion,
      late: c.status === 'scheduled' && !!scheduled && scheduled < today,
      figmaUrl: actor.role === 'admin' ? c.figmaUrl : null,
      openNotes: pins.filter((p) => p.status === 'open' && p.version === c.currentVersion).length,
      results: resultsFor.get(c.id) ?? null,
      assets: current.map((a) => ({
        id: a.id,
        kind: a.kind as 'image' | 'pdf',
        url: assetUrl(a.path)!,
        thumbUrl: assetUrl(a.thumbPath),
        width: a.width,
        height: a.height,
        name: a.originalName,
      })),
      pins,
      thread: c.comments.map((m) => ({
        id: m.id,
        who: whoFor(m.authorKind, m.authorName, m.authorId),
        you: isMine(m.authorKind, m.authorId) || (actor.role === 'admin' && m.authorKind === 'admin'),
        when: fmtStamp(m.createdAt, tz),
        body: m.body,
        kind: m.kind,
        pinNumber: m.pinNumber,
        files: m.version != null && m.version !== c.currentVersion ? (byVersion.get(m.version) ?? []) : [],
      })),
    };
  });

  const blockedBy = new Map(blocks.map((b) => [dateToYmd(b.date), b.label]));
  const days: BankDay[] = windowDates(today, workspace.windowDays).map((ymd) => {
    const scheduled = items.filter((i) => i.status === 'scheduled' && i.scheduled === ymd).map((i) => ({ id: i.id, name: i.name }));
    const planned = plannedRows.filter((p) => dateToYmd(p.date) === ymd).map((p) => ({ label: p.label, note: p.note }));
    return {
      ymd,
      day: dayOfMonth(ymd),
      wd: weekday2(ymd),
      today: ymd === today,
      scheduled,
      planned: unmatched(planned, scheduled.map((s) => s.name)),
      blocked: blockedBy.get(ymd) ?? null,
    };
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: assetUrl(workspace.logoPath),
      timezone: tz,
      windowDays: workspace.windowDays,
      maxPerDay: workspace.maxPerDay,
    },
    role: actor.role,
    viewerName: actor.name,
    today,
    todayLong: fmtLong(today),
    days,
    campaigns: items,
  };
}

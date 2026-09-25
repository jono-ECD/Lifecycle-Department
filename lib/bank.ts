// Builds the payload the bank page renders. Shared by the reviewer page, the admin page, polling and actions.
import type { Workspace } from '@prisma/client';
import { db } from '@/lib/db';
import { assetUrl } from '@/lib/uploads';
import { dateToYmd, fmtLong, fmtShort, fmtStamp, todayYmd, dayOfMonth, weekday2, type Ymd } from '@/lib/dates';
import { windowDates } from '@/lib/slots';
import type { Actor } from '@/lib/auth';
import type { CampaignType, Role, Status } from '@/lib/status';

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
  files: { url: string; name: string }[];
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
  assets: BankAsset[];
  thread: BankComment[];
}

export interface BankDay {
  ymd: Ymd;
  day: number;
  wd: string;
  today: boolean;
  scheduled: { id: string; name: string }[];
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
      include: { assets: { orderBy: [{ version: 'asc' }, { orderIndex: 'asc' }] }, comments: { orderBy: { createdAt: 'asc' } } },
    }),
    db.calendarBlock.findMany({ where: { workspaceId: workspace.id } }),
  ]);

  const items: BankCampaign[] = campaigns.map((c) => {
    const current = c.assets.filter((a) => a.version === c.currentVersion);
    const byVersion = new Map<number, { url: string; name: string }[]>();
    for (const a of c.assets) {
      const list = byVersion.get(a.version) ?? [];
      list.push({ url: assetUrl(a.path)!, name: a.originalName || `File ${a.orderIndex + 1}` });
      byVersion.set(a.version, list);
    }
    const scheduled = c.scheduledDate ? dateToYmd(c.scheduledDate) : null;
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
      assets: current.map((a) => ({
        id: a.id,
        kind: a.kind as 'image' | 'pdf',
        url: assetUrl(a.path)!,
        thumbUrl: assetUrl(a.thumbPath),
        width: a.width,
        height: a.height,
        name: a.originalName,
      })),
      thread: c.comments.map((m) => {
        const mine = actor.role === 'reviewer' ? m.authorKind === 'reviewer' && m.authorId === actor.id : false;
        const who = mine ? 'You' : m.authorKind === 'admin' ? (actor.role === 'admin' ? m.authorName : 'ECD') : m.authorKind === 'system' ? 'ECD' : m.authorName;
        return {
          id: m.id,
          who,
          you: mine || (actor.role === 'admin' && m.authorKind === 'admin'),
          when: fmtStamp(m.createdAt, tz),
          body: m.body,
          kind: m.kind,
          files: m.version != null && m.version !== c.currentVersion ? (byVersion.get(m.version) ?? []) : [],
        };
      }),
    };
  });

  const blockedBy = new Map(blocks.map((b) => [dateToYmd(b.date), b.label]));
  const days: BankDay[] = windowDates(today, workspace.windowDays).map((ymd) => ({
    ymd,
    day: dayOfMonth(ymd),
    wd: weekday2(ymd),
    today: ymd === today,
    scheduled: items.filter((i) => i.status === 'scheduled' && i.scheduled === ymd).map((i) => ({ id: i.id, name: i.name })),
    blocked: blockedBy.get(ymd) ?? null,
  }));

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

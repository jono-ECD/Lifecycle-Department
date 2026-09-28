// Admin side helpers shared by the admin API routes: campaign fields, versions, status overrides.
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { hashOf, storeSmsVersion, storeVersion, validateFile, type IncomingFile } from '@/lib/uploads';
import { getStorage } from '@/lib/storage';
import { checkSlot } from '@/lib/slots';
import { dateToYmd, isYmd, ymdToDate } from '@/lib/dates';
import { CHANNEL_KEYS, HOLDS_A_DAY, STATUS, STATUS_KEYS, TYPE_KEYS, VOIDED_BY_NEW_VERSION, type Status } from '@/lib/status';
import { notifyStatusChange } from '@/lib/notify';
import type { Actor } from '@/lib/auth';
import { emit } from '@/lib/integrations/dispatch';
import { payloadFor } from '@/lib/integrations/payload';
import { parseFigmaUrl } from '@/lib/integrations/figma';
import { slotInputFor } from '@/lib/schedule';
import { parseAsanaTaskUrl } from '@/lib/integrations/asana';

const optionalDate = (label: string) => z.string().refine((s) => !s || isYmd(s), `${label} must be a date.`).optional();

export const CampaignFields = z
  .object({
    name: z.string().trim().min(1, 'Give the campaign a name.').max(200),
    subtitle: z.string().trim().max(300).default(''),
    channel: z.enum(CHANNEL_KEYS as [string, ...string[]]).default('email'),
    smsBody: z.string().trim().max(1600).optional(),
    figmaUrl: z
      .string()
      .trim()
      .max(500)
      .refine((s) => !s || !!parseFigmaUrl(s), 'That does not look like a Figma link.')
      .optional(),
    asanaUrl: z
      .string()
      .trim()
      .max(500)
      .refine((s) => !s || !!parseAsanaTaskUrl(s), 'Paste the link to the Asana task.')
      .optional(),
    klaviyoCampaignId: z.string().trim().max(60).optional(),
    type: z.enum(TYPE_KEYS as [string, ...string[]]).default('promo'),
    builtDate: z.string().refine(isYmd, 'Built date must be a date.'),
    validFrom: optionalDate('Offer start'),
    validUntil: optionalDate('Offer end'),
    status: z.enum(STATUS_KEYS as [string, ...string[]]).default('draft'),
    scheduledDate: optionalDate('Send date'),
  })
  .refine((v) => !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil, { message: 'The offer cannot end before it starts.', path: ['validUntil'] });
export type CampaignFieldsInput = z.infer<typeof CampaignFields>;

/** Columns written from the editor fields. Status and versions are handled separately. */
export function campaignData(input: CampaignFieldsInput) {
  const figma = input.figmaUrl ? parseFigmaUrl(input.figmaUrl) : null;
  const asana = input.asanaUrl ? parseAsanaTaskUrl(input.asanaUrl) : null;
  return {
    name: input.name,
    subtitle: input.subtitle,
    channel: input.channel,
    type: input.type,
    builtDate: ymdToDate(input.builtDate),
    validFrom: input.validFrom ? ymdToDate(input.validFrom) : null,
    validUntil: input.validUntil ? ymdToDate(input.validUntil) : null,
    klaviyoCampaignId: input.klaviyoCampaignId || null,
    figmaUrl: input.figmaUrl || null,
    ...(figma ? { figmaFileKey: figma.fileKey, ...(figma.nodeId ? { figmaNodeId: figma.nodeId, figmaNodeIds: figma.nodeId } : {}) } : {}),
    asanaUrl: input.asanaUrl || null,
    asanaTaskGid: asana,
  };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/** Reads uploaded files from a multipart form. Order in the form is the order of the version. */
export async function filesFrom(form: FormData, field = 'files'): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  for (const v of form.getAll(field)) {
    if (!(v instanceof File) || v.size === 0) continue;
    validateFile({ name: v.name, type: v.type, size: v.size });
    out.push({ name: v.name, type: v.type, buffer: Buffer.from(await v.arrayBuffer()) });
  }
  return out;
}

export interface VersionResult {
  version: number;
  count: number;
  unchanged: boolean;
  reopened: boolean;
}

/**
 * Adds a new design version and records it in the thread.
 * An approval covers one version: when the campaign was approved, had a date requested, or had
 * changes requested, the new version sends it back to review.
 */
export async function addVersion(campaignId: string, input: { files?: IncomingFile[]; smsText?: string }, actor: Actor, opts: { skipUnchanged?: boolean; source?: string } = {}): Promise<VersionResult> {
  const files = input.files ?? [];
  const sms = (input.smsText ?? '').trim();
  if (files.length === 0 && !sms) throw new ApiError(400, 'Choose at least one file.');
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { assets: true } });

  const incoming = sms ? [hashOf(sms)] : files.map((f) => hashOf(f.buffer));
  const current = c.assets
    .filter((a) => a.version === c.currentVersion)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((a) => a.contentHash);
  if (opts.skipUnchanged && c.currentVersion > 0 && incoming.length === current.length && incoming.every((h, i) => h === current[i])) {
    return { version: c.currentVersion, count: 0, unchanged: true, reopened: false };
  }

  const version = c.currentVersion + 1;
  const assets = sms ? await storeSmsVersion(campaignId, version, sms, actor.name) : await storeVersion(campaignId, version, files, actor.name);
  const reopen = VOIDED_BY_NEW_VERSION.includes(c.status as Status);
  const now = new Date();
  const what = sms ? 'SMS copy' : `${files.length} file${files.length > 1 ? 's' : ''}`;
  const from = opts.source ? ` from ${opts.source}` : '';

  await db.$transaction([
    db.campaign.update({
      where: { id: campaignId },
      data: {
        currentVersion: version,
        lastActivityAt: now,
        ...(reopen ? { status: 'review', scheduledDate: null, approvedVersion: null, approvedBy: null, approvedAt: null, reviewEnteredAt: now, reviewNotifiedAt: null } : {}),
      },
    }),
    db.comment.create({
      data: {
        campaignId,
        authorKind: 'admin',
        authorName: actor.name,
        authorId: actor.id,
        kind: 'system',
        version,
        body: sms
          ? version === 1
            ? `SMS copy added${from}.`
            : `Version ${version} of the SMS copy${from}.`
          : version === 1
            ? `Design uploaded${from}, ${what}.`
            : `Version ${version} uploaded${from}, ${what}. Earlier versions stay linked here.`,
      },
    }),
    ...(reopen
      ? [
          db.comment.create({
            data: {
              campaignId,
              authorKind: 'admin',
              authorName: actor.name,
              authorId: actor.id,
              kind: 'status',
              fromStatus: c.status,
              toStatus: 'review',
              body: c.approvedVersion ? `The approval covered version ${c.approvedVersion}. Version ${version} is a new design, so it is back in review.` : `Version ${version} is ready for your review.`,
            },
          }),
        ]
      : []),
  ]);

  const payload = await payloadFor(campaignId, actor, 'version_uploaded');
  if (payload) await emit(payload);
  if (reopen) {
    await notifyStatusChange({ campaignId, workspaceId: c.workspaceId, actor, action: 'move_to_review', from: c.status as Status, to: 'review', note: '' });
    const moved = await payloadFor(campaignId, actor, 'moved_to_review');
    if (moved) await emit(moved);
  }
  return { version, count: assets.length, unchanged: false, reopened: reopen };
}

/**
 * Applies an admin override of the status from the editor. Admins can set any status; the thread records it.
 * Dates set through here still respect blocked days, the per day limit and the offer window.
 */
export async function applyAdminStatus(campaignId: string, actor: Actor, status: string, scheduledDate: string | undefined) {
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { workspace: true } });
  const holds = HOLDS_A_DAY.includes(status as Status);
  if (c.status === status && (!holds || (c.scheduledDate && dateToYmd(c.scheduledDate) === scheduledDate))) return;
  const now = new Date();
  const data: Parameters<typeof db.campaign.update>[0]['data'] = { status, lastActivityAt: now };
  if (holds) {
    if (!scheduledDate) throw new ApiError(400, 'Pick a send date for that status.');
    const check = checkSlot(await slotInputFor(c.workspace, c, 'admin'), scheduledDate);
    if (!check.ok) throw new ApiError(400, check.reason);
    data.scheduledDate = ymdToDate(scheduledDate);
  } else {
    data.scheduledDate = null;
  }
  if (status === 'sent') {
    if (!c.sentDate) data.sentDate = now;
  } else {
    data.sentDate = null;
  }
  if (status === 'review' && c.status !== 'review') {
    data.reviewEnteredAt = now;
    data.reviewNotifiedAt = null;
  }
  if (status === 'approved' && c.status !== 'approved' && !c.approvedVersion) Object.assign(data, { approvedVersion: c.currentVersion, approvedBy: `${actor.name} (ECD)`, approvedAt: now });
  if (['draft', 'review', 'changes'].includes(status)) Object.assign(data, { approvedVersion: null, approvedBy: null, approvedAt: null });
  await db.$transaction([
    db.campaign.update({ where: { id: c.id }, data }),
    db.comment.create({
      data: {
        campaignId: c.id,
        authorKind: 'admin',
        authorName: actor.name,
        authorId: actor.id,
        kind: 'status',
        fromStatus: c.status,
        toStatus: status,
        body: status === 'review' ? 'Ready for your review.' : `Status set to ${STATUS[status as keyof typeof STATUS]}.`,
      },
    }),
  ]);
  if (status === 'review' && c.status !== 'review') {
    await notifyStatusChange({ campaignId: c.id, workspaceId: c.workspaceId, actor, action: 'move_to_review', from: c.status as never, to: 'review', note: '' });
    const payload = await payloadFor(c.id, actor, 'moved_to_review');
    if (payload) await emit(payload);
  }
}

/** Removes a campaign and its files. */
export async function deleteCampaign(campaignId: string) {
  const assets = await db.campaignAsset.findMany({ where: { campaignId } });
  const storage = getStorage();
  for (const a of assets) {
    if (a.kind !== 'sms') await storage.delete(a.path).catch(() => {});
    if (a.thumbPath) await storage.delete(a.thumbPath).catch(() => {});
  }
  await db.campaign.delete({ where: { id: campaignId } });
}

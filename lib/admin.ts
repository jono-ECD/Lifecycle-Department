// Admin side helpers shared by the admin API routes: campaign fields, versions, status overrides.
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { storeVersion, validateFile, type IncomingFile } from '@/lib/uploads';
import { getStorage } from '@/lib/storage';
import { checkSlot } from '@/lib/slots';
import { dateToYmd, isYmd, todayYmd, ymdToDate } from '@/lib/dates';
import { STATUS, STATUS_KEYS, TYPE_KEYS } from '@/lib/status';
import { notifyStatusChange } from '@/lib/notify';
import type { Actor } from '@/lib/auth';
import { emit } from '@/lib/integrations/dispatch';
import { payloadFor } from '@/lib/integrations/payload';
import { parseFigmaUrl } from '@/lib/integrations/figma';
import { dayCounts } from '@/lib/schedule';

export const CampaignFields = z.object({
  name: z.string().trim().min(1, 'Give the campaign a name.').max(200),
  subtitle: z.string().trim().max(300).default(''),
  figmaUrl: z
    .string()
    .trim()
    .max(500)
    .refine((s) => !s || !!parseFigmaUrl(s), 'That does not look like a Figma link.')
    .optional(),
  type: z.enum(TYPE_KEYS as [string, ...string[]]).default('promo'),
  builtDate: z.string().refine(isYmd, 'Built date must be a date.'),
  status: z.enum(STATUS_KEYS as [string, ...string[]]).default('draft'),
  scheduledDate: z.string().refine((s) => !s || isYmd(s), 'Send date must be a date.').optional(),
});
export type CampaignFieldsInput = z.infer<typeof CampaignFields>;

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

/** Adds a new version of assets to a campaign and records it in the thread. */
export async function addVersion(campaignId: string, files: IncomingFile[], actor: Actor) {
  if (files.length === 0) throw new ApiError(400, 'Choose at least one file.');
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const version = c.currentVersion + 1;
  const assets = await storeVersion(campaignId, version, files, actor.name);
  await db.$transaction([
    db.campaign.update({ where: { id: campaignId }, data: { currentVersion: version, lastActivityAt: new Date() } }),
    db.comment.create({
      data: {
        campaignId,
        authorKind: 'admin',
        authorName: actor.name,
        authorId: actor.id,
        kind: 'system',
        version,
        body: version === 1 ? `Design uploaded, ${files.length} file${files.length > 1 ? 's' : ''}.` : `Version ${version} uploaded, ${files.length} file${files.length > 1 ? 's' : ''}. Earlier versions stay linked here.`,
      },
    }),
  ]);
  const payload = await payloadFor(campaignId, actor, 'version_uploaded');
  if (payload) await emit(payload);
  return { version, assets };
}

/**
 * Applies an admin override of the status from the editor. Admins can set any status; the thread records it.
 * Scheduling through here still respects blocked days and the per day limit.
 */
export async function applyAdminStatus(campaignId: string, actor: Actor, status: string, scheduledDate: string | undefined) {
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { workspace: true } });
  if (c.status === status && (status !== 'scheduled' || (c.scheduledDate && dateToYmd(c.scheduledDate) === scheduledDate))) return;
  const now = new Date();
  const data: Parameters<typeof db.campaign.update>[0]['data'] = { status, lastActivityAt: now };
  if (status === 'scheduled') {
    if (!scheduledDate) throw new ApiError(400, 'Pick a send date for a scheduled campaign.');
    const ws = c.workspace;
    const [counts, blocks] = await Promise.all([dayCounts(ws.id, c.id), db.calendarBlock.findMany({ where: { workspaceId: ws.id }, select: { date: true } })]);
    const check = checkSlot({ today: todayYmd(ws.timezone), windowDays: ws.windowDays, maxPerDay: ws.maxPerDay, counts, blocked: blocks.map((b) => dateToYmd(b.date)), role: 'admin' }, scheduledDate);
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
    await storage.delete(a.path).catch(() => {});
    if (a.thumbPath) await storage.delete(a.thumbPath).catch(() => {});
  }
  await db.campaign.delete({ where: { id: campaignId } });
}

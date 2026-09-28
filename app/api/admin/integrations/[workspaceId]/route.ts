import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor, requireFullAdminActor } from '@/lib/api';
import { isSlackWebhook } from '@/lib/integrations/slack';
import { envStatus } from '@/lib/integrations/env';
import { toCsvUrl } from '@/lib/integrations/sheet';
import { STAGE_KEYS } from '@/lib/integrations/asanaStage';
import { feedUrl } from '@/lib/integrations/sheetTab';
import { encryptSecret, hintFor } from '@/lib/secrets';
import { newToken } from '@/lib/tokens';

type Ctx = { params: Promise<{ workspaceId: string }> };

const empty = z.literal('').transform(() => null);
const text = (max: number) => z.union([empty, z.string().trim().max(max)]);
const gid = (msg: string) => z.union([empty, z.string().trim().regex(/^\d{6,}$/, msg)]);
const Body = z.object({
  slackWebhookUrl: z.union([empty, z.string().trim().refine(isSlackWebhook, 'Paste the incoming webhook URL from Slack, it starts with https://hooks.slack.com/services/.')]),
  slackQuietUpdates: z.boolean().default(false),
  asanaProjectGid: gid('The project GID is the long number in the Asana project URL.'),
  asanaSectionGid: gid('The section GID is a long number.'),
  asanaAssigneeEmail: z.union([empty, z.string().trim().email('Add a valid email.')]),
  asanaStageFieldGid: gid('Pick the Stage field from the list.').default(''),
  // partial: a mapping may name only some stages. A plain record keyed by an enum would require all six.
  asanaStageMap: z.partialRecord(z.enum(STAGE_KEYS as [string, ...string[]]), z.string().regex(/^\d*$/)).default({}),
  figmaFileKey: z.union([empty, z.string().trim().regex(/^[A-Za-z0-9]{10,}$/, 'The file key is the part of the Figma URL after /design/ or /file/.')]),
  webhookUrl: z.union([empty, z.string().trim().url('Add a full https URL.').refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), 'Use https.')]),
  webhookSecret: z.union([empty, z.string().trim().min(8, 'Use at least 8 characters.').max(200)]),
  sheetUrl: z.union([empty, z.string().trim().max(600).refine((u) => !!toCsvUrl(u), 'Paste the link to the Google Sheet, or any https link that returns CSV.')]).default(''),
  sheetDateColumn: text(80).default(''),
  sheetNameColumn: text(80).default(''),
  sheetFilterColumn: text(80).default(''),
  sheetFilterValue: text(120).default(''),
  googleSheetId: z.union([empty, z.string().trim().regex(/^[A-Za-z0-9_-]{20,}$/, 'The sheet id is the long part of the Google Sheets URL after /d/.')]).default(''),
  googleSheetTab: text(80).default(''),
  // write only: empty keeps the stored key, "remove" clears it
  klaviyoKey: z.string().trim().max(200).default(''),
  feed: z.enum(['keep', 'create', 'remove']).default('keep'),
});

function publicConfig<T extends { klaviyoKeyEnc: string | null; feedToken: string | null }>(cfg: T | null) {
  if (!cfg) return null;
  const { klaviyoKeyEnc, feedToken, ...rest } = cfg;
  return { ...rest, klaviyoConnected: !!klaviyoKeyEnc, feedUrl: feedToken ? feedUrl(feedToken) : null };
}

export const GET = handler(async (_req, ctx: Ctx) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const events = await db.integrationEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 40 });
  return json({ config: publicConfig(cfg), env: envStatus(), events });
});

export const PATCH = handler(async (req, ctx: Ctx) => {
  await requireFullAdminActor();
  const { workspaceId } = await ctx.params;
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const { klaviyoKey, feed, asanaStageMap, ...input } = await parseBody(req, Body);
  const prev = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const map = Object.fromEntries(Object.entries(asanaStageMap).filter(([, v]) => v));
  const data: Record<string, unknown> = { ...input, asanaStageMap: Object.keys(map).length ? JSON.stringify(map) : null };
  if (klaviyoKey === 'remove') Object.assign(data, { klaviyoKeyEnc: null, klaviyoKeyHint: null, klaviyoMetricId: null, klaviyoSyncedAt: null, klaviyoError: null });
  else if (klaviyoKey) {
    if (!/^pk_[A-Za-z0-9]{10,}$/.test(klaviyoKey)) throw new ApiError(400, 'Klaviyo private keys start with pk_. Find it in Klaviyo under Settings, API keys.');
    Object.assign(data, { klaviyoKeyEnc: encryptSecret(klaviyoKey), klaviyoKeyHint: hintFor(klaviyoKey), klaviyoMetricId: null, klaviyoSyncedAt: null, klaviyoError: null });
  }
  if (feed === 'create') data.feedToken = newToken();
  if (feed === 'remove') data.feedToken = null;
  // a new project or section starts from a clean cursor, so every task is read once
  if (prev && ((prev.asanaProjectGid ?? null) !== (input.asanaProjectGid ?? null) || (prev.asanaSectionGid ?? null) !== (input.asanaSectionGid ?? null))) Object.assign(data, { asanaPullSince: null, asanaPulledAt: null, asanaPullError: null });
  // a new sheet link or new columns means the stored items are stale until the next sync
  if (prev && (prev.sheetUrl ?? null) !== (input.sheetUrl ?? null)) Object.assign(data, { sheetSyncedAt: null, sheetError: null });
  if (!input.sheetUrl) {
    await db.scheduleItem.deleteMany({ where: { workspaceId, source: 'sheet' } });
    Object.assign(data, { sheetCount: 0, sheetSyncedAt: null, sheetError: null });
  }
  const cfg = await db.workspaceIntegration.upsert({ where: { workspaceId }, update: data, create: { workspaceId, ...data } });
  return json({ config: publicConfig(cfg) });
});

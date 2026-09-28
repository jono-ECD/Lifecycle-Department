import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { isSlackWebhook } from '@/lib/integrations/slack';
import { envStatus } from '@/lib/integrations/env';
import { toCsvUrl } from '@/lib/integrations/sheet';
import { encryptSecret, hintFor } from '@/lib/secrets';

type Ctx = { params: Promise<{ workspaceId: string }> };

const empty = z.literal('').transform(() => null);
const text = (max: number) => z.union([empty, z.string().trim().max(max)]);
const Body = z.object({
  slackWebhookUrl: z.union([empty, z.string().trim().refine(isSlackWebhook, 'Paste the incoming webhook URL from Slack, it starts with https://hooks.slack.com/services/.')]),
  slackQuietUpdates: z.boolean().default(false),
  asanaProjectGid: z.union([empty, z.string().trim().regex(/^\d{6,}$/, 'The project GID is the long number in the Asana project URL.')]),
  asanaSectionGid: z.union([empty, z.string().trim().regex(/^\d{6,}$/, 'The section GID is a long number.')]),
  asanaAssigneeEmail: z.union([empty, z.string().trim().email('Add a valid email.')]),
  figmaFileKey: z.union([empty, z.string().trim().regex(/^[A-Za-z0-9]{10,}$/, 'The file key is the part of the Figma URL after /design/ or /file/.')]),
  webhookUrl: z.union([empty, z.string().trim().url('Add a full https URL.').refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), 'Use https.')]),
  webhookSecret: z.union([empty, z.string().trim().min(8, 'Use at least 8 characters.').max(200)]),
  sheetUrl: z.union([empty, z.string().trim().max(600).refine((u) => !!toCsvUrl(u), 'Paste the link to the Google Sheet, or any https link that returns CSV.')]).default(''),
  sheetDateColumn: text(80).default(''),
  sheetNameColumn: text(80).default(''),
  sheetFilterColumn: text(80).default(''),
  sheetFilterValue: text(120).default(''),
  // write only: empty keeps the stored key, "remove" clears it
  klaviyoKey: z.string().trim().max(200).default(''),
});

function publicConfig<T extends { klaviyoKeyEnc: string | null; webhookSecret: string | null }>(cfg: T | null) {
  if (!cfg) return null;
  const { klaviyoKeyEnc, ...rest } = cfg;
  return { ...rest, klaviyoConnected: !!klaviyoKeyEnc };
}

export const GET = handler(async (_req, ctx: Ctx) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const events = await db.integrationEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 40 });
  return json({ config: publicConfig(cfg), env: envStatus(), events });
});

export const PATCH = handler(async (req, ctx: Ctx) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const { klaviyoKey, ...input } = await parseBody(req, Body);
  const prev = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const data: Record<string, unknown> = { ...input };
  if (klaviyoKey === 'remove') Object.assign(data, { klaviyoKeyEnc: null, klaviyoKeyHint: null, klaviyoMetricId: null, klaviyoSyncedAt: null, klaviyoError: null });
  else if (klaviyoKey) {
    if (!/^pk_[A-Za-z0-9]{10,}$/.test(klaviyoKey)) throw new ApiError(400, 'Klaviyo private keys start with pk_. Find it in Klaviyo under Settings, API keys.');
    Object.assign(data, { klaviyoKeyEnc: encryptSecret(klaviyoKey), klaviyoKeyHint: hintFor(klaviyoKey), klaviyoMetricId: null, klaviyoSyncedAt: null, klaviyoError: null });
  }
  // a new sheet link or new columns means the stored items are stale until the next sync
  if (prev && (prev.sheetUrl ?? null) !== (input.sheetUrl ?? null)) Object.assign(data, { sheetSyncedAt: null, sheetError: null });
  if (!input.sheetUrl) {
    await db.scheduleItem.deleteMany({ where: { workspaceId, source: 'sheet' } });
    Object.assign(data, { sheetCount: 0, sheetSyncedAt: null, sheetError: null });
  }
  const cfg = await db.workspaceIntegration.upsert({ where: { workspaceId }, update: data, create: { workspaceId, ...data } });
  return json({ config: publicConfig(cfg) });
});

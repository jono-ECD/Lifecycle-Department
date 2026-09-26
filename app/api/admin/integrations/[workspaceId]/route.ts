import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { isSlackWebhook } from '@/lib/integrations/slack';
import { envStatus } from '@/lib/integrations/env';

type Ctx = { params: Promise<{ workspaceId: string }> };

const empty = z.literal('').transform(() => null);
const Body = z.object({
  slackWebhookUrl: z.union([empty, z.string().trim().refine(isSlackWebhook, 'Paste the incoming webhook URL from Slack, it starts with https://hooks.slack.com/services/.')]),
  slackQuietUpdates: z.boolean().default(false),
  asanaProjectGid: z.union([empty, z.string().trim().regex(/^\d{6,}$/, 'The project GID is the long number in the Asana project URL.')]),
  asanaSectionGid: z.union([empty, z.string().trim().regex(/^\d{6,}$/, 'The section GID is a long number.')]),
  asanaAssigneeEmail: z.union([empty, z.string().trim().email('Add a valid email.')]),
  figmaFileKey: z.union([empty, z.string().trim().regex(/^[A-Za-z0-9]{10,}$/, 'The file key is the part of the Figma URL after /design/ or /file/.')]),
  webhookUrl: z.union([empty, z.string().trim().url('Add a full https URL.').refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), 'Use https.')]),
  webhookSecret: z.union([empty, z.string().trim().min(8, 'Use at least 8 characters.').max(200)]),
});

export const GET = handler(async (_req, ctx: Ctx) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const events = await db.integrationEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 40 });
  return json({ config: cfg, env: envStatus(), events });
});

export const PATCH = handler(async (req, ctx: Ctx) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const input = await parseBody(req, Body);
  const cfg = await db.workspaceIntegration.upsert({ where: { workspaceId }, update: input, create: { workspaceId, ...input } });
  return json({ config: cfg });
});

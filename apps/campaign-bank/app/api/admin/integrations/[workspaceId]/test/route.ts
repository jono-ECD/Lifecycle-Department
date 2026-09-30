import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { env } from '@/lib/env';
import { postSlack } from '@/lib/integrations/slack';
import { AsanaClient } from '@/lib/integrations/asana';
import { FigmaClient } from '@/lib/integrations/figma';
import { postWebhook } from '@/lib/integrations/webhook';
import type { EventPayload } from '@/lib/integrations/types';

const Body = z.object({ target: z.enum(['slack', 'asana', 'figma', 'webhook']) });

// Checks a connection without creating anything in the other tool, except a test message in Slack or the webhook.
export const POST = handler(async (req, ctx: { params: Promise<{ workspaceId: string }> }) => {
  const actor = await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const { target } = await parseBody(req, Body);
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { integration: true } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const cfg = ws.integration;
  switch (target) {
    case 'slack': {
      if (!cfg?.slackWebhookUrl) throw new ApiError(400, 'Save a Slack webhook first.');
      await postSlack(cfg.slackWebhookUrl, {
        text: `Campaign Bank is connected to ${ws.name}.`,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `Campaign Bank is connected to *${ws.name}*. Client notes and change requests will land here.` } }],
      });
      return json({ ok: true, message: 'Test message posted to Slack.' });
    }
    case 'asana': {
      const token = env('ASANA_ACCESS_TOKEN');
      if (!token) throw new ApiError(400, 'ASANA_ACCESS_TOKEN is not set in the environment.');
      if (!cfg?.asanaProjectGid) throw new ApiError(400, 'Save an Asana project GID first.');
      const asana = new AsanaClient(token);
      const me = await asana.me();
      const project = await asana.project(cfg.asanaProjectGid);
      return json({ ok: true, message: `Connected as ${me.name}. Tasks will go to "${project.name}".` });
    }
    case 'figma': {
      const token = env('FIGMA_ACCESS_TOKEN');
      if (!token) throw new ApiError(400, 'FIGMA_ACCESS_TOKEN is not set in the environment.');
      if (!cfg?.figmaFileKey) throw new ApiError(400, 'Save a Figma file key first.');
      const frames = await new FigmaClient(token).frames(cfg.figmaFileKey);
      return json({ ok: true, message: `Figma file reachable. ${frames.length} frame${frames.length === 1 ? '' : 's'} on the first page${frames.length ? `: ${frames.slice(0, 5).map((f) => f.name).join(', ')}` : ''}.` });
    }
    case 'webhook': {
      if (!cfg?.webhookUrl) throw new ApiError(400, 'Save a webhook URL first.');
      const payload: EventPayload = {
        type: 'comment',
        workspace: { id: ws.id, name: ws.name, slug: ws.slug },
        campaign: { id: 'test', name: 'Test campaign', subtitle: '', status: 'review', version: 1 },
        actor: { role: 'admin', name: actor.name },
        text: 'This is a test delivery from the Campaign Bank.',
        links: { admin: env('APP_URL', 'http://localhost:3000'), reviewer: env('APP_URL', 'http://localhost:3000') },
        at: new Date().toISOString(),
      };
      await postWebhook(cfg.webhookUrl, cfg.webhookSecret, 'test', payload);
      return json({ ok: true, message: 'Test delivery accepted by the webhook.' });
    }
  }
});

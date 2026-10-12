import { z } from 'zod';
import { db } from '@/lib/db';
import { handler, json, parseBody, requireActor } from '@/lib/api';
import { deletePin, movePin, replyPin, resolvePin } from '@/lib/pins';
import { loadBank } from '@/lib/bank';

type Ctx = { params: Promise<{ id: string }> };

async function bankFor(campaignId: string, actor: Awaited<ReturnType<typeof requireActor>>) {
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { workspace: true } });
  return loadBank(c.workspace, actor);
}

const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('reply'), body: z.string().trim().min(1, 'Write the reply first.').max(4000) }),
  z.object({ op: z.literal('resolve'), resolved: z.boolean() }),
  z.object({ op: z.literal('move'), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
]);

// Reply, mark done or reopen (ECD only), or move a pinned note.
export const POST = handler(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const input = await parseBody(req, Body);
  let campaignId: string;
  let toast: string;
  if (input.op === 'reply') {
    ({ campaignId } = await replyPin(id, actor, input.body));
    toast = 'Reply added.';
  } else if (input.op === 'resolve') {
    ({ campaignId } = await resolvePin(id, actor, input.resolved));
    toast = input.resolved ? 'Marked as done.' : 'Note reopened.';
  } else {
    ({ campaignId } = await movePin(id, actor, input.x, input.y));
    toast = 'Note moved.';
  }
  return json({ toast, bank: await bankFor(campaignId, actor) });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const { campaignId } = await deletePin(id, actor);
  return json({ toast: 'Note removed.', bank: await bankFor(campaignId, actor) });
});

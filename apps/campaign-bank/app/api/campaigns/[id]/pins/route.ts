import { z } from 'zod';
import { db } from '@/lib/db';
import { handler, json, parseBody, requireActor } from '@/lib/api';
import { createPin } from '@/lib/pins';
import { loadBank } from '@/lib/bank';

const Body = z.object({
  assetId: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1).nullable().optional(),
  h: z.number().min(0).max(1).nullable().optional(),
  body: z.string().trim().min(1, 'Write the note first.').max(4000),
});

// Pin a note on a design.
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const input = await parseBody(req, Body);
  const thread = await createPin(id, actor, input);
  const c = await db.campaign.findUniqueOrThrow({ where: { id }, include: { workspace: true } });
  return json({ toast: 'Note pinned. ECD will see it.', threadId: thread.id, bank: await loadBank(c.workspace, actor) });
});

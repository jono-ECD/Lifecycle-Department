import { z } from 'zod';
import { db } from '@/lib/db';
import { handler, json, parseBody, requireActor } from '@/lib/api';
import { addComment } from '@/lib/actions';
import { loadBank } from '@/lib/bank';

const Body = z.object({ body: z.string().trim().min(1, 'Write a note first.').max(4000) });

export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const { body } = await parseBody(req, Body);
  const { workspaceId } = await addComment(id, actor, body);
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  return json({ toast: 'Note sent to ECD.', bank: await loadBank(ws, actor) });
});

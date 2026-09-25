import { z } from 'zod';
import { db } from '@/lib/db';
import { handler, json, parseBody, requireActor } from '@/lib/api';
import { performAction } from '@/lib/actions';
import { loadBank } from '@/lib/bank';

const Body = z.object({
  action: z.enum(['approve', 'request_changes', 'hold', 'back_to_review', 'schedule', 'unschedule', 'move_to_review', 'mark_sent', 'move_date', 'reopen']),
  note: z.string().max(4000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick an open slot.').optional(),
});

export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const body = await parseBody(req, Body);
  const { toast, workspaceId } = await performAction(id, actor, body);
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  return json({ toast, bank: await loadBank(ws, actor) });
});

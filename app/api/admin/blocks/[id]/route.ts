import { db } from '@/lib/db';
import { ApiError, handler, json, requireAdminActor } from '@/lib/api';

export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const b = await db.calendarBlock.findUnique({ where: { id } });
  if (!b) throw new ApiError(404, 'Block not found.');
  await db.calendarBlock.delete({ where: { id } });
  return json({ ok: true });
});

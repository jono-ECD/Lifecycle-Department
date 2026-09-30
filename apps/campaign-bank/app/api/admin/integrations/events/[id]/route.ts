import { db } from '@/lib/db';
import { ApiError, handler, json, requireAdminActor } from '@/lib/api';
import { retryEvent } from '@/lib/integrations/dispatch';

// Retry one delivery from the log.
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const ev = await db.integrationEvent.findUnique({ where: { id } });
  if (!ev) throw new ApiError(404, 'Delivery not found.');
  await retryEvent(id);
  const after = await db.integrationEvent.findUniqueOrThrow({ where: { id } });
  return json({ event: after });
});

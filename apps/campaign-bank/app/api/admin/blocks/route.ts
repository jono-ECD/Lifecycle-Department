import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { isYmd, ymdToDate } from '@/lib/dates';

const Body = z.object({
  workspaceId: z.string().min(1),
  date: z.string().refine(isYmd, 'Pick a date.'),
  label: z.string().trim().min(1, 'Say why the day is blocked.').max(120),
});

// Block a day in the send window for reasons outside the app.
export const POST = handler(async (req) => {
  const actor = await requireAdminActor();
  const input = await parseBody(req, Body);
  const ws = await db.workspace.findUnique({ where: { id: input.workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const date = ymdToDate(input.date);
  const b = await db.calendarBlock.upsert({
    where: { workspaceId_date: { workspaceId: ws.id, date } },
    update: { label: input.label },
    create: { workspaceId: ws.id, date, label: input.label, createdBy: actor.name },
  });
  return json({ id: b.id });
});

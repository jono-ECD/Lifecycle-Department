import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { addDays, dateToYmd, isYmd, ymdToDate } from '@/lib/dates';

const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('open'), workspaceId: z.string().min(1), date: z.string().refine(isYmd, 'Pick a date.'), capacity: z.coerce.number().int().min(1).max(5).default(1) }),
  z.object({ op: z.literal('close'), workspaceId: z.string().min(1), date: z.string().refine(isYmd, 'Pick a date.') }),
  // open the same weekdays for a number of weeks, the usual cadence
  z.object({ op: z.literal('cadence'), workspaceId: z.string().min(1), from: z.string().refine(isYmd, 'Pick a start date.'), weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one weekday.'), weeks: z.coerce.number().int().min(1).max(26) }),
]);

// Send days ECD makes available, for workspaces that list their slots. Capacity follows cadence and deliverability.
export const POST = handler(async (req) => {
  await requireAdminActor();
  const input = await parseBody(req, Body);
  const ws = await db.workspace.findUnique({ where: { id: input.workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  if (input.op === 'open') {
    const date = ymdToDate(input.date);
    await db.openSlot.upsert({ where: { workspaceId_date: { workspaceId: ws.id, date } }, update: { capacity: input.capacity }, create: { workspaceId: ws.id, date, capacity: input.capacity } });
  } else if (input.op === 'close') {
    await db.openSlot.deleteMany({ where: { workspaceId: ws.id, date: ymdToDate(input.date) } });
  } else {
    for (let i = 0; i < input.weeks * 7; i++) {
      const ymd = addDays(input.from, i);
      const date = ymdToDate(ymd);
      if (!input.weekdays.includes(date.getUTCDay())) continue;
      await db.openSlot.upsert({ where: { workspaceId_date: { workspaceId: ws.id, date } }, update: {}, create: { workspaceId: ws.id, date } });
    }
  }
  const slots = await db.openSlot.findMany({ where: { workspaceId: ws.id }, orderBy: { date: 'asc' } });
  return json({ slots: slots.map((s) => ({ date: dateToYmd(s.date), capacity: s.capacity })) });
});

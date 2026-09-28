import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { syncKlaviyo, syncSheet } from '@/lib/integrations/sync';
import { dateToYmd, fmtShort } from '@/lib/dates';

const Body = z.object({ target: z.enum(['sheet', 'klaviyo']) });

// "Sync now" for the content calendar and for Klaviyo. Doubles as the connection test.
export const POST = handler(async (req, ctx: { params: Promise<{ workspaceId: string }> }) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const { target } = await parseBody(req, Body);
  try {
    if (target === 'sheet') {
      const r = await syncSheet(workspaceId);
      const next = await db.scheduleItem.findMany({ where: { workspaceId, date: { gte: new Date(Date.now() - 86400000) } }, orderBy: { date: 'asc' }, take: 6 });
      return json({
        ok: true,
        message: `Read ${r.count} item${r.count === 1 ? '' : 's'} using the "${r.dateColumn}" and "${r.nameColumn}" columns.`,
        preview: next.map((i) => ({ date: fmtShort(dateToYmd(i.date)), label: i.label })),
      });
    }
    const r = await syncKlaviyo(workspaceId);
    return json({ ok: true, message: `Found ${r.campaigns} email campaign${r.campaigns === 1 ? '' : 's'}, ${r.sent} sent, ${r.linked} matched to campaigns in the bank.` });
  } catch (err) {
    throw new ApiError(400, (err as Error).message);
  }
});

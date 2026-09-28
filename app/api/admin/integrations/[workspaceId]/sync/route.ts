import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { env } from '@/lib/env';
import { syncFigma, syncKlaviyo, syncSheet } from '@/lib/integrations/sync';
import { pullAsana } from '@/lib/integrations/asanaSync';
import { pushSheetTab } from '@/lib/integrations/sheetTab';
import { AsanaClient, guessStageMap } from '@/lib/integrations/asana';
import { dateToYmd, fmtShort } from '@/lib/dates';

const Body = z.object({ target: z.enum(['sheet', 'klaviyo', 'asana', 'asana_fields', 'sheet_tab', 'figma']) });

const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Sync now" for each connection. Doubles as the connection test.
export const POST = handler(async (req, ctx: { params: Promise<{ workspaceId: string }> }) => {
  await requireAdminActor();
  const { workspaceId } = await ctx.params;
  const { target } = await parseBody(req, Body);
  try {
    switch (target) {
      case 'sheet': {
        const r = await syncSheet(workspaceId);
        const next = await db.scheduleItem.findMany({ where: { workspaceId, date: { gte: new Date(Date.now() - 86400000) } }, orderBy: { date: 'asc' }, take: 6 });
        const how = r.dateColumn === 'month grid' ? 'from the month grid' : `using the "${r.dateColumn}" and "${r.nameColumn}" columns`;
        return json({ ok: true, message: `Read ${s(r.count, 'item')} ${how}.`, preview: next.map((i) => ({ date: fmtShort(dateToYmd(i.date)), label: i.label })) });
      }
      case 'klaviyo': {
        const r = await syncKlaviyo(workspaceId);
        return json({ ok: true, message: `Found ${s(r.campaigns, 'email campaign')}, ${r.sent} sent, ${r.linked} matched to campaigns in the bank${r.advanced ? `, ${r.advanced} moved to match Klaviyo` : ''}.` });
      }
      case 'asana': {
        const r = await pullAsana(workspaceId);
        return json({ ok: true, message: `Read ${s(r.seen, 'task')}: ${r.created} new, ${r.updated} updated, ${r.moved} moved by Stage${r.problems ? `, ${s(r.problems, 'problem')} listed below` : ''}.` });
      }
      case 'asana_fields': {
        const token = env('ASANA_ACCESS_TOKEN');
        const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
        if (!token) throw new Error('ASANA_ACCESS_TOKEN is not set in the environment.');
        if (!cfg?.asanaProjectGid) throw new Error('Save the Asana project first.');
        const fields = await new AsanaClient(token).enumFields(cfg.asanaProjectGid);
        const names = fields.map((f) => f.name.trim().toLowerCase());
        const twins = fields.filter((f, i) => names.indexOf(f.name.trim().toLowerCase()) !== i).map((f) => f.name);
        const stage = fields.find((f) => f.gid === cfg.asanaStageFieldGid) ?? fields.find((f) => /^stage$/i.test(f.name.trim()));
        return json({
          ok: true,
          fields,
          guess: stage ? { fieldGid: stage.gid, map: guessStageMap(stage) } : null,
          message: twins.length ? `Two fields are named "${twins[0]}". Pick one by its id; the Bank binds to the id, never the name.` : `Found ${s(fields.length, 'dropdown field')}.`,
        });
      }
      case 'sheet_tab': {
        const rows = await pushSheetTab(workspaceId);
        return json({ ok: true, message: `Campaign Bank tab rewritten with ${s(rows, 'campaign')}.` });
      }
      case 'figma': {
        const r = await syncFigma(workspaceId);
        return json({ ok: true, message: `Checked ${s(r.checked, 'campaign')}, ${r.updated} had a new design.` });
      }
    }
  } catch (err) {
    throw new ApiError(400, (err as Error).message);
  }
});

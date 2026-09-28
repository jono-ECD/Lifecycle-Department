import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tabRows, toCsv } from '@/lib/integrations/sheetTab';

// Read only CSV of the bank for one client. A Google Sheet pulls it into its own "Campaign Bank" tab
// with =IMPORTDATA("<this link>"). The token is the only key; regenerate it in Connections to cut access.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const clean = token.replace(/\.csv$/i, '');
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(clean)) return new NextResponse('Not found', { status: 404 });
  const cfg = await db.workspaceIntegration.findFirst({ where: { feedToken: clean } });
  if (!cfg) return new NextResponse('Not found', { status: 404 });
  const csv = toCsv(await tabRows(cfg.workspaceId));
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="campaign-bank.csv"' } });
}

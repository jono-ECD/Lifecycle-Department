import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { flushAllDigests, sendReminders } from '@/lib/notify/events';
import { deliverPending } from '@/lib/integrations/dispatch';
import { syncDue } from '@/lib/integrations/sync';

// Hit this once an hour (or at least once a day after 9:00 workspace time). Protected by CRON_SECRET.
async function run(req: Request) {
  const secret = env('CRON_SECRET');
  const url = new URL(req.url);
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret') || '';
  if (!secret || given !== secret) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });
  const digests = await flushAllDigests(url.searchParams.get('force') === '1');
  const reminders = await sendReminders();
  const deliveries = await deliverPending();
  const synced = await syncDue();
  return NextResponse.json({ ok: true, digests, reminders, deliveries, synced });
}

export const GET = run;
export const POST = run;

// Runs once when the Next server starts. With RUN_SCHEDULER=1 it calls the cron endpoint every
// 15 minutes, for hosts without an external cron. It goes over HTTP on purpose: this file is compiled
// for every runtime, so it must not import the mailer or image libraries.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.RUN_SCHEDULER !== '1') return;
  const base = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const secret = process.env.CRON_SECRET || '';
  const tick = async () => {
    try {
      const r = await fetch(`${base}/api/cron/reminders`, { headers: { Authorization: `Bearer ${secret}` } });
      const j = (await r.json().catch(() => ({}))) as { digests?: number; reminders?: number };
      if (j.digests || j.reminders) console.log(`[scheduler] digests ${j.digests}, reminders ${j.reminders}`);
    } catch (err) {
      console.error('[scheduler] failed:', (err as Error).message);
    }
  };
  setTimeout(tick, 10_000).unref();
  setInterval(tick, 15 * 60 * 1000).unref();
  console.log('[scheduler] running every 15 minutes');
}

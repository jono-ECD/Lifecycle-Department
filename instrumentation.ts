// Runs once when the Next server starts. With RUN_SCHEDULER=1 it flushes review digests and sends
// reminders every 15 minutes in process, for hosts without an external cron.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.RUN_SCHEDULER !== '1') return;
  const { flushAllDigests, sendReminders } = await import('./lib/notify/events');
  const tick = async () => {
    try {
      const d = await flushAllDigests();
      const r = await sendReminders();
      if (d || r) console.log(`[scheduler] digests ${d}, reminders ${r}`);
    } catch (err) {
      console.error('[scheduler] failed:', err);
    }
  };
  setTimeout(tick, 5000).unref();
  setInterval(tick, 15 * 60 * 1000).unref();
  console.log('[scheduler] running every 15 minutes');
}

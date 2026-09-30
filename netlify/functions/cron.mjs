// Netlify runs this every five minutes on the published site. It calls the app's own cron endpoint,
// which pulls Asana, checks Figma, reads the calendar, refreshes Klaviyo, sends reminders and
// retries deliveries. Nothing runs twice; each job inside keeps its own pace.
const cron = async () => {
  const base = (process.env.APP_URL || process.env.URL || '').replace(/\/$/, '');
  const secret = process.env.CRON_SECRET || '';
  if (!base || !secret) {
    console.error('[cron] APP_URL or CRON_SECRET is not set');
    return;
  }
  const r = await fetch(`${base}/api/cron/reminders`, { headers: { Authorization: `Bearer ${secret}` } });
  const body = await r.text().catch(() => '');
  console.log(`[cron] ${r.status} ${body.slice(0, 300)}`);
};

export default cron;
export const config = { schedule: '*/5 * * * *' };

// Calendar dates are handled as "YYYY-MM-DD" strings in the workspace timezone and stored as
// DateTime at UTC midnight. No date library; Intl does the timezone work.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export type Ymd = string;

export function todayYmd(tz: string, now: Date = new Date()): Ymd {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function ymdToDate(ymd: Ymd): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function dateToYmd(d: Date): Ymd {
  return d.toISOString().slice(0, 10);
}

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ymdToDate(s).getTime());
}

export function addDays(ymd: Ymd, n: number): Ymd {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToYmd(d);
}

export function daysBetween(a: Ymd, b: Ymd): number {
  return Math.round((ymdToDate(b).getTime() - ymdToDate(a).getTime()) / 86400000);
}

/** "Sep 22" */
export function fmtShort(ymd: Ymd): string {
  const d = ymdToDate(ymd);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Tuesday, September 22" */
export function fmtLong(ymd: Ymd): string {
  const d = ymdToDate(ymd);
  return `${DAYS_LONG[d.getUTCDay()]}, ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Tu" */
export function weekday2(ymd: Ymd): string {
  return DAYS_2[ymdToDate(ymd).getUTCDay()];
}

export function dayOfMonth(ymd: Ymd): number {
  return ymdToDate(ymd).getUTCDate();
}

/** Short date for a timestamp, in the workspace timezone. "Sep 22" */
export function fmtStamp(d: Date, tz: string): string {
  return fmtShort(todayYmd(tz, d));
}

/** Hour of the day (0..23) right now in the timezone. */
export function hourIn(tz: string, now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).formatToParts(now).find((p) => p.type === 'hour')?.value ?? '0';
  return Number(h) % 24;
}

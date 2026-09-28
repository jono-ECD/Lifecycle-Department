// Reads a content calendar from a spreadsheet. Works with a Google Sheets link shared as
// "anyone with the link can view", a published sheet, or any URL that returns CSV. No API key needed.
import { addDays, daysBetween, isYmd, type Ymd } from '@/lib/dates';

export interface SheetConfig {
  dateColumn?: string | null;
  nameColumn?: string | null;
  filterColumn?: string | null;
  filterValue?: string | null;
}

export interface SheetItem {
  date: Ymd;
  label: string;
  note: string | null;
}

export interface SheetResult {
  items: SheetItem[];
  headers: string[];
  dateColumn: string | null;
  nameColumn: string | null;
  rows: number;
  skipped: number;
}

/** Turns a Google Sheets browser link into its CSV export. Other URLs pass through. */
export function toCsvUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && !/^localhost$|^127\.0\.0\.1$/.test(u.hostname)) return null;
  if (u.hostname === 'docs.google.com') {
    const m = u.pathname.match(/^\/spreadsheets\/d\/(e\/)?([A-Za-z0-9_-]+)/);
    if (!m) return null;
    if (m[1]) {
      // published to the web: /spreadsheets/d/e/<id>/pub
      const gid = u.searchParams.get('gid');
      return `https://docs.google.com/spreadsheets/d/e/${m[2]}/pub?output=csv${gid ? `&gid=${gid}` : ''}`;
    }
    const gid = u.searchParams.get('gid') ?? u.hash.match(/gid=(\d+)/)?.[1] ?? '0';
    return `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=csv&gid=${gid}`;
  }
  return u.toString();
}

/** Small CSV parser: quotes, escaped quotes, newlines inside quotes, comma, semicolon or tab. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => first.split(ch).length - 1;
  const delim = count('\t') > count(',') && count('\t') >= count(';') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

function build(y: number, m: number, d: number): Ymd | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const s = `${y}-${pad(m)}-${pad(d)}`;
  if (!isYmd(s)) return null;
  // reject rollovers like Feb 31
  return new Date(`${s}T00:00:00Z`).getUTCDate() === d ? s : null;
}

/** When the sheet gives no year, pick the year that lands closest to today. */
function nearestYear(m: number, d: number, today: Ymd): Ymd | null {
  const y = Number(today.slice(0, 4));
  let best: Ymd | null = null;
  for (const cand of [y - 1, y, y + 1]) {
    const s = build(cand, m, d);
    if (s && (best === null || Math.abs(daysBetween(today, s)) < Math.abs(daysBetween(today, best)))) best = s;
  }
  return best;
}

/** Dates as people type them in content calendars. US order (month first) for slashes. */
export function parseSheetDate(raw: string, today: Ymd): Ymd | null {
  let s = raw.trim();
  if (!s) return null;
  // Excel or Sheets serial number
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n > 30000 && n < 80000) return addDays('1899-12-30', n);
  }
  s = s.replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*[,.\s]+/i, '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (!m[3]) return nearestYear(mo, d, today);
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return build(y, mo, d);
  }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return m[3] ? build(Number(m[3]), mo, Number(m[2])) : nearestYear(mo, Number(m[2]), today);
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return m[3] ? build(Number(m[3]), mo, Number(m[1])) : nearestYear(mo, Number(m[1]), today);
  }
  return null;
}

const DATE_HEADERS = [/^send\s*date$/i, /^date$/i, /^scheduled(\s*(date|for))?$/i, /^deploy(ment)?\s*date$/i, /^send\s*day$/i, /^day$/i, /^when$/i, /date/i];
const NAME_HEADERS = [/^campaign(\s*name)?$/i, /^email(\s*name)?$/i, /^name$/i, /^title$/i, /^subject(\s*line)?$/i, /^topic$/i, /campaign/i, /email/i, /name|title|subject/i];
const NOTE_HEADERS = [/^status$/i, /^type$/i, /^notes?$/i];
const SKIP_NOTE = /cancel|skip|scrapped|killed/i;

function pick(headers: string[], wanted: string | null | undefined, patterns: RegExp[], not = -1): number {
  if (wanted && wanted.trim()) {
    const w = wanted.trim().toLowerCase();
    const i = headers.findIndex((h) => h.toLowerCase() === w);
    if (i >= 0) return i;
    // a column letter like "C"
    if (/^[a-z]$/i.test(w)) return w.charCodeAt(0) - 97;
    return -1;
  }
  for (const p of patterns) {
    const i = headers.findIndex((h, idx) => idx !== not && p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

/** Finds the header row, the date and name columns, and returns the calendar items. */
export function readCalendar(rows: string[][], cfg: SheetConfig, today: Ymd): SheetResult {
  // The header is the first of the top rows that has a date looking column title.
  let headerAt = rows.slice(0, 12).findIndex((r) => r.some((c) => DATE_HEADERS.slice(0, 7).some((p) => p.test(c))));
  if (headerAt < 0) headerAt = 0;
  const headers = rows[headerAt] ?? [];
  let dateIdx = pick(headers, cfg.dateColumn, DATE_HEADERS);
  const body = rows.slice(headerAt + 1);
  if (dateIdx < 0 && !cfg.dateColumn) {
    // no title matched: take the column where most cells read as dates
    const width = Math.max(0, ...body.map((r) => r.length));
    let best = 0;
    for (let c = 0; c < width; c++) {
      const hits = body.filter((r) => parseSheetDate(r[c] ?? '', today)).length;
      if (hits > best) {
        best = hits;
        dateIdx = c;
      }
    }
  }
  const nameIdx = pick(headers, cfg.nameColumn, NAME_HEADERS, dateIdx);
  const noteIdx = pick(headers, null, NOTE_HEADERS, dateIdx);
  const filterIdx = cfg.filterColumn ? pick(headers, cfg.filterColumn, []) : -1;
  const want = (cfg.filterValue ?? '').trim().toLowerCase();

  const items: SheetItem[] = [];
  let skipped = 0;
  if (dateIdx >= 0 && nameIdx >= 0) {
    for (const r of body) {
      const label = (r[nameIdx] ?? '').trim();
      const date = parseSheetDate(r[dateIdx] ?? '', today);
      if (!label || !date) {
        skipped++;
        continue;
      }
      if (filterIdx >= 0 && want && !(r[filterIdx] ?? '').toLowerCase().includes(want)) continue;
      const note = noteIdx >= 0 ? (r[noteIdx] ?? '').trim() || null : null;
      if (note && SKIP_NOTE.test(note)) continue;
      items.push({ date, label: label.slice(0, 200), note });
    }
  }
  return { items, headers, dateColumn: dateIdx >= 0 ? (headers[dateIdx] ?? null) : null, nameColumn: nameIdx >= 0 ? (headers[nameIdx] ?? null) : null, rows: body.length, skipped };
}

const MONTH_TITLE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?$/i;
const dayNumber = (c: string) => (/^\d{1,2}$/.test(c) && Number(c) >= 1 && Number(c) <= 31 ? Number(c) : null);

/** A row of a calendar grid that holds the day numbers of one week. */
function weekRow(row: string[]): Map<number, number> | null {
  const days = new Map<number, number>();
  row.forEach((c, i) => {
    const n = dayNumber(c);
    if (n !== null) days.set(i, n);
  });
  if (days.size < 4) return null;
  // consecutive days, allowing the month to roll over inside the week
  const seq = [...days.values()];
  const ok = seq.every((n, i) => i === 0 || n === seq[i - 1] + 1 || (n === 1 && seq[i - 1] >= 28));
  return ok ? days : null;
}

export function looksLikeGrid(rows: string[][]): boolean {
  return rows.filter((r) => weekRow(r)).length >= 2;
}

/**
 * Reads a calendar laid out as a month grid: a month title, rows of day numbers, and what is planned
 * written in the cells under each day. Days that belong to the month before or after are dated right.
 */
export function readGrid(rows: string[][], today: Ymd): SheetResult {
  const items: SheetItem[] = [];
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  let titled = false;
  let cols: Map<number, Ymd> | null = null;
  let firstWeek = true;
  let weeks = 0;

  const shift = (y: number, m: number, by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  };

  for (const row of rows) {
    const title = row.map((c) => c.match(MONTH_TITLE)).find(Boolean);
    if (title && !weekRow(row)) {
      const m = MONTHS[title[1].slice(0, 4).toLowerCase()] ?? MONTHS[title[1].slice(0, 3).toLowerCase()];
      if (m) {
        if (title[2]) year = Number(title[2]);
        else if (titled && m < month) year += 1;
        else if (!titled) year = Number((nearestYear(m, 15, today) ?? today).slice(0, 4));
        month = m;
        titled = true;
        firstWeek = true;
        cols = null;
      }
      continue;
    }
    const week = weekRow(row);
    if (week) {
      weeks++;
      const seq = [...week.entries()];
      const rollAt = seq.findIndex(([, n], i) => i > 0 && n < seq[i - 1][1]);
      cols = new Map();
      seq.forEach(([col, n], i) => {
        let ym = { y: year, m: month };
        if (rollAt > 0) {
          // in the first week the days before the roll are last month; later they are next month
          if (firstWeek && i < rollAt) ym = shift(year, month, -1);
          if (!firstWeek && i >= rollAt) ym = shift(year, month, 1);
        } else if (firstWeek && n >= 23) ym = shift(year, month, -1);
        const d = build(ym.y, ym.m, n);
        if (d) cols!.set(col, d);
      });
      firstWeek = false;
      continue;
    }
    if (!cols) continue;
    row.forEach((cell, col) => {
      const date = cols!.get(col);
      if (!date || !cell) return;
      for (const line of cell.split(/\r?\n/)) {
        const label = line.trim();
        if (!label || dayNumber(label) !== null || SKIP_NOTE.test(label)) continue;
        items.push({ date, label: label.slice(0, 200), note: null });
      }
    });
  }
  return { items, headers: [], dateColumn: weeks ? 'month grid' : null, nameColumn: weeks ? 'cells under each day' : null, rows: rows.length, skipped: 0 };
}

export async function fetchCalendar(url: string, cfg: SheetConfig, today: Ymd, fetchImpl: typeof fetch = fetch): Promise<SheetResult> {
  const csvUrl = toCsvUrl(url);
  if (!csvUrl) throw new Error('That does not look like a spreadsheet link.');
  const r = await fetchImpl(csvUrl, { redirect: 'follow', headers: { Accept: 'text/csv,text/plain,*/*' } });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 || r.status === 404 ? 'The sheet is not shared. Set sharing to "Anyone with the link can view".' : `The sheet answered ${r.status}.`);
  const text = await r.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('The sheet is not shared. Set sharing to "Anyone with the link can view".');
  const rows = parseCsv(text);
  // a calendar drawn as a month grid is read by position, a list is read by column
  const result = !cfg.dateColumn && looksLikeGrid(rows) ? readGrid(rows, today) : readCalendar(rows, cfg, today);
  if (!result.dateColumn) throw new Error('No date column found. Name the column in the settings below.');
  if (!result.nameColumn) throw new Error('No campaign name column found. Name the column in the settings below.');
  return result;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Does a calendar line refer to this campaign. Used so a planned item and its campaign count once. */
export function sameCampaign(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 8 && long.includes(short);
}

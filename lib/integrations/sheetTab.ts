// The "Campaign Bank" tab for the Scheduler sheet. The Bank writes its own tab and never touches the
// calendar grid. Two ways to get it there:
//   1. A read only CSV feed the sheet pulls with IMPORTDATA. No credentials.
//   2. The Sheets API with a service account, which rewrites the whole tab after changes.
import { createSign } from 'node:crypto';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { dateToYmd, todayYmd } from '@/lib/dates';
import { CHANNELS, STATUS, TYPES, type CampaignType, type Channel, type Status } from '@/lib/status';

const base = () => env('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
const sheetsApi = () => env('GOOGLE_SHEETS_API_BASE', 'https://sheets.googleapis.com/v4').replace(/\/$/, '');
const tokenUrl = () => env('GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token');

export const TAB_HEADER = ['Asana task', 'Campaign', 'Channel', 'Type', 'Status', 'Approved version', 'Approved by', 'Approved on', 'Send date', 'Send date is', 'Sent on', 'Offer start', 'Offer end', 'Open notes', 'Last update', 'Bank link'];

/** One row per campaign, keyed on the Asana task id so a lookup from the calendar grid stays stable. */
export async function tabRows(workspaceId: string): Promise<string[][]> {
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const campaigns = await db.campaign.findMany({ where: { workspaceId }, orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }], include: { pins: { select: { status: true, version: true } } } });
  const ymd = (d: Date | null) => (d ? dateToYmd(d) : '');
  const stamp = (d: Date | null) => (d ? todayYmd(ws.timezone, d) : '');
  const rows = campaigns.map((c) => [
    c.asanaTaskGid ?? '',
    c.name,
    CHANNELS[c.channel as Channel] ?? c.channel,
    TYPES[c.type as CampaignType] ?? c.type,
    STATUS[c.status as Status] ?? c.status,
    c.approvedVersion ? String(c.approvedVersion) : '',
    c.approvedBy ?? '',
    stamp(c.approvedAt),
    ymd(c.scheduledDate),
    c.status === 'requested' ? 'requested by the client' : c.status === 'scheduled' ? 'scheduled' : '',
    c.status === 'sent' ? stamp(c.sentDate) : '',
    ymd(c.validFrom),
    ymd(c.validUntil),
    String(c.pins.filter((p) => p.status === 'open' && p.version === c.currentVersion).length),
    stamp(c.lastActivityAt),
    `${base()}/admin/w/${ws.slug}?c=${c.id}`,
  ]);
  return [TAB_HEADER, ...rows];
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
}

export function feedUrl(token: string): string {
  return `${base()}/api/feed/${token}`;
}

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export function parseServiceAccount(json: string): ServiceAccount | null {
  try {
    const a = JSON.parse(json) as Partial<ServiceAccount>;
    return a.client_email && a.private_key ? { client_email: a.client_email, private_key: a.private_key.replace(/\\n/g, '\n') } : null;
  } catch {
    return null;
  }
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Signed JWT for the service account, scoped to spreadsheets only. */
export function serviceJwt(account: ServiceAccount, now: Date = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(account.private_key);
  return `${head}.${claims}.${b64(sig)}`;
}

/** Rewrites the whole tab. People never edit that tab, so a full rewrite cannot clobber their work. */
export async function writeTab(sheetId: string, tab: string, rows: string[][], account: ServiceAccount, fetchImpl: typeof fetch = fetch): Promise<void> {
  const tok = await fetchImpl(tokenUrl(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceJwt(account) }) });
  if (!tok.ok) throw new Error(`Google rejected the service account: ${tok.status}`);
  const { access_token } = (await tok.json()) as { access_token: string };
  const auth = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
  const api = `${sheetsApi()}/spreadsheets/${sheetId}`;

  const meta = await fetchImpl(`${api}?fields=sheets.properties.title`, { headers: auth });
  if (!meta.ok) throw new Error(meta.status === 403 || meta.status === 404 ? 'The service account cannot open the sheet. Share the sheet with its email as an editor.' : `Sheets ${meta.status}`);
  const titles = ((await meta.json()) as { sheets?: { properties: { title: string } }[] }).sheets?.map((s) => s.properties.title) ?? [];
  if (!titles.includes(tab)) {
    const add = await fetchImpl(`${api}:batchUpdate`, { method: 'POST', headers: auth, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
    if (!add.ok) throw new Error(`Sheets could not add the tab: ${add.status}`);
  }
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'`);
  const clear = await fetchImpl(`${api}/values/${range}:clear`, { method: 'POST', headers: auth, body: '{}' });
  if (!clear.ok) throw new Error(`Sheets could not clear the tab: ${clear.status}`);
  const put = await fetchImpl(`${api}/values/${range}!A1?valueInputOption=RAW`, { method: 'PUT', headers: auth, body: JSON.stringify({ values: rows }) });
  if (!put.ok) throw new Error(`Sheets could not write the tab: ${put.status}`);
}

/** Pushes the tab for one workspace. Returns the number of campaign rows written. */
export async function pushSheetTab(workspaceId: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const account = parseServiceAccount(env('GOOGLE_SERVICE_ACCOUNT_JSON'));
  if (!cfg?.googleSheetId) throw new Error('Save the sheet id first.');
  if (!account) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set, or is not a service account key.');
  try {
    const rows = await tabRows(workspaceId);
    await writeTab(cfg.googleSheetId, cfg.googleSheetTab || 'Campaign Bank', rows, account, fetchImpl);
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { sheetPushedAt: new Date(), sheetPushError: null } });
    return rows.length - 1;
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { sheetPushedAt: new Date(), sheetPushError: message } });
    throw new Error(message);
  }
}

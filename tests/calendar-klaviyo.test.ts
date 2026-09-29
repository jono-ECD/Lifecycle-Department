import { describe, expect, it } from 'vitest';
import { fetchCalendar, parseCsv, parseSheetDate, readCalendar, sameCampaign, toCsvUrl } from '@/lib/integrations/sheet';
import { unmatched } from '@/lib/schedule';
import { KlaviyoClient, KlaviyoError } from '@/lib/integrations/klaviyo';
import { readKlaviyoKey } from '@/lib/integrations/klaviyoKey';
import { FigmaClient, fileKeyFrom, frameUrl } from '@/lib/integrations/figma';
import { decryptSecret, encryptSecret, hintFor } from '@/lib/secrets';
import { money, num, pct } from '@/lib/format';

const TODAY = '2026-09-28';

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
  return { fn, calls };
}

describe('spreadsheet links', () => {
  it('turns Google Sheets links into CSV exports and keeps the tab', () => {
    expect(toCsvUrl('https://docs.google.com/spreadsheets/d/1AbC_def-123/edit#gid=456')).toBe('https://docs.google.com/spreadsheets/d/1AbC_def-123/export?format=csv&gid=456');
    expect(toCsvUrl('https://docs.google.com/spreadsheets/d/1AbC_def-123/edit?gid=9')).toBe('https://docs.google.com/spreadsheets/d/1AbC_def-123/export?format=csv&gid=9');
    expect(toCsvUrl('https://docs.google.com/spreadsheets/d/1AbC_def-123/edit')).toBe('https://docs.google.com/spreadsheets/d/1AbC_def-123/export?format=csv&gid=0');
    expect(toCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pubhtml?gid=3')).toBe('https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pub?output=csv&gid=3');
  });
  it('passes other https links through and rejects the rest', () => {
    expect(toCsvUrl('https://example.com/calendar.csv')).toBe('https://example.com/calendar.csv');
    expect(toCsvUrl('http://example.com/calendar.csv')).toBeNull();
    expect(toCsvUrl('not a link')).toBeNull();
  });
});

describe('CSV parsing', () => {
  it('handles quotes, commas inside quotes and escaped quotes', () => {
    expect(parseCsv('Date,Campaign\n9/30/2026,"Buy 2, Save 15%"\n10/2/2026,"The ""Big"" One"')).toEqual([
      ['Date', 'Campaign'],
      ['9/30/2026', 'Buy 2, Save 15%'],
      ['10/2/2026', 'The "Big" One'],
    ]);
  });
  it('detects semicolons and tabs, and drops empty rows', () => {
    expect(parseCsv('Date;Name\n\n1/2/2026;A')).toEqual([
      ['Date', 'Name'],
      ['1/2/2026', 'A'],
    ]);
    expect(parseCsv('Date\tName\r\n1/2/2026\tA\r\n')).toEqual([
      ['Date', 'Name'],
      ['1/2/2026', 'A'],
    ]);
  });
});

describe('dates as people type them', () => {
  it('reads the common formats', () => {
    expect(parseSheetDate('2026-10-03', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('10/3/2026', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('10/3/26', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('Oct 3, 2026', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('October 3rd 2026', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('3 Oct 2026', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('Tue, Oct 6', TODAY)).toBe('2026-10-06');
    expect(parseSheetDate('Sept 30', TODAY)).toBe('2026-09-30');
  });
  it('picks the nearest year when the sheet gives none', () => {
    expect(parseSheetDate('10/3', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('1/5', '2026-12-20')).toBe('2027-01-05');
    expect(parseSheetDate('12/28', '2027-01-04')).toBe('2026-12-28');
  });
  it('reads spreadsheet serial numbers and rejects nonsense', () => {
    expect(parseSheetDate('46298', TODAY)).toBe('2026-10-03');
    expect(parseSheetDate('TBD', TODAY)).toBeNull();
    expect(parseSheetDate('2/31/2026', TODAY)).toBeNull();
    expect(parseSheetDate('', TODAY)).toBeNull();
  });
});

describe('reading a content calendar', () => {
  const rows = parseCsv(['ECD content calendar,,,', 'Send Date,Client,Campaign,Status', '9/30/2026,Blessed Botanicals,Sea Moss Spotlight,Designing', '10/3/2026,Blessed Botanicals,October Promo EM1,Planned', '10/4/2026,HigherDOSE,Sauna Launch,Planned', '10/9/2026,Blessed Botanicals,Old idea,Cancelled', ',Blessed Botanicals,No date yet,Planned'].join('\n'));

  it('finds the header row and the date and name columns on its own', () => {
    const r = readCalendar(rows, {}, TODAY);
    expect(r.dateColumn).toBe('Send Date');
    expect(r.nameColumn).toBe('Campaign');
    expect(r.items.map((i) => i.label)).toEqual(['Sea Moss Spotlight', 'October Promo EM1', 'Sauna Launch']);
    expect(r.items[0]).toEqual({ date: '2026-09-30', label: 'Sea Moss Spotlight', note: 'Designing' });
    expect(r.skipped).toBe(1);
  });
  it('keeps only one client when the sheet holds every client', () => {
    const r = readCalendar(rows, { filterColumn: 'Client', filterValue: 'blessed' }, TODAY);
    expect(r.items.map((i) => i.label)).toEqual(['Sea Moss Spotlight', 'October Promo EM1']);
  });
  it('uses the columns ECD names', () => {
    const r = readCalendar(parseCsv('Go live,What\n10/1/2026,Restock\n'), { dateColumn: 'go live', nameColumn: 'What' }, TODAY);
    expect(r.items).toEqual([{ date: '2026-10-01', label: 'Restock', note: null }]);
  });
  it('falls back to the column that reads as dates when titles say nothing', () => {
    const r = readCalendar(parseCsv('A,Campaign\n10/1/2026,Restock\n10/2/2026,Promo'), {}, TODAY);
    expect(r.items).toHaveLength(2);
  });
  it('explains an unshared sheet and a sheet without a date column', async () => {
    const html = fakeFetch(() => new Response('<!DOCTYPE html><html>Sign in</html>'));
    await expect(fetchCalendar('https://docs.google.com/spreadsheets/d/1AbC/edit', {}, TODAY, html.fn)).rejects.toThrow(/not shared/);
    const denied = fakeFetch(() => new Response('', { status: 401 }));
    await expect(fetchCalendar('https://example.com/x.csv', {}, TODAY, denied.fn)).rejects.toThrow(/not shared/);
    const nodate = fakeFetch(() => new Response('Thing,Other\nfoo,bar'));
    await expect(fetchCalendar('https://example.com/x.csv', {}, TODAY, nodate.fn)).rejects.toThrow(/No date column/);
    const ok = fakeFetch(() => new Response('Date,Campaign\n10/1/2026,Restock'));
    expect((await fetchCalendar('https://docs.google.com/spreadsheets/d/1AbC/edit#gid=7', {}, TODAY, ok.fn)).items).toHaveLength(1);
    expect(ok.calls[0].url).toContain('export?format=csv&gid=7');
  });
});

describe('a planned item and its campaign count once', () => {
  it('matches names loosely but not carelessly', () => {
    expect(sameCampaign('October Promo, EM1', 'october promo em1')).toBe(true);
    expect(sameCampaign('Sea Moss Spotlight', 'BB | Sea Moss Spotlight (v2)')).toBe(true);
    expect(sameCampaign('Promo', 'October Promo')).toBe(false);
    expect(sameCampaign('Sea Moss Spotlight', 'Turkey Tail Spotlight')).toBe(false);
  });
  it('leaves only the planned items that are not already scheduled', () => {
    const planned = [
      { label: 'Sea Moss Spotlight', note: null },
      { label: 'Flash Sale', note: null },
    ];
    expect(unmatched(planned, ['Sea Moss Spotlight'])).toEqual([{ label: 'Flash Sale', note: null }]);
    expect(unmatched(planned, [])).toHaveLength(2);
  });
});

describe('Klaviyo client', () => {
  it('lists email campaigns with subject lines and follows pages', async () => {
    const f = fakeFetch((url) =>
      url.includes('page2')
        ? new Response(JSON.stringify({ data: [{ id: 'B', attributes: { name: 'Second', status: 'Draft', send_time: null, scheduled_at: null } }], links: { next: null } }))
        : new Response(
            JSON.stringify({
              data: [{ id: 'A', attributes: { name: 'First', status: 'Sent', send_time: '2026-09-19T15:00:00Z', scheduled_at: null }, relationships: { 'campaign-messages': { data: [{ id: 'm1' }] } } }],
              included: [{ type: 'campaign-message', id: 'm1', attributes: { definition: { content: { subject: 'Hello there' } } } }],
              links: { next: 'https://a.klaviyo.com/api/campaigns?page2' },
            }),
          ),
    );
    const list = await new KlaviyoClient('pk_test', f.fn).campaigns();
    expect(list).toEqual([
      { id: 'A', name: 'First', status: 'Sent', sendTime: '2026-09-19T15:00:00Z', scheduledAt: null, subject: 'Hello there' },
      { id: 'B', name: 'Second', status: 'Draft', sendTime: null, scheduledAt: null, subject: null },
    ]);
    expect(decodeURIComponent(f.calls[0].url)).toContain("filter=equals(messages.channel,'email')");
    const h = f.calls[0].init!.headers as Record<string, string>;
    expect(h.Authorization).toBe('Klaviyo-API-Key pk_test');
    expect(h.revision).toBe('2026-07-15');
  });
  it('prefers the store Placed Order metric for revenue', async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ data: [{ id: 'X', attributes: { name: 'Opened Email', integration: { name: 'Klaviyo' } } }, { id: 'API', attributes: { name: 'Placed Order', integration: { name: 'API' } } }, { id: 'SHOP', attributes: { name: 'Placed Order', integration: { name: 'Shopify' } } }] })));
    expect(await new KlaviyoClient('pk_test', f.fn).conversionMetricId()).toEqual({ id: 'SHOP', isOrder: true });
  });
  it('adds up variations and computes rates from delivered', async () => {
    const stat = (id: string, delivered: number, opens: number, clicks: number, value: number) => ({ groupings: { campaign_id: id }, statistics: { recipients: delivered + 10, delivered, opens_unique: opens, clicks_unique: clicks, unsubscribes: 1, bounce_rate: 0.01, conversions: 2, conversion_value: value } });
    const f = fakeFetch(() => new Response(JSON.stringify({ data: { attributes: { results: [stat('A', 1000, 400, 30, 500), stat('A', 1000, 600, 50, 700), stat('B', 500, 100, 5, 0)] } } })));
    const m = await new KlaviyoClient('pk_test', f.fn).campaignValues('SHOP');
    expect(m.get('A')).toMatchObject({ recipients: 2020, delivered: 2000, opens: 1000, openRate: 0.5, clicks: 80, clickRate: 0.04, revenue: 1200, conversions: 4 });
    expect(m.get('B')!.openRate).toBeCloseTo(0.2);
    const body = JSON.parse(f.calls[0].init!.body as string);
    expect(body.data.type).toBe('campaign-values-report');
    expect(body.data.attributes.conversion_metric_id).toBe('SHOP');
    expect(body.data.attributes.timeframe.key).toBe('last_12_months');
  });
  it('explains a bad key and a rate limit in plain words', async () => {
    const bad = fakeFetch(() => new Response('{"errors":[{"detail":"nope"}]}', { status: 401 }));
    await expect(new KlaviyoClient('pk_x', bad.fn).campaigns()).rejects.toThrow(/rejected the key.*Klaviyo said: nope/);
    const scope = fakeFetch(() => new Response('{"errors":[{"detail":"missing scope"}]}', { status: 403 }));
    await expect(new KlaviyoClient('pk_x', scope.fn).conversionMetricId()).rejects.toThrow(/not allowed to read metrics/);
    const slow = fakeFetch(() => new Response('', { status: 429 }));
    await expect(new KlaviyoClient('pk_x', slow.fn).campaigns()).rejects.toBeInstanceOf(KlaviyoError);
  });
});

describe('reading a pasted Klaviyo key', () => {
  const KEY = 'pk_0123456789abcdef0123456789abcdef01';
  it('accepts the key however it was copied', () => {
    for (const paste of [KEY, `  ${KEY}\n`, `"${KEY}"`, `'${KEY}',`, `Klaviyo-API-Key ${KEY}`, `KLAVIYO_API_KEY=${KEY}`, `﻿${KEY}​`, KEY.replace('pk_', 'PK_'), `${KEY.slice(0, 20)} ${KEY.slice(20)}`]) expect(readKlaviyoKey(paste)).toEqual({ key: KEY });
  });
  it('accepts keys with underscores and hyphens, Klaviyo decides if they work', () => {
    expect(readKlaviyoKey('pk_AbC123_def-456_ghi789')).toEqual({ key: 'pk_AbC123_def-456_ghi789' });
  });
  it('says what is wrong without repeating what was pasted', () => {
    expect(readKlaviyoKey('AbC123').problem).toMatch(/public key/);
    expect(readKlaviyoKey('pk_abc').problem).toMatch(/cut short/);
    expect(readKlaviyoKey(`hunter2secret${KEY}`).problem).toMatch(/other text in front/);
    expect(readKlaviyoKey(`${KEY}!!oops`).problem).toMatch(/characters a Klaviyo key never has/);
    const other = readKlaviyoKey('my-sign-in-password').problem!;
    expect(other).toMatch(/19 characters and does not start with pk_/);
    expect(other).not.toContain('my-sign-in');
    expect(readKlaviyoKey(`hunter2secret${KEY}`).problem).not.toContain('hunter2');
  });
});

describe('Figma file browsing', () => {
  it('lists pages and frames with thumbnails', async () => {
    const f = fakeFetch((url) =>
      url.includes('/files/')
        ? new Response(JSON.stringify({ name: 'Q4 emails', document: { children: [{ id: '1:0', name: 'October', type: 'CANVAS', children: [{ id: '1:1', name: 'Promo EM1', type: 'FRAME', absoluteBoundingBox: { width: 600, height: 1800 } }, { id: '1:2', name: 'note', type: 'TEXT' }] }, { id: '2:0', name: 'Empty', type: 'CANVAS', children: [] }] } }))
        : new Response(JSON.stringify({ err: null, images: { '1:1': 'https://cdn/thumb.png' } })),
    );
    const res = await new FigmaClient('tok', f.fn).pages('KEY1234567');
    expect(res.name).toBe('Q4 emails');
    expect(res.pages).toEqual([{ id: '1:0', name: 'October', frames: [{ id: '1:1', name: 'Promo EM1', width: 600, height: 1800, thumbUrl: 'https://cdn/thumb.png' }] }]);
    expect(f.calls[1].url).toContain('scale=0.25');
  });
  it('accepts a bare key or a link and builds frame links', () => {
    expect(fileKeyFrom('AbC123dEf456')).toBe('AbC123dEf456');
    expect(fileKeyFrom('https://www.figma.com/design/AbC123dEf456/Name?node-id=1-2')).toBe('AbC123dEf456');
    expect(fileKeyFrom('nope')).toBeNull();
    expect(frameUrl('KEY', '12:34')).toBe('https://www.figma.com/design/KEY/?node-id=12-34');
  });
});

describe('secrets and formatting', () => {
  it('encrypts, decrypts, and never returns the key in the hint', () => {
    const enc = encryptSecret('pk_abcdef1234567890');
    expect(enc).not.toContain('abcdef');
    expect(decryptSecret(enc)).toBe('pk_abcdef1234567890');
    expect(encryptSecret('pk_abcdef1234567890')).not.toBe(enc);
    expect(decryptSecret(enc.slice(0, -3) + 'xyz')).toBeNull();
    expect(decryptSecret('garbage')).toBeNull();
    expect(hintFor('pk_abcdef1234567890')).toBe('pk_••••7890');
  });
  it('formats results for people', () => {
    expect(pct(0.4567)).toBe('46%');
    expect(pct(0.031)).toBe('3.1%');
    expect(num(18420)).toBe('18,420');
    expect(money(6210.5)).toBe('$6,211');
    expect(pct(null)).toBe('');
  });
});

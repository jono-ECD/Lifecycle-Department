// Tests for what the architecture plan adds: Asana as the source of campaigns, Stage bound by id,
// the month grid, the Campaign Bank tab, offer windows, listed send days, revision insights.
import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { AsanaClient, buildAsanaComment, channelOf, parseAsanaTaskUrl, parseTaskNotes, stageFor, type AsanaTask } from '@/lib/integrations/asana';
import { guessStageMap, parseStageMap, STAGE_KEYS } from '@/lib/integrations/asanaStage';
import { looksLikeGrid, parseCsv, readGrid } from '@/lib/integrations/sheet';
import { parseServiceAccount, serviceJwt, toCsv, writeTab, TAB_HEADER } from '@/lib/integrations/sheetTab';
import { checkSlot, openSlots } from '@/lib/slots';
import { summarize } from '@/lib/insights';
import { hashOf } from '@/lib/uploads';
import type { EventPayload } from '@/lib/integrations/types';

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
  return { fn, calls };
}

describe('Asana task notes template', () => {
  it('reads the Design and Klaviyo lines', () => {
    const p = parseTaskNotes('Brief: https://docs/x\nDesign: https://www.figma.com/design/AbC123xyz45/Emails?node-id=12-34&t=1\nKlaviyo: https://www.klaviyo.com/campaign/01JABCDEF/web-view');
    expect(p.figmaUrl).toBe('https://www.figma.com/design/AbC123xyz45/Emails?node-id=12-34&t=1');
    expect(p.klaviyoCampaignId).toBe('01JABCDEF');
    expect(p.problems).toEqual([]);
  });
  it('says what it could not read instead of guessing', () => {
    expect(parseTaskNotes('Brief: x').problems).toEqual(['The task notes have no "Design:" line.']);
    expect(parseTaskNotes('Design:\nKlaviyo:').problems).toEqual(['The "Design:" line has no link yet.']);
    expect(parseTaskNotes('Design: https://docs.google.com/x').problems).toEqual(['The "Design:" link is not a Figma link.']);
    expect(parseTaskNotes('Design: https://www.figma.com/design/AbC123xyz45/Emails').problems[0]).toContain('points to the file, not to a frame');
    expect(parseTaskNotes('Design: https://www.figma.com/design/K/E?node-id=1-2\nKlaviyo: ask Sam').problems).toEqual(['The "Klaviyo:" line could not be read as a campaign link.']);
  });
  it('accepts a bare Klaviyo id and reads SMS copy across lines', () => {
    const p = parseTaskNotes('Klaviyo: K10\nCopy: 20% off until midnight.\nShop now: https://bb.example.com/flash\nOwner: Sam');
    expect(p.klaviyoCampaignId).toBe('K10');
    expect(p.smsText).toBe('20% off until midnight.\nShop now: https://bb.example.com/flash');
  });
});

describe('Asana links, channel and Stage', () => {
  const task = (name: string, fields: AsanaTask['fields'] = []): AsanaTask => ({ gid: '1', name, notes: '', dueOn: null, completed: false, url: null, fields });
  it('finds the task id in old and new links', () => {
    expect(parseAsanaTaskUrl('https://app.asana.com/0/1201111111111111/1202222222222222/f')).toBe('1202222222222222');
    expect(parseAsanaTaskUrl('https://app.asana.com/1/99/project/1201111111111111/task/1203333333333333')).toBe('1203333333333333');
    expect(parseAsanaTaskUrl('1204444444444444')).toBe('1204444444444444');
    expect(parseAsanaTaskUrl('https://example.com/0/1/2')).toBeNull();
  });
  it('keeps email and SMS and skips everything else', () => {
    expect(channelOf(task('Promo', [{ gid: 'c', name: 'Channel', optionGid: 'e', optionName: 'Email' }]))).toBe('email');
    expect(channelOf(task('Promo', [{ gid: 'c', name: 'Channel', optionGid: 's', optionName: 'SMS' }]))).toBe('sms');
    expect(channelOf(task('Welcome', [{ gid: 'c', name: 'Channel', optionGid: 'f', optionName: 'Flow' }]))).toBeNull();
    expect(channelOf(task('Flash sale SMS'))).toBe('sms');
    expect(channelOf(task('Flash sale'))).toBe('email');
  });
  it('guesses the mapping from names, stores it by id', () => {
    const field = { gid: '900001', name: 'Stage', options: [{ gid: '1', name: 'Copy' }, { gid: '3', name: 'Client Review' }, { gid: '4', name: 'Edits In Progress' }, { gid: '5', name: 'Build in Klaviyo' }, { gid: '6', name: 'Scheduled in Klaviyo' }, { gid: '7', name: 'Done' }, { gid: '8', name: 'On Hold | Canceled' }] };
    expect(guessStageMap(field)).toEqual({ review: '3', changes: '4', approved: '5', hold: '8', scheduled: '6', sent: '7' });
    expect(parseStageMap(JSON.stringify({ review: '910003', nonsense: '1', changes: 'Edits' }))).toEqual({ review: '910003' });
    expect(parseStageMap('not json')).toEqual({});
    expect(STAGE_KEYS).toHaveLength(6);
  });
  it('sets Stage for decisions only, and never for a date request', () => {
    const map = { changes: '4', approved: '5', hold: '8' };
    const p = (type: EventPayload['type']) => ({ type }) as EventPayload;
    expect(stageFor(p('change_request'), map)).toBe('4');
    expect(stageFor(p('approved'), map)).toBe('5');
    expect(stageFor(p('hold'), map)).toBe('8');
    expect(stageFor(p('date_requested'), map)).toBeUndefined();
    expect(stageFor(p('comment'), map)).toBeUndefined();
  });
  it('writes Stage by field id and option id', async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ data: { gid: '800001' } })));
    await new AsanaClient('tok', f.fn).setStage('800001', '900001', '910005');
    expect(f.calls[0].init!.method).toBe('PUT');
    expect(JSON.parse(f.calls[0].init!.body as string)).toEqual({ data: { custom_fields: { '900001': '910005' } } });
  });
  it('reads tasks with their fields and follows pages', async () => {
    const f = fakeFetch((url) =>
      url.includes('offset=p2')
        ? new Response(JSON.stringify({ data: [{ gid: '2', name: 'B' }], next_page: null }))
        : new Response(JSON.stringify({ data: [{ gid: '1', name: 'A', notes: 'Design:', due_on: '2026-10-03', custom_fields: [{ gid: '900001', name: 'Stage', enum_value: { gid: '910003', name: 'Client Review' } }] }], next_page: { offset: 'p2' } })),
    );
    const tasks = await new AsanaClient('tok', f.fn).tasks({ projectGid: '700001', sectionGid: '700002', modifiedSince: new Date('2026-09-28T00:00:00Z') });
    expect(tasks.map((t) => t.gid)).toEqual(['1', '2']);
    expect(tasks[0].fields[0]).toEqual({ gid: '900001', name: 'Stage', optionGid: '910003', optionName: 'Client Review' });
    expect(f.calls[0].url).toContain('section=700002');
    expect(f.calls[0].url).toContain('modified_since=2026-09-28');
  });
});

describe('comment on the campaign task', () => {
  const base: EventPayload = {
    type: 'approved',
    workspace: { id: 'w', name: 'Blessed Botanicals', slug: 'bb' },
    campaign: { id: 'c', name: 'Holiday Gift Guide', subtitle: '', status: 'approved', version: 2, asanaTaskGid: '800001' },
    actor: { role: 'reviewer', name: 'Brittany' },
    links: { admin: 'https://bank/admin/w/bb?c=c', reviewer: 'https://bank/bank?c=c' },
    at: '2026-09-28T00:00:00Z',
  };
  it('names the version and the person for an approval', () => {
    expect(buildAsanaComment(base).split('\n')[0]).toBe('Approved v2 by Brittany, via Campaign Bank.');
  });
  it('carries the words of the client verbatim', () => {
    const c = buildAsanaComment({ ...base, type: 'change_request', text: 'Swap the hero.' });
    expect(c).toContain('Brittany via Campaign Bank: requested changes on version 2.');
    expect(c).toContain('"Swap the hero."');
    expect(c).toContain('https://bank/admin/w/bb?c=c');
  });
  it('a date is a request', () => {
    expect(buildAsanaComment({ ...base, type: 'date_requested', date: 'Oct 3' })).toContain('client requests Oct 3 as the send date');
  });
});

describe('calendar drawn as a month grid', () => {
  const grid = parseCsv(
    [
      'October 2026,,,,,,',
      'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
      '27,28,29,30,1,2,3',
      ',,,Sea Moss Spotlight,,"October Promo EM1\nCode: FALL20",',
      '4,5,6,7,8,9,10',
      ',,October Promo EM2,,,,',
      '25,26,27,28,29,30,31',
      ',,,,Halloween Flash,,',
      'November 2026,,,,,,',
      '1,2,3,4,5,6,7',
      ',,Holiday Gift Guide,,,,',
    ].join('\n'),
  );
  it('is recognised as a grid', () => {
    expect(looksLikeGrid(grid)).toBe(true);
    expect(looksLikeGrid(parseCsv('Date,Campaign\n10/1/2026,Restock'))).toBe(false);
  });
  it('dates every cell, including the days of the month before', () => {
    const items = readGrid(grid, '2026-09-28').items;
    expect(items).toEqual([
      { date: '2026-09-30', label: 'Sea Moss Spotlight', note: null },
      { date: '2026-10-02', label: 'October Promo EM1', note: null },
      { date: '2026-10-02', label: 'Code: FALL20', note: null },
      { date: '2026-10-06', label: 'October Promo EM2', note: null },
      { date: '2026-10-29', label: 'Halloween Flash', note: null },
      { date: '2026-11-03', label: 'Holiday Gift Guide', note: null },
    ]);
  });
});

describe('the Campaign Bank tab', () => {
  it('has a stable header keyed on the Asana task', () => {
    expect(TAB_HEADER[0]).toBe('Asana task');
    expect(TAB_HEADER).toContain('Approved version');
    expect(TAB_HEADER).toContain('Approved by');
  });
  it('writes CSV that survives commas, quotes and new lines', () => {
    expect(toCsv([['a', 'b, c', 'say "hi"', 'two\nlines']])).toBe('a,"b, c","say ""hi""","two\nlines"');
  });
  it('signs a JWT for spreadsheets only', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const account = parseServiceAccount(JSON.stringify({ client_email: 'bank@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }))!;
    const [head, claims, sig] = serviceJwt(account, new Date('2026-09-28T00:00:00Z')).split('.');
    const body = JSON.parse(Buffer.from(claims, 'base64url').toString());
    expect(body).toMatchObject({ iss: 'bank@proj.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token' });
    expect(body.exp - body.iat).toBe(3600);
    expect(createVerify('RSA-SHA256').update(`${head}.${claims}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
    expect(parseServiceAccount('{}')).toBeNull();
  });
  it('adds the tab when missing, clears it, and rewrites it whole', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const account = { client_email: 'a@b.c', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string };
    const f = fakeFetch((url) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'at' }));
      if (url.includes('?fields=')) return new Response(JSON.stringify({ sheets: [{ properties: { title: 'Calendar' } }] }));
      return new Response('{}');
    });
    await writeTab('SHEET', 'Campaign Bank', [['h'], ['r']], account, f.fn);
    const urls = f.calls.map((c) => `${c.init?.method ?? 'GET'} ${c.url.replace('https://sheets.googleapis.com/v4/spreadsheets/SHEET', '')}`);
    expect(urls.slice(1)).toEqual(['GET ?fields=sheets.properties.title', 'POST :batchUpdate', "POST /values/'Campaign%20Bank':clear", "PUT /values/'Campaign%20Bank'!A1?valueInputOption=RAW"]);
    expect(JSON.parse(f.calls[4].init!.body as string)).toEqual({ values: [['h'], ['r']] });
  });
  it('explains a sheet that was not shared with the service account', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const account = { client_email: 'a@b.c', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string };
    const f = fakeFetch((url) => (url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 'at' })) : new Response('', { status: 403 })));
    await expect(writeTab('SHEET', 'Campaign Bank', [], account, f.fn)).rejects.toThrow(/Share the sheet/);
  });
});

describe('offer window and listed send days', () => {
  const base = { today: '2026-09-28', windowDays: 14, maxPerDay: 1, counts: {}, blocked: [], role: 'reviewer' as const };
  it('a promo cannot be booked after its code expires', () => {
    const input = { ...base, offer: { from: '2026-09-30', until: '2026-10-04' } };
    expect(openSlots(input)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(checkSlot(input, '2026-10-05')).toEqual({ ok: false, reason: 'The offer ends Oct 4. Pick that day or earlier.' });
    expect(checkSlot(input, '2026-09-29')).toEqual({ ok: false, reason: 'The offer starts Sep 30. Pick that day or later.' });
  });
  it('evergreen work fits any open slot', () => {
    expect(openSlots({ ...base, offer: null })).toHaveLength(13);
  });
  it('listed mode offers only the days ECD opened, with their capacity', () => {
    const input = { ...base, listed: { '2026-09-29': 1, '2026-10-01': 2, '2026-10-06': 1 }, counts: { '2026-10-01': 1, '2026-10-06': 1 } };
    expect(openSlots(input)).toEqual(['2026-09-29', '2026-10-01']);
    expect(checkSlot(input, '2026-09-30')).toEqual({ ok: false, reason: 'That day is not a send day.' });
    expect(checkSlot(input, '2026-10-06')).toEqual({ ok: false, reason: 'That day is full.' });
  });
  it('blocked days win over listed days', () => {
    expect(checkSlot({ ...base, listed: { '2026-09-29': 1 }, blocked: ['2026-09-29'] }, '2026-09-29')).toEqual({ ok: false, reason: 'That day is blocked.' });
  });
});

describe('revision insights', () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  it('measures time to approve, rounds and hold rate from the event log', () => {
    const i = summarize(
      [
        { status: 'approved', reviewEnteredAt: d('2026-09-01'), events: [{ fromStatus: 'draft', toStatus: 'review', createdAt: d('2026-09-01') }, { fromStatus: 'review', toStatus: 'approved', createdAt: d('2026-09-03') }] },
        {
          status: 'approved',
          reviewEnteredAt: d('2026-09-10'),
          events: [
            { fromStatus: 'draft', toStatus: 'review', createdAt: d('2026-09-02') },
            { fromStatus: 'review', toStatus: 'changes', createdAt: d('2026-09-04') },
            { fromStatus: 'changes', toStatus: 'review', createdAt: d('2026-09-06') },
            { fromStatus: 'review', toStatus: 'approved', createdAt: d('2026-09-08') },
          ],
        },
        { status: 'hold', reviewEnteredAt: null, events: [{ fromStatus: 'review', toStatus: 'hold', createdAt: d('2026-09-05') }] },
        { status: 'review', reviewEnteredAt: d('2026-09-20'), events: [] },
      ],
      d('2026-09-28'),
    );
    expect(i.decided).toBe(3);
    expect(i.medianDaysToApprove).toBe(4);
    expect(i.roundsPerCampaign).toBeCloseTo(4 / 3);
    expect(i.holdRate).toBeCloseTo(1 / 3);
    expect(i.waiting).toBe(1);
    expect(i.oldestWaitingDays).toBe(8);
  });
  it('is empty without history', () => {
    expect(summarize([], d('2026-09-28'))).toMatchObject({ decided: 0, medianDaysToApprove: null, waiting: 0 });
  });
});

describe('content hash', () => {
  it('is stable, so an unchanged render is recognised', () => {
    expect(hashOf(Buffer.from('same'))).toBe(hashOf(Buffer.from('same')));
    expect(hashOf('a')).not.toBe(hashOf('b'));
    expect(hashOf('x')).toHaveLength(64);
  });
});

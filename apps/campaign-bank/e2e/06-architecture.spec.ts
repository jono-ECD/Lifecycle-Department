import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { adminLogin, db, expectToast, hydrated, openAdminBank, openCard, openReviewerBank, pngFile, shot } from './helpers';

// One test per rule of the architecture plan. Runs against the stand ins of sample mode.
test.describe.configure({ mode: 'serial' });

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function bb() {
  return db().workspace.findFirstOrThrow({ where: { slug: 'blessed-botanicals' } });
}

async function createCampaign(request: APIRequestContext, fields: Record<string, string>, color: string | null = '#3a7d5a') {
  const ws = await bb();
  const today = ymd(new Date());
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = { workspaceId: ws.id, builtDate: today, type: 'promo', status: 'draft', channel: 'email', subtitle: '', ...fields };
  if (color) multipart.files = await pngFile('design.png', 600, 1200, color);
  const r = await request.post('/api/admin/campaigns', { multipart });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

async function act(request: APIRequestContext, id: string, data: Record<string, string>) {
  return request.post(`/api/campaigns/${id}/transition`, { data });
}

async function asReviewer(page: Page) {
  await page.context().clearCookies();
  await openReviewerBank(page);
}

test('an approval covers one design version: a new version voids it and reopens review', async ({ page }) => {
  await adminLogin(page);
  const id = await createCampaign(page.request, { name: 'Version Rule Promo', status: 'review' });

  await asReviewer(page);
  expect((await act(page.request, id, { action: 'approve' })).ok()).toBeTruthy();
  const bank = await (await page.request.get('/api/bank')).json();
  const day = bank.days.find((d: { today: boolean; scheduled: unknown[]; requested: unknown[]; planned: unknown[]; blocked: string | null }) => !d.today && !d.blocked && d.scheduled.length + d.requested.length + d.planned.length === 0).ymd;
  expect((await act(page.request, id, { action: 'request_date', date: day })).ok()).toBeTruthy();
  let c = await db().campaign.findUniqueOrThrow({ where: { id } });
  expect(c).toMatchObject({ status: 'requested', approvedVersion: 1, approvedBy: 'Brittany' });
  expect(c.approvedAt).toBeTruthy();

  // ECD uploads a new design over the approved one
  await page.context().clearCookies();
  await adminLogin(page);
  await page.goto(`/admin/w/blessed-botanicals/campaigns/${id}/edit`);
  await hydrated(page);
  await expect(page.locator('[data-testid=approval-record]')).toContainText('Version 1 was approved by Brittany');
  await page.setInputFiles('[data-testid=file-input]', [await pngFile('v2.png', 600, 1300, '#7d3a5a')]);
  await expect(page.locator('[data-testid=reopen-warning]')).toContainText('sends this back to review');
  await shot(page, 'admin-editor-reopen-warning-1280.png');
  await page.click('[data-testid=save-campaign]');
  await page.waitForURL(/saved=1/);

  c = await db().campaign.findUniqueOrThrow({ where: { id } });
  expect(c).toMatchObject({ status: 'review', currentVersion: 2, approvedVersion: null, approvedBy: null, scheduledDate: null });
  const last = await db().comment.findFirstOrThrow({ where: { campaignId: id, kind: 'status' }, orderBy: { createdAt: 'desc' } });
  expect(last.body).toBe('The approval covered version 1. Version 2 is a new design, so it is back in review.');

  await asReviewer(page);
  await openCard(page, 'Version Rule Promo');
  await expect(page.locator('#dpill')).toHaveText('In review');
  await expect(page.locator('#approval')).toHaveCount(0);
  await expect(page.locator('#thread')).toContainText('it is back in review');
  await shot(page, 'reviewer-approval-voided-1280.png');
});

test('approver or commenter is per person: a commenter sees everything and decides nothing', async ({ page }) => {
  const reviewer = await db().reviewer.findFirstOrThrow({ where: { email: 'brittany@example.com' } });
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/settings');
  await hydrated(page);
  await page.locator('[data-testid=reviewer-role]').first().selectOption('commenter');
  await expect.poll(async () => (await db().reviewer.findUniqueOrThrow({ where: { id: reviewer.id } })).canApprove).toBe(false);

  await asReviewer(page);
  await openCard(page, 'Version Rule Promo');
  await expect(page.locator('.actions .b')).toHaveCount(0);
  await expect(page.locator('#commenter')).toHaveText('You can leave notes here. Decisions are made by the approvers on your team.');
  await shot(page, 'reviewer-commenter-1280.png');
  const id = (await db().campaign.findFirstOrThrow({ where: { name: 'Version Rule Promo' } })).id;
  const denied = await act(page.request, id, { action: 'approve' });
  expect(denied.status()).toBe(403);
  // notes still work
  await page.fill('#note', 'Looks good to me, waiting on the founders.');
  await page.click('button:has-text("Send note only")');
  await expectToast(page, 'Note sent to ECD.');

  await db().reviewer.update({ where: { id: reviewer.id }, data: { canApprove: true } });
});

test('clients do not see drafts unless the workspace allows it', async ({ page }) => {
  await adminLogin(page);
  const id = await createCampaign(page.request, { name: 'Still In The Oven', status: 'draft' });

  await asReviewer(page);
  const bank = await (await page.request.get('/api/bank')).json();
  expect(bank.campaigns.some((c: { status: string }) => c.status === 'draft')).toBe(false);
  expect(bank.workspace.showsDrafts).toBe(false);
  await expect(page.locator('.gcard[aria-label="Still In The Oven"]')).toHaveCount(0);
  // knowing the id does not help
  expect((await act(page.request, id, { action: 'approve' })).status()).toBe(404);
  expect((await page.request.post(`/api/campaigns/${id}/comments`, { data: { body: 'hello' } })).status()).toBe(404);

  await db().workspace.update({ where: { slug: 'blessed-botanicals' }, data: { clientSeesDrafts: true } });
  await page.reload();
  await hydrated(page);
  await expect(page.locator('.filters .f.draft')).toHaveCount(1);
  await expect(page.locator('.gcard[aria-label="Still In The Oven"]')).toHaveCount(1);
  await db().workspace.update({ where: { slug: 'blessed-botanicals' }, data: { clientSeesDrafts: false } });
});

test('offer window: a promo cannot be booked after its code expires', async ({ page }) => {
  await adminLogin(page);
  const ws = await bb();
  const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: ws.timezone }).format(new Date()) + 'T00:00:00Z');
  const plus = (n: number) => ymd(new Date(today.getTime() + n * 86400000));
  const id = await createCampaign(page.request, { name: 'Weekend Flash, 20% Off', status: 'approved', validFrom: plus(1), validUntil: plus(4) });

  await asReviewer(page);
  await openCard(page, 'Weekend Flash, 20% Off');
  await expect(page.locator('#offer')).toBeVisible();
  await page.locator('.b:has-text("Request a send date")').click();
  const enabled = await page.locator('.slot:enabled').count();
  expect(enabled).toBeGreaterThan(0);
  expect(enabled).toBeLessThanOrEqual(4);
  await shot(page, 'reviewer-offer-window-1280.png');
  const late = await act(page.request, id, { action: 'request_date', date: plus(6) });
  expect(late.status()).toBe(400);
  expect((await late.json()).error).toMatch(/^The offer ends .+\. Pick that day or earlier\.$/);
});

test('SMS has no frame: the copy is the version and shows as a text preview', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/campaigns/new');
  await hydrated(page);
  await page.fill('input[placeholder="Not Sure Where to Begin?"]', 'Restock Text');
  await page.locator('[data-testid=channel]').selectOption('sms');
  await expect(page.locator('[data-testid=file-input]')).toHaveCount(0);
  await page.fill('[data-testid=sms-body]', 'Blessed Botanicals: Sea Moss is back in stock. Shop: https://bb.example.com/sea-moss');
  await page.click('[data-testid=save-campaign]');
  await page.waitForURL(/\/campaigns\/[a-z0-9]+\/edit\?saved=1/);
  const c = await db().campaign.findFirstOrThrow({ where: { name: 'Restock Text' }, include: { assets: true } });
  expect(c).toMatchObject({ channel: 'sms', currentVersion: 1 });
  expect(c.assets[0]).toMatchObject({ kind: 'sms', text: 'Blessed Botanicals: Sea Moss is back in stock. Shop: https://bb.example.com/sea-moss' });

  await openAdminBank(page);
  await expect(page.locator('.gcard[aria-label="Restock Text"] .smscard .bubble')).toContainText('Sea Moss is back in stock');
  await openCard(page, 'Restock Text');
  await expect(page.locator('[data-testid=sms-preview] .bubble')).toContainText('Sea Moss is back in stock');
  await expect(page.locator('[data-testid=pin-mode]')).toHaveCount(0);
  await shot(page, 'admin-sms-preview-1280.png');
});

test('Asana is the source of campaigns: pull, Stage by id, feedback onto the same task, echo ignored', async ({ page }) => {
  await page.request.get('/api/dev/mock/asana/_reset');
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await page.fill('input[placeholder="1201234567890123"]', '700001');
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.conn > .ok')).toHaveText('Saved.');
  await page.click('[data-testid=asana-fields]');
  // the hygiene flag: two fields share the name, so the Bank binds by id
  await expect(page.locator('[data-conn=asana] .ok:not(.status)').first()).toContainText('Two fields are named "Stage"');
  await expect(page.locator('[data-testid=asana-stage-field]')).toHaveValue('900001');
  await expect(page.locator('[data-testid=asana-stage-map] select').first()).toHaveValue('910003');
  await shot(page, 'admin-connections-asana-1280.png', true);
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.conn > .ok')).toHaveText('Saved.');
  await page.click('[data-testid=asana-pull]');
  // four tasks in the section; the Flow task is neither email nor SMS and is skipped
  await expect(page.locator('[data-conn=asana] .ok:not(.status)').last()).toContainText('Read 3 tasks: 3 new, 0 updated, 2 moved by Stage');
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-testid=sync-problems]')).toContainText('Winter Wellness Tips: The "Design:" line has no link yet.');

  const gift = await db().campaign.findFirstOrThrow({ where: { asanaTaskGid: '800001' }, include: { assets: true } });
  expect(gift).toMatchObject({ name: 'Holiday Gift Guide', status: 'review', currentVersion: 1, klaviyoCampaignId: 'K9', figmaFileKey: 'SampleFileKey123', figmaNodeId: '20:1', asanaStageName: 'Client Review', channel: 'email' });
  expect(gift.assets[0].width).toBe(1200);
  expect(gift.plannedDate).toBeTruthy();
  const sms = await db().campaign.findFirstOrThrow({ where: { asanaTaskGid: '800003' }, include: { assets: true } });
  expect(sms).toMatchObject({ status: 'review', channel: 'sms' });
  expect(sms.assets[0].text).toBe('Blessed Botanicals: 20% off everything until midnight.\nShop now: https://bb.example.com/flash');
  expect(await db().campaign.findFirstOrThrow({ where: { asanaTaskGid: '800002' } })).toMatchObject({ status: 'draft', asanaStageName: 'Copy' });
  expect(await db().campaign.count({ where: { asanaTaskGid: '800004' } })).toBe(0);

  // a second pull creates nothing new
  await page.click('[data-testid=asana-pull]');
  await expect(page.locator('[data-conn=asana] .ok:not(.status)').last()).toContainText('0 new');
  expect(await db().campaign.count({ where: { asanaTaskGid: { not: null } } })).toBe(3);

  // the client approves: a comment and the Stage land on that same task, exactly once
  await asReviewer(page);
  await openCard(page, 'Holiday Gift Guide');
  await page.locator('.b:has-text("Approve")').first().click();
  await expectToast(page, 'Approved. It is in the bank.');
  await expect
    .poll(async () => {
      const log = (await (await page.request.get('/api/dev/mock/asana/_log')).json()).log as { kind: string; task: string; text?: string; name?: string }[];
      return log.filter((l) => l.task === '800001').map((l) => `${l.kind}:${l.name ?? l.text?.split('\n')[0]}`);
    })
    .toEqual(['comment:Approved v1 by Brittany, via Campaign Bank.', 'stage:Build in Klaviyo']);

  // the next pull sees the Bank's own write and ignores it
  await page.context().clearCookies();
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await page.click('[data-testid=asana-pull]');
  await expect(page.locator('[data-conn=asana] .ok:not(.status)').last()).toContainText('0 moved by Stage');
  expect(await db().campaign.findUniqueOrThrow({ where: { id: gift.id } })).toMatchObject({ status: 'approved', asanaStageName: 'Build in Klaviyo' });

  // ECD schedules in Klaviyo and moves the task: the Bank follows, using the task's due date
  const put = await page.request.put('/api/dev/mock/asana/tasks/800001', { headers: { Authorization: 'Bearer ecd' }, data: { data: { custom_fields: { '900001': '910006' } } } });
  expect(put.ok()).toBeTruthy();
  await page.click('[data-testid=asana-pull]');
  await expect(page.locator('[data-conn=asana] .ok:not(.status)').last()).toContainText('1 moved by Stage');
  const after = await db().campaign.findUniqueOrThrow({ where: { id: gift.id } });
  expect(after.status).toBe('scheduled');
  expect(ymd(after.scheduledDate!)).toBe(ymd(gift.plannedDate!));

  await openAdminBank(page);
  await openCard(page, 'Holiday Gift Guide');
  await expect(page.locator('#dmeta')).toContainText('Scheduled in Klaviyo');
  await expect(page.locator('#approval')).toContainText('version 1 by Brittany');
  await shot(page, 'admin-asana-linked-drawer-1280.png');
});

test('a note on the design becomes a subtask of the campaign task, with the crop', async ({ page }) => {
  await asReviewer(page);
  const flash = await db().campaign.findFirstOrThrow({ where: { asanaTaskGid: '800001' }, include: { assets: true } });
  const r = await page.request.post(`/api/campaigns/${flash.id}/pins`, { data: { assetId: flash.assets[0].id, x: 0.5, y: 0.1, body: 'Make the headline bigger.' } });
  expect(r.ok()).toBeTruthy();
  await expect
    .poll(async () => {
      const log = (await (await page.request.get('/api/dev/mock/asana/_log')).json()).log as { kind: string; task: string; name?: string; text?: string }[];
      return log.filter((l) => ['subtask', 'attachment'].includes(l.kind)).map((l) => l.kind);
    })
    .toEqual(['subtask', 'attachment']);
  const log = (await (await page.request.get('/api/dev/mock/asana/_log')).json()).log as { kind: string; task: string; name?: string }[];
  expect(log.find((l) => l.kind === 'subtask')).toMatchObject({ task: '800001', name: 'Note 1: Holiday Gift Guide · Blessed Botanicals' });
});

test('the Campaign Bank tab: a feed the sheet imports, keyed on the Asana task', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await page.click('[data-testid=feed-create]');
  const formula = (await page.locator('[data-testid=feed-formula]').innerText()).trim();
  expect(formula).toMatch(/^=IMPORTDATA\("http:\/\/localhost:3100\/api\/feed\/[A-Za-z0-9_-]+"\)$/);
  const url = formula.slice('=IMPORTDATA("'.length, -2);

  await page.context().clearCookies();
  const res = await page.request.get(url);
  expect(res.headers()['content-type']).toContain('text/csv');
  const lines = (await res.text()).split('\r\n');
  expect(lines[0]).toBe('Asana task,Campaign,Channel,Type,Status,Approved version,Approved by,Approved on,Send date,Send date is,Sent on,Offer start,Offer end,Open notes,Last update,Bank link');
  const gift = lines.find((l) => l.startsWith('800001,'))!;
  expect(gift).toContain('Holiday Gift Guide,Email,Promo,Scheduled,1,Brittany,');
  expect(gift).toContain(',scheduled,');
  expect((await page.request.get(url.slice(0, -4) + 'XXXX')).status()).toBe(404);
});

test('tenant isolation: a second client never sees or touches the first client', async ({ page }) => {
  await adminLogin(page);
  const made = await page.request.post('/api/admin/workspaces', { data: { name: 'Other Client', timezone: 'America/New_York' } });
  expect(made.ok()).toBeTruthy();
  const other = await made.json();
  const otherCampaign = await (async () => {
    const r = await page.request.post('/api/admin/campaigns', { multipart: { workspaceId: other.id, name: 'Other Secret Launch', builtDate: ymd(new Date()), type: 'promo', status: 'review', channel: 'email', subtitle: '', files: await pngFile('o.png', 600, 900, '#222222') } });
    return (await r.json()).id as string;
  })();
  const link = (await (await page.request.post('/api/admin/reviewers', { data: { workspaceId: other.id, name: 'Olga', email: 'olga@other.test' } })).json()).link as string;
  const mine = await db().campaign.findFirstOrThrow({ where: { name: 'Born For Us, Made For You' }, include: { assets: true, pins: true } });
  const ws = await bb();

  // Olga, from the other client
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/bank$/);
  await hydrated(page);
  await expect(page.locator('.top .brand .bt span')).toHaveText('Other Client');
  await expect(page.locator('.gcard')).toHaveCount(1);
  const bank = await (await page.request.get(`/api/bank?workspace=${ws.id}`)).json();
  expect(bank.workspace.name).toBe('Other Client');
  expect(bank.campaigns.map((c: { name: string }) => c.name)).toEqual(['Other Secret Launch']);
  expect(JSON.stringify(bank)).not.toContain('Born For Us');
  for (const attempt of [
    act(page.request, mine.id, { action: 'approve' }),
    page.request.post(`/api/campaigns/${mine.id}/comments`, { data: { body: 'hi' } }),
    page.request.post(`/api/campaigns/${mine.id}/pins`, { data: { assetId: mine.assets[0].id, x: 0.5, y: 0.5, body: 'hi' } }),
    ...(mine.pins[0] ? [page.request.post(`/api/pins/${mine.pins[0].id}`, { data: { op: 'reply', body: 'hi' } })] : []),
  ]) {
    expect((await attempt).status()).toBe(404);
  }
  const history = await page.goto('/bank/history');
  expect(history?.ok()).toBeTruthy();
  await expect(page.locator('body')).not.toContainText('Liver + Candida');
  for (const path of ['/admin', `/admin/w/blessed-botanicals`, `/admin/w/other-client`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  expect((await page.request.patch(`/api/admin/integrations/${ws.id}`, { data: {} })).status()).toBe(403);
  expect((await db().campaign.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe(mine.status);

  // and Brittany cannot reach the other client
  await asReviewer(page);
  const back = await (await page.request.get(`/api/bank?workspace=${other.id}`)).json();
  expect(back.workspace.name).toBe('Blessed Botanicals');
  expect(JSON.stringify(back)).not.toContain('Other Secret Launch');
  expect((await act(page.request, otherCampaign, { action: 'approve' })).status()).toBe(404);
});

test('listed send days: the client can only ask for days ECD opened', async ({ page }) => {
  await adminLogin(page);
  const ws = await bb();
  const patch = await page.request.patch(`/api/admin/workspaces/${ws.id}`, { data: { name: ws.name, slug: ws.slug, timezone: ws.timezone, windowDays: 14, maxPerDay: 1, clientSeesDrafts: false, slotMode: 'listed' } });
  expect(patch.ok()).toBeTruthy();
  await page.goto('/admin/w/blessed-botanicals/settings');
  await hydrated(page);
  await expect(page.locator('[data-testid=slots-panel]')).toContainText('No send days open yet');
  await page.click('[data-testid=open-cadence]');
  await expect(page.locator('[data-testid=open-days] button').first()).toBeVisible();
  const opened = await db().openSlot.findMany({ where: { workspaceId: ws.id } });
  expect(opened.length).toBe(16);
  expect(new Set(opened.map((s) => s.date.getUTCDay()))).toEqual(new Set([2, 4]));
  await shot(page, 'admin-listed-send-days-1280.png', true);

  await asReviewer(page);
  const bank = await (await page.request.get('/api/bank')).json();
  const closed = bank.days.filter((d: { closed: boolean }) => d.closed);
  expect(closed.length).toBe(10);
  await expect(page.locator('.day.closed').first()).toBeVisible();
  const id = (await db().campaign.findFirstOrThrow({ where: { name: 'Born For Us, Made For You' } })).id;
  // a closed day that is not also the day an earlier test blocked, since blocked is checked first
  const no = await act(page.request, id, { action: 'request_date', date: closed.find((d: { today: boolean; blocked: string | null }) => !d.today && !d.blocked).ymd });
  expect(no.status()).toBe(400);
  expect((await no.json()).error).toBe('That day is not a send day.');
  await shot(page, 'reviewer-listed-days-1280.png');

  await db().workspace.update({ where: { id: ws.id }, data: { slotMode: 'open' } });
});

test('editors work on campaigns; team, connections and workspaces are for admins', async ({ page }) => {
  await adminLogin(page);
  const made = await page.request.post('/api/admin/admins', { data: { name: 'Dana Designer', email: 'dana@e2e.test', password: 'e2e-editor-pass', role: 'editor' } });
  expect(made.ok()).toBeTruthy();
  await page.context().clearCookies();
  await page.goto('/admin/login');
  await page.fill('input[name=email]', 'dana@e2e.test');
  await page.fill('input[name=password]', 'e2e-editor-pass');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin$/);
  for (const path of ['/admin/team', '/admin/w/blessed-botanicals/integrations', '/admin/workspaces/new']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\?denied=1$/);
  }
  const ws = await bb();
  expect((await page.request.post('/api/admin/admins', { data: { name: 'X', email: 'x@e2e.test', password: 'long-enough-pass', role: 'admin' } })).status()).toBe(403);
  expect((await page.request.post('/api/admin/workspaces', { data: { name: 'Nope' } })).status()).toBe(403);
  const c = await db().campaign.findFirstOrThrow({ where: { name: 'Restock Text' } });
  expect((await page.request.delete(`/api/admin/campaigns/${c.id}`)).status()).toBe(403);
  // but the work itself is open to them
  expect((await act(page.request, c.id, { action: 'move_to_review' })).ok()).toBeTruthy();
  await page.goto(`/admin/w/${ws.slug}/campaigns/${c.id}/edit`);
  await hydrated(page);
  await expect(page.locator('button:has-text("Delete campaign")')).toHaveCount(0);
  await expect(page.locator('[data-testid=save-campaign]')).toBeVisible();
});

test('ECD sees how reviews are going', async ({ page }) => {
  await adminLogin(page);
  await openAdminBank(page);
  const panel = page.locator('[data-testid=insights]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('typical time to approve');
  await expect(panel).toContainText('rounds per campaign');
  await panel.scrollIntoViewIfNeeded();
  await shot(page, 'admin-insights-1280.png');
});

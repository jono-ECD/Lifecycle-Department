import { test, expect } from '@playwright/test';
import { adminLogin, db, hydrated, openAdminBank, openCard, openReviewerBank, shot } from './helpers';

// These run against the stand in services at /api/dev/mock (sample mode), so no account is needed.
test.describe.configure({ mode: 'serial' });

// A test value for the app's own field on localhost. The stand in accepts any key that starts with pk_.
const TEST_KLAVIYO_KEY = 'pk_e2etestkey0123456789';

test('import from Figma: pick frames, combine EM1 and EM2, and they arrive as campaigns', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/figma');
  await hydrated(page);
  await expect(page.locator('.sample')).toContainText('Sample mode is on');
  await page.fill('[data-testid=figma-file]', 'https://www.figma.com/design/SampleFileKey123/Q4-emails');
  await page.click('[data-testid=figma-load]');
  await expect(page.locator('[data-testid=figma-frame]')).toHaveCount(4);
  await expect(page.locator('[data-testid=figma-frame] img').first()).toBeVisible();
  await page.locator('[data-testid=figma-frame]', { hasText: 'October Promo, EM1' }).click();
  await page.locator('[data-testid=figma-frame]', { hasText: 'October Promo, EM2' }).click();
  await page.locator('[data-testid=figma-frame]', { hasText: 'Sea Moss Spotlight' }).click();
  await expect(page.locator('[data-testid=figma-group]')).toHaveCount(2);
  await expect(page.locator('[data-testid=figma-group]').first().locator('input')).toHaveValue('October Promo');
  await expect(page.locator('[data-testid=figma-group]').first()).toContainText('2 emails');
  await expect(page.locator('[data-testid=figma-group]').first()).toContainText('EM1: October Promo, EM1');
  await page.locator('[data-testid=figma-group]').nth(1).locator('select').selectOption('spot');
  await shot(page, 'admin-figma-import-1280.png', true);
  await page.click('[data-testid=figma-import]');
  await page.waitForURL(/\/admin\/w\/blessed-botanicals\?imported=2/, { timeout: 60_000 });
  await hydrated(page);

  await openCard(page, 'October Promo');
  const imgs = page.locator('.drawer .pinlayer img');
  await expect(imgs).toHaveCount(2);
  // frames are 600px wide, rendered at 2x, and shown at the real email width
  await expect(page.locator('[data-testid=zoom-pct]')).toHaveText('100%');
  expect(Math.round((await imgs.first().boundingBox())!.width)).toBe(600);
  await expect(page.locator('#dpill')).toHaveText('Draft');
  await expect(page.locator('#dmeta')).toContainText('Open in Figma');
  await expect(page.locator('#thread .msg').last()).toContainText('Design uploaded, 2 files.');
  await shot(page, 'admin-figma-imported-drawer-1280.png');

  const c = await db().campaign.findFirstOrThrow({ where: { name: 'October Promo' }, include: { assets: true } });
  expect(c.figmaFileKey).toBe('SampleFileKey123');
  expect(c.figmaNodeIds).toBe('10:1,10:2');
  expect(c.assets.map((a) => a.width)).toEqual([1200, 1200]);

  // already imported frames are marked the next time the file is opened
  await page.goto('/admin/w/blessed-botanicals/figma');
  await hydrated(page);
  await page.fill('[data-testid=figma-file]', 'SampleFileKey123');
  await page.click('[data-testid=figma-load]');
  await expect(page.locator('[data-testid=figma-frame] .was')).toHaveCount(3);
});

test('pull the latest from Figma creates the next version', async ({ page }) => {
  await adminLogin(page);
  const c = await db().campaign.findFirstOrThrow({ where: { name: 'Sea Moss Spotlight' } });
  await page.goto(`/admin/w/blessed-botanicals/campaigns/${c.id}/edit`);
  await hydrated(page);
  await expect(page.locator('.page-h p')).toContainText('Version 1.');
  await page.click('button:has-text("Pull the latest from Figma")');
  await page.waitForURL(/saved=1/, { timeout: 60_000 });
  await expect(page.locator('.page-h p')).toContainText('Version 2.');
});

test('content calendar: the sheet marks days on the calendar and those days cannot be double booked', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await page.click('[data-testid=sheet-sample]');
  await expect(page.locator('[data-testid=sheet-url]')).toHaveValue('http://localhost:3100/api/dev/mock/sheet');
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.conn > .ok')).toHaveText('Saved.');
  await page.click('[data-testid=sheet-sync]');
  // 5 Blessed Botanicals rows, 1 cancelled, 1 for another client: 4 remain
  await expect(page.locator('[data-conn=sheet] .ok:not(.status)')).toContainText('Read 4 items using the "Send Date" and "Campaign" columns.');
  await expect(page.locator('[data-testid=sheet-preview] tr')).toHaveCount(4);
  await expect(page.locator('[data-testid=sheet-preview]')).not.toContainText('Sauna Blanket Launch');
  await expect(page.locator('[data-testid=sheet-preview]')).not.toContainText('Cancelled idea');
  await shot(page, 'admin-connections-calendar-1280.png', true);
  expect(await db().scheduleItem.count()).toBe(4);

  // reviewer sees the planned days and cannot pick them
  await page.context().clearCookies();
  await openReviewerBank(page);
  // three of the four fall inside the two week window; one is 40 days out
  await expect(page.locator('.day.planned')).toHaveCount(3);
  await expect(page.locator('.day .chip.plan')).toHaveCount(3);
  await expect(page.locator('.window .legend')).toContainText('planned by ECD');
  await shot(page, 'reviewer-calendar-planned-1280.png');
  await page.locator('.day.planned').first().click();
  await expect(page.locator('#toast')).toContainText('is planned: Sea Moss Spotlight');

  await openCard(page, 'Born For Us, Made For You');
  await page.locator('.b:has-text("Schedule")').click();
  const taken = await page.locator('.slot:disabled').count();
  // two scheduled campaigns, three planned days, plus any day blocked by an earlier test
  expect(taken).toBeGreaterThanOrEqual(5);
  const plannedDay = (await db().scheduleItem.findFirstOrThrow({ where: { label: 'Sea Moss Spotlight' } })).date.toISOString().slice(0, 10);
  const r = await page.request.post(`/api/campaigns/${(await db().campaign.findFirstOrThrow({ where: { name: 'Born For Us, Made For You' } })).id}/transition`, { data: { action: 'schedule', date: plannedDay } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toBe('That day is full.');
});

test('a campaign can take the day its own calendar line planned for it', async ({ page }) => {
  await adminLogin(page);
  await openAdminBank(page);
  const item = await db().scheduleItem.findFirstOrThrow({ where: { label: 'Sea Moss Spotlight' } });
  const day = item.date.toISOString().slice(0, 10);
  const c = await db().campaign.findFirstOrThrow({ where: { name: 'Sea Moss Spotlight' } });
  expect((await page.request.post(`/api/campaigns/${c.id}/transition`, { data: { action: 'approve' } })).ok()).toBeTruthy();
  const r = await page.request.post(`/api/campaigns/${c.id}/transition`, { data: { action: 'schedule', date: day } });
  expect(r.ok()).toBeTruthy();
  const bank = (await r.json()).bank;
  const d = bank.days.find((x: { ymd: string }) => x.ymd === day);
  // the planned line and the scheduled campaign are the same send, so the day shows one item
  expect(d.scheduled).toHaveLength(1);
  expect(d.planned).toHaveLength(0);
});

test('Klaviyo: connect, sync, and the sent history shows results to ECD and to the client', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/history');
  await expect(page.locator('.flag')).toContainText('Connect Klaviyo in Connections');
  await expect(page.locator('[data-testid=history-row]')).toHaveCount(3);

  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await page.fill('[data-testid=klaviyo-key]', 'not-a-key');
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.conn > .err')).toContainText('Klaviyo private keys start with pk_');
  await page.fill('[data-testid=klaviyo-key]', TEST_KLAVIYO_KEY);
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.conn > .ok')).toHaveText('Saved.');
  await expect(page.locator('[data-conn=klaviyo] .status')).toHaveText('Connected');
  await expect(page.locator('[data-testid=klaviyo-key]')).toHaveValue('');
  await expect(page.locator('[data-conn=klaviyo] label b')).toContainText('pk_••••6789');
  await page.click('[data-testid=klaviyo-sync]');
  await expect(page.locator('[data-conn=klaviyo] .ok:not(.status)')).toContainText('Found 5 email campaigns, 4 sent');

  // the key is stored encrypted, never in the clear
  const cfg = await db().workspaceIntegration.findFirstOrThrow();
  expect(cfg.klaviyoKeyEnc).toBeTruthy();
  expect(cfg.klaviyoKeyEnc).not.toContain('e2etestkey');

  await page.goto('/admin/w/blessed-botanicals/history');
  await hydrated(page);
  await expect(page.locator('#history-summary')).toBeVisible();
  // three sent in the bank matched by name, plus one that only exists in Klaviyo
  await expect(page.locator('[data-testid=history-row]')).toHaveCount(4);
  const row = (title: string) => page.locator('[data-testid=history-row]').filter({ has: page.locator('.t > b', { hasText: title }) });
  const first = row('Liver + Candida Cleanse');
  await expect(first).toContainText('Subject line: Your cleanse, 20% off ends tonight');
  await expect(first).toContainText('18,420');
  await expect(first).toContainText('46%');
  await expect(first).toContainText('3.1%');
  await expect(first).toContainText('$6,211');
  const only = row('Moringa Restock Alert');
  await expect(only.locator('select')).toHaveValue('');
  await shot(page, 'admin-history-1280.png', true);

  // the client sees the same results, without the link control
  await page.context().clearCookies();
  await openReviewerBank(page);
  await page.locator('.filters a.hist').click();
  await expect(page).toHaveURL(/\/bank\/history$/);
  await expect(page.locator('#history-title')).toHaveText('Sent history');
  await expect(page.locator('[data-testid=history-row]')).toHaveCount(4);
  await expect(page.locator('[data-testid=history-row] select')).toHaveCount(0);
  await expect(page.locator('#history-summary')).toContainText('opened');
  await shot(page, 'reviewer-history-1280.png', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'reviewer-history-390.png');
  await page.setViewportSize({ width: 1280, height: 900 });

  // and in the drawer of a sent campaign
  await page.locator('.back').click();
  await hydrated(page);
  await openCard(page, 'Last Chance: Buy Any 2, Save 15%');
  await expect(page.locator('#results')).toContainText('41%');
  await expect(page.locator('#results')).toContainText('$9,120');
  await expect(page.locator('#results')).toContainText('Subject line: Last chance: buy any 2, save 15%');
  await shot(page, 'reviewer-drawer-results-1280.png');
});

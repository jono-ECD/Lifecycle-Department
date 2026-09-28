import { test, expect } from '@playwright/test';
import { CRON_SECRET, adminLogin, db, expectToast, hydrated, openAdminBank, openCard, openReviewerBank, pngFile, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

const NAME = 'Editor Test, EM1 and EM2';
let editUrl = '';

test('admin signs in and sees the workspace list with counts', async ({ page }) => {
  await adminLogin(page);
  await expect(page.locator('.wcard h3')).toHaveText(['Blessed Botanicals']);
  await expect(page.locator('.wcard .age')).toContainText(/Oldest in review|Nothing waiting for review/);
  await shot(page, 'admin-workspaces-1280.png');
  await openAdminBank(page);
  await expect(page.locator('.top .who')).toContainText('ECD admin');
  await expect(page.locator('.gcard .edit').first()).toBeAttached();
  await shot(page, 'admin-bank-1280.png');
});

test('admin adds a campaign with two PNGs and the gallery and drawer show them in order', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/campaigns/new');
  await hydrated(page);
  await page.fill('input[placeholder="Not Sure Where to Begin?"]', NAME);
  await page.fill('input[placeholder="One line on what it is"]', 'Uploaded through the editor');
  await page.setInputFiles('[data-testid=file-input]', [await pngFile('em1-blue.png', 600, 1000, '#4a6fd8'), await pngFile('em2-red.png', 600, 800, '#d84a6f')]);
  await expect(page.locator('.asset')).toHaveCount(2);
  await expect(page.locator('.asset .n').first()).toContainText('EM1 · em1-blue.png');
  // move EM2 up and back down to exercise the reorder controls
  await page.locator('.asset').nth(1).locator('button[aria-label="Move up"]').click();
  await expect(page.locator('.asset .n').first()).toContainText('em2-red.png');
  await page.locator('.asset').nth(0).locator('button[aria-label="Move down"]').click();
  await expect(page.locator('.asset .n').first()).toContainText('em1-blue.png');
  await shot(page, 'admin-editor-new-1280.png');
  await page.click('[data-testid=save-campaign]');
  await page.waitForURL(/\/campaigns\/[a-z0-9]+\/edit\?saved=1/);
  editUrl = page.url();
  await expect(page.locator('.page-h p')).toContainText('Saved. Version 1.');
  await expect(page.locator('.panel .tbl tr')).toHaveCount(1);

  await openAdminBank(page);
  await openCard(page, NAME);
  const imgs = page.locator('.drawer .stack img');
  await expect(imgs).toHaveCount(2);
  await expect(imgs.nth(0)).toHaveAttribute('src', /\/v1\/01-/);
  await expect(imgs.nth(1)).toHaveAttribute('src', /\/v1\/02-/);
  await expect(page.locator('.thread .msg').last()).toContainText('Design uploaded, 2 files.');
  await expect(page.locator('.actions .b')).toContainText([/Approve/, /Request changes/, /Put on hold/, /Move to review/, /Edit/]);
  await shot(page, 'admin-drawer-1280.png');
});

test('a second upload creates version 2 and the thread records it', async ({ page }) => {
  await adminLogin(page);
  await page.goto(editUrl);
  await hydrated(page);
  await page.setInputFiles('[data-testid=file-input]', [await pngFile('em1-green.png', 600, 900, '#22aa66')]);
  await expect(page.locator('.asset')).toHaveCount(3);
  const upload = page.waitForResponse((r) => r.url().includes('/assets') && r.request().method() === 'POST');
  await page.click('[data-testid=save-campaign]');
  const res = await upload;
  expect(res.status()).toBe(200);
  await page.waitForURL(/saved=1/);
  await expect(page.locator('.page-h p')).toContainText('Version 2.');
  await expect(page.locator('.panel .tbl tr')).toHaveCount(2);
  await expect(page.locator('.panel .tbl tr').first()).toContainText('Version 2 (current)');
  await shot(page, 'admin-editor-edit-1280.png', true);

  await openAdminBank(page);
  await openCard(page, NAME);
  await expect(page.locator('.drawer .stack img')).toHaveCount(1);
  await expect(page.locator('.drawer .stack img')).toHaveAttribute('src', /\/v2\//);
  await expect(page.locator('.thread .msg').last()).toContainText('Version 2 uploaded, 1 file.');
  await expect(page.locator('.thread .msg').nth(-2).locator('a.v')).toHaveCount(2);
});

test('admin blocks a day and the reviewer cannot pick it', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/settings');
  await hydrated(page);
  const bank = await (await page.request.get('/api/bank?workspace=' + (await db().workspace.findFirstOrThrow()).id)).json();
  const day = bank.days.find((d: { today: boolean; scheduled: unknown[]; blocked: string | null }) => !d.today && d.scheduled.length === 0 && !d.blocked);
  await page.fill('input[type=date]', day.ymd);
  await page.fill('input[placeholder="Klaviyo: flow test"]', 'Klaviyo: flow test');
  await page.click('button:has-text("Block day")');
  await expect(page.locator('.panel').nth(1).locator('.tbl')).toContainText('Klaviyo: flow test');
  await shot(page, 'admin-settings-1280.png', true);

  await page.context().clearCookies();
  await openReviewerBank(page);
  await expect(page.locator('.day.blocked')).toHaveCount(1);
  await openCard(page, 'Born For Us, Made For You');
  await page.locator('.b:has-text("Request a send date")').click();
  const slotLabel = new Date(day.ymd + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  await expect(page.locator(`.slot:has-text("${slotLabel}")`)).toBeDisabled();
  await expect(page.locator('.slot:disabled')).toHaveCount(3);
});

test('admin moves a draft to review, mark as sent, and the activity view lists it', async ({ page }) => {
  await adminLogin(page);
  await openAdminBank(page);
  await openCard(page, NAME);
  await page.locator('.b:has-text("Move to review")').click();
  await expectToast(page, 'In review. The reviewer will get an email.');
  await expect(page.locator('#dpill')).toHaveText('In review');
  await page.locator('.b:has-text("Approve")').first().click();
  await expectToast(page, 'Approved. It is in the bank.');
  await page.locator('.b:has-text("Mark as sent")').click();
  await expectToast(page, 'Marked as sent.');
  await expect(page.locator('#dpill')).toHaveText('Sent');
  await expect(page.locator('.actions .b')).toContainText([/Reopen to hold/]);
  await page.locator('.b:has-text("Reopen to hold")').click();
  await expectToast(page, 'Reopened to hold.');

  await page.goto('/admin/w/blessed-botanicals/activity');
  await expect(page.locator('.activity .msg').first()).toContainText(NAME);
  await expect(page.locator('.activity .msg').first()).toContainText('Reopened to hold.');
  await shot(page, 'admin-activity-1280.png');
});

test('notifications are logged: reviewer action to admins, review digest and reminders to reviewers', async ({ page }) => {
  const before = await db().notificationLog.count();
  await openReviewerBank(page);
  await openCard(page, 'Turkey Tail, EM1 and EM2');
  await page.fill('#note', 'Keep these for October.');
  await page.locator('.b:has-text("Back to review")').click();
  await expectToast(page, 'Back in review.');
  await expect.poll(async () => db().notificationLog.count({ where: { type: 'reviewer_action', recipient: 'admin@e2e.test' } })).toBeGreaterThan(0);

  await page.context().clearCookies();
  await adminLogin(page);
  await openAdminBank(page);
  await openCard(page, 'Wellness Quiz');
  await page.locator('.b:has-text("Move to review")').click();
  await expectToast(page, 'In review. The reviewer will get an email.');

  const cron = await (await page.request.get(`/api/cron/reminders?secret=${CRON_SECRET}&force=1`)).json();
  expect(cron.ok).toBe(true);
  expect(cron.digests).toBeGreaterThan(0);
  const digest = await db().notificationLog.findFirst({ where: { type: 'review_digest', recipient: 'brittany@example.com' } });
  expect(digest?.subject).toMatch(/campaigns? ready for your review/);
  const unauth = await page.request.get('/api/cron/reminders');
  expect(unauth.status()).toBe(401);
  expect(await db().notificationLog.count()).toBeGreaterThan(before);
});

test('revoked reviewer link stops working and a new one works', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/settings');
  await hydrated(page);
  await page.locator('button:has-text("Revoke")').first().click();
  await expect(page.locator('.panel').first().locator('.tbl')).toContainText('Revoked');
  await page.context().clearCookies();
  await page.goto('/r/e2e-reviewer-token-0123456789abcdef');
  await expect(page).toHaveURL(/link-expired/);
  await expect(page.locator('h1')).toContainText('This link is not active.');

  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/settings');
  await hydrated(page);
  await page.locator('button:has-text("New link")').first().click();
  const linkBox = page.locator('[data-testid=reviewer-link]');
  await expect(linkBox).toBeVisible();
  await expect(linkBox.locator('img')).toBeVisible();
  const link = (await linkBox.locator('code').innerText()).trim();
  expect(link).toMatch(/^http:\/\/localhost:3100\/r\//);
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/bank$/);
  await expect(page.locator('#headline')).toBeVisible();
});

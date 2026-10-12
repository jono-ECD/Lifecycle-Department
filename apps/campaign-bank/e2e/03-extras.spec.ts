import { test, expect } from '@playwright/test';
import { adminLogin, hydrated, openAdminBank, openCard, openReviewerBank, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

test('arrow keys move between campaigns in the drawer and Escape closes it', async ({ page }) => {
  await openReviewerBank(page);
  const names = await page.locator('.gcard').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await openCard(page, names[0]!);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#dtitle')).toHaveText(names[1]!);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#dtitle')).toHaveText(names[2]!);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#dtitle')).toHaveText(names[1]!);
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#dtitle')).toHaveText(names[0]!);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#dtitle')).toHaveText(names[0]!);
  // typing in the note box must not move between campaigns
  await page.locator('#note').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#dtitle')).toHaveText(names[0]!);
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer')).not.toHaveClass(/on/);
});

test('copy link for an existing reviewer gives a signed link with a QR code that opens the bank', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/settings');
  await hydrated(page);
  await page.locator('[data-testid=copy-link]').first().click();
  const box = page.locator('[data-testid=reviewer-link]');
  await expect(box).toBeVisible();
  await expect(box.locator('img')).toHaveAttribute('src', /^data:image\/png/);
  const link = (await box.locator('code').innerText()).trim();
  expect(link).toMatch(/^http:\/\/localhost:3100\/e\//);
  await expect(page.locator('.ok')).toHaveText('Link copied.');
  await shot(page, 'admin-copy-link-qr-1280.png');
  await context.clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/bank$/);
  await expect(page.locator('.top .brand span')).toHaveText('Blessed Botanicals');
});

test('admin workspace page shows a recent activity feed', async ({ page }) => {
  await adminLogin(page);
  await openAdminBank(page);
  const feed = page.locator('[data-testid=activity-feed]');
  await expect(feed).toBeVisible();
  await expect(feed.locator('.msg').first()).toBeVisible();
  await expect(feed.locator('a:has-text("See all activity")')).toHaveAttribute('href', '/admin/w/blessed-botanicals/activity');
  await feed.scrollIntoViewIfNeeded();
  await shot(page, 'admin-activity-feed-1280.png');
});

test('a workspace with no campaigns shows the empty state', async ({ page }) => {
  await adminLogin(page);
  const r = await page.request.post('/api/admin/workspaces', { data: { name: 'Empty Co', timezone: 'America/Chicago' } });
  expect(r.ok()).toBeTruthy();
  const { slug } = await r.json();
  await page.goto(`/admin/w/${slug}`);
  await hydrated(page);
  await expect(page.locator('.emptystate')).toBeVisible();
  await expect(page.locator('.emptystate svg')).toBeVisible();
  await expect(page.locator('.emptystate p')).toHaveText('No campaigns yet. Add the first one and it shows up here.');
  await expect(page.locator('#headline')).toContainText('Nothing to review right now. 0 approved in the bank, 0 on hold.');
  await shot(page, 'admin-empty-workspace-1280.png');
});

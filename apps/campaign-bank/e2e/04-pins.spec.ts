import { test, expect, type Page } from '@playwright/test';
import { adminLogin, db, expectToast, hydrated, openAdminBank, openCard, openReviewerBank, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

const CARD = 'Born For Us, Made For You';

async function clickImageAt(page: Page, fx: number, fy: number) {
  const img = page.locator('.pinlayer img').first();
  const box = (await img.boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test('reviewer pins a note on the design and it lands in the list, the thread and the admin email log', async ({ page }) => {
  await openReviewerBank(page);
  await openCard(page, CARD);
  await expect(page.locator('[data-testid=pin-mode]')).toHaveText(/Leave a note on the design/);
  await expect(page.locator('#notes')).toContainText('Tap "Leave a note on the design"');
  await page.locator('[data-testid=pin-mode]').click();
  await expect(page.locator('.ptools .hint')).toHaveText('Tap the design where the note goes. Drag to mark an area.');
  await clickImageAt(page, 0.3, 0.2);
  await expect(page.locator('.pin.draft')).toBeVisible();
  await expect(page.locator('[data-testid=pin-draft]')).toBeFocused();
  await shot(page, 'reviewer-pin-draft-1280.png');
  await page.fill('[data-testid=pin-draft]', 'Can the logo be a little bigger here?');
  await page.click('[data-testid=pin-post]');
  await expectToast(page, 'Note pinned. ECD will see it.');
  await expect(page.locator('.pin[data-pin="1"]')).toBeVisible();
  await expect(page.locator('.pinpop')).toContainText('Note 1');
  await expect(page.locator('.pinpop')).toContainText(/top left|upper left/);
  await expect(page.locator('.pinpop .msgs')).toContainText('Can the logo be a little bigger here?');
  await expect(page.locator('[data-testid=note-item]')).toHaveCount(1);
  await expect(page.locator('#thread .msg').last()).toContainText('Can the logo be a little bigger here?');
  await expect(page.locator('#thread .msg').last().locator('.pinref')).toHaveText('1');
  await expect(page.locator('[data-testid=pin-mode] .n')).toHaveText('1');
  // reviewers cannot mark done
  await expect(page.locator('[data-testid=pin-resolve]')).toHaveCount(0);
  await shot(page, 'reviewer-pin-thread-1280.png');
  await expect.poll(async () => db().notificationLog.count({ where: { type: 'pin', recipient: 'admin@e2e.test' } })).toBeGreaterThan(0);
  const thread = await db().pinThread.findFirstOrThrow({ where: { number: 1 } });
  expect(thread.cropPath).toMatch(/\/pins\//);
  expect(thread.status).toBe('open');
});

test('dragging marks an area and the gallery card shows the note count', async ({ page }) => {
  await openReviewerBank(page);
  await expect(page.locator(`.gcard[aria-label="${CARD}"] .notesbadge`)).toHaveText('1 note');
  await openCard(page, CARD);
  await page.locator('[data-testid=pin-mode]').click();
  const box = (await page.locator('.pinlayer img').first().boundingBox())!;
  // designs are tall, so stay near the top of the image where it is on screen
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.04);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.pinarea')).toBeVisible();
  await page.fill('[data-testid=pin-draft]', 'This whole block reads too small on the phone.');
  await page.keyboard.press('Enter');
  await expectToast(page, 'Note pinned. ECD will see it.');
  await expect(page.locator('.pin[data-pin="2"]')).toBeVisible();
  await expect(page.locator('.pinarea')).toHaveCount(1);
  await expect(page.locator('.pinpop')).toContainText('top right');
  const t = await db().pinThread.findFirstOrThrow({ where: { number: 2 } });
  expect(t.w).toBeGreaterThan(0.2);
  expect(t.h).toBeGreaterThan(0.03);
});

test('admin replies, marks done, and the note fades out unless shown', async ({ page }) => {
  await adminLogin(page);
  await openAdminBank(page);
  await expect(page.locator(`.gcard[aria-label="${CARD}"] .notesbadge`)).toHaveText('2 notes');
  await openCard(page, CARD);
  await page.locator('[data-testid=note-item]').first().click();
  await expect(page.locator('.pinpop')).toContainText('Note 1');
  await page.fill('[data-testid=pin-reply]', 'On it, bumping it 20%.');
  await page.keyboard.press('Enter');
  await expectToast(page, 'Reply added.');
  await expect(page.locator('.pinpop .msgs .msg')).toHaveCount(2);
  await expect(page.locator('[data-testid=note-item]').first()).toContainText('1 reply');
  await page.click('[data-testid=pin-resolve]');
  await expectToast(page, 'Marked as done.');
  await expect(page.locator('.pinpop .done-tag')).toHaveText('Done');
  await shot(page, 'admin-pin-done-1280.png');
  await page.locator('.pinpop .x').click();
  await expect(page.locator('.pin[data-pin="1"]')).toHaveCount(0);
  await expect(page.locator('[data-testid=note-item]')).toHaveCount(1);
  await page.locator('.notes .toggle').click();
  await expect(page.locator('.pin[data-pin="1"].done')).toBeVisible();
  await expect(page.locator('[data-testid=note-item]')).toHaveCount(2);
  await expect(page.locator('#thread .msg').last()).toContainText('Note 1 is done.');
});

test('deep link opens the campaign on a note and works on the phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const c = await db().campaign.findFirstOrThrow({ where: { name: CARD } });
  await openReviewerBank(page);
  await page.goto(`/bank?c=${c.id}&pin=2`);
  await hydrated(page);
  await expect(page.locator('.drawer')).toHaveClass(/on/);
  await expect(page.locator('#dtitle')).toHaveText(CARD);
  await expect(page.locator('.pinpop')).toContainText('Note 2');
  await shot(page, 'reviewer-pin-thread-390.png');
  await page.locator('.pinpop .x').click();
  await page.locator('[data-testid=pin-mode]').click();
  await clickImageAt(page, 0.5, 0.04);
  await expect(page.locator('[data-testid=pin-draft]')).toBeVisible();
  await shot(page, 'reviewer-pin-draft-390.png');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pin.draft')).toHaveCount(0);
  await expect(page.locator('.drawer')).toHaveClass(/on/);
});

test('connections page saves settings, validates them, and logs deliveries once a webhook is set', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await expect(page.locator('.conn .panel > .inline > .status')).toHaveText(['Not connected', 'Not connected', 'Not connected', 'Not connected', 'Not connected', 'Not connected', 'Not connected']);
  await page.fill('input[placeholder^="https://hooks.slack.com"]', 'https://example.com/not-slack');
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.err')).toContainText('Paste the incoming webhook URL from Slack');
  await page.fill('input[placeholder^="https://hooks.slack.com"]', '');
  await page.fill('input[placeholder^="https://hooks.zapier.com"]', 'http://localhost:3100/api/cron/reminders');
  await page.fill('input[placeholder="random string"]', 'e2e-webhook-secret');
  await page.click('[data-testid=save-integrations]');
  await expect(page.locator('.conn > .ok')).toHaveText('Saved.');
  await expect(page.locator('[data-conn=webhook] .status')).toHaveText('Connected');
  await shot(page, 'admin-connections-1280.png', true);

  // an action now produces a delivery row; the target answers 401, so it shows as failed with the reason
  await openAdminBank(page);
  await openCard(page, CARD);
  await page.fill('#note', 'Webhook test note.');
  await page.click('button:has-text("Send note only")');
  await expectToast(page, 'Note sent to ECD.');
  await expect.poll(async () => db().integrationEvent.count({ where: { target: 'webhook', type: 'comment' } })).toBeGreaterThan(0);
  await expect.poll(async () => (await db().integrationEvent.findFirst({ where: { target: 'webhook', type: 'comment' } }))?.status, { timeout: 15000 }).toBe('failed');
  await page.goto('/admin/w/blessed-botanicals/integrations');
  await hydrated(page);
  await expect(page.locator('.evlog')).toContainText('comment');
  await expect(page.locator('.evlog')).toContainText('Webhook 401');
});

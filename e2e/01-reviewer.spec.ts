import { test, expect } from '@playwright/test';
import { expectToast, openCard, openReviewerBank, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

test('reviewer link opens the bank with the prototype layout', async ({ page }) => {
  await openReviewerBank(page);
  await expect(page.locator('.top .brand h1')).toHaveText('Campaign Bank');
  await expect(page.locator('.top .brand span')).toHaveText('Blessed Botanicals');
  await expect(page.locator('#headline')).toContainText('ready for your review');
  await expect(page.locator('#headline em')).toHaveText('2 campaigns');
  await expect(page.locator('.window .k')).toContainText('Next two weeks');
  await expect(page.locator('.day')).toHaveCount(14);
  await expect(page.locator('.day.has')).toHaveCount(2);
  await expect(page.locator('.window .foot')).toHaveText('Any open day can take an approved campaign. Pick the slot, we handle the rest.');
  // clients do not see drafts: All, Bank, and seven statuses
  await expect(page.locator('.filters .f')).toHaveCount(9);
  await expect(page.locator('.filters .f.draft')).toHaveCount(0);
  await expect(page.locator('.filters .f').first()).toContainText('All');
  await expect(page.locator('.filters .f').nth(1)).toContainText('Bank');
  await expect(page.locator('.gcard')).toHaveCount(11);
  await expect(page.locator('.gcard img')).toHaveCount(4);
  await shot(page, 'reviewer-gallery-1280.png');

  await page.locator('.vt button').nth(1).click();
  await expect(page.locator('.row')).toHaveCount(11);
  await expect(page.locator('.row').first()).toContainText('Ready for review');
  await shot(page, 'reviewer-list-1280.png');
});

test('filters narrow the gallery and Bank means approved plus hold', async ({ page }) => {
  await openReviewerBank(page);
  await page.locator('.f.bank').click();
  await expect(page.locator('.gcard')).toHaveCount(4);
  await page.locator('.f.sent').click();
  await expect(page.locator('.gcard')).toHaveCount(3);
  await page.locator('.f.scheduled').click();
  await expect(page.locator('.gcard')).toHaveCount(2);
});

test('request changes without a note is refused with the prototype toast', async ({ page }) => {
  await openReviewerBank(page);
  await openCard(page, 'Not Sure Where to Begin?');
  await expect(page.locator('#dpill')).toHaveText('In review');
  await expect(page.locator('.actions .b')).toHaveText([/Approve/, /Request changes/, /Put on hold/]);
  await expect(page.locator('.actions .b small')).toHaveText(['goes to the bank', 'with a note', 'keep for later']);
  await page.locator('.b:has-text("Request changes")').click();
  await expectToast(page, 'Add a short note so ECD knows what to change.');
  await expect(page.locator('#dpill')).toHaveText('In review');
  await expect(page.locator('#note')).toBeFocused();
  // the email shows at its real width, not shrunk: the seeded designs are 520px wide
  await expect(page.locator('[data-testid=zoom-pct]')).toHaveText('100%');
  expect((await page.locator('.pinlayer img').first().boundingBox())!.width).toBeGreaterThanOrEqual(519);
  await page.locator('.zoom button[aria-label="Zoom in"]').click();
  await expect(page.locator('[data-testid=zoom-pct]')).toHaveText('125%');
  await page.locator('.zoom button.fit').click();
  await expect(page.locator('[data-testid=zoom-pct]')).toHaveText('100%');
  await shot(page, 'reviewer-drawer-1280.png');
});

test('request changes with a note goes back to ECD and lands in the thread', async ({ page }) => {
  await openReviewerBank(page);
  await openCard(page, 'Sun Lotion');
  await page.fill('#note', 'Please swap the hero photo for the summer one.');
  await page.locator('.b:has-text("Request changes")').click();
  await expectToast(page, 'Sent back to ECD with your note.');
  await expect(page.locator('#dpill')).toHaveText('Changes requested');
  await expect(page.locator('.hintline')).toContainText('ECD is working on your changes');
  await expect(page.locator('.thread .msg').last()).toContainText('You');
  await expect(page.locator('.thread .msg').last()).toContainText('Please swap the hero photo for the summer one.');
});

test('approve moves a campaign to the bank and hold keeps it', async ({ page }) => {
  await openReviewerBank(page);
  await openCard(page, 'Not Sure Where to Begin?');
  await page.locator('.b:has-text("Approve")').click();
  await expectToast(page, 'Approved. It is in the bank.');
  await expect(page.locator('#dpill')).toHaveText('Approved');
  // the approval names the version it covers and who gave it
  await expect(page.locator('.thread .msg').last()).toContainText('Approved version 1.');
  await expect(page.locator('#approval')).toContainText('version 1 by Brittany');
  await expect(page.locator('.actions .b')).toHaveText([/Request a send date/, /Put on hold/]);
  await expect(page.locator('#headline')).toContainText('Nothing to review right now. 2 approved in the bank, 3 on hold.');

  await page.locator('.b:has-text("Put on hold")').click();
  await expectToast(page, 'On hold. Nothing is lost.');
  await expect(page.locator('#dpill')).toHaveText('On hold');
  await expect(page.locator('.actions .b')).toHaveText([/Back to review/, /Approve as is/]);

  await page.locator('.b:has-text("Back to review")').click();
  await expectToast(page, 'Back in review.');
  await expect(page.locator('#dpill')).toHaveText('In review');
  await page.locator('.b:has-text("Approve")').first().click();
  await expectToast(page, 'Approved. It is in the bank.');
});

test('request a send date for an open slot, then withdraw it to reopen the slot', async ({ page }) => {
  await openReviewerBank(page);
  const before = await page.locator('.day.has').count();
  await openCard(page, 'Not Sure Where to Begin?');
  await expect(page.locator('#dpill')).toHaveText('Approved');
  await page.locator('.b:has-text("Request a send date")').click();
  await expect(page.locator('#picker')).toHaveClass(/on/);
  await expect(page.locator('.slot')).toHaveCount(13);
  await expect(page.locator('.slot:disabled')).toHaveCount(2);
  const slot = page.locator('.slot:enabled').first();
  const label = await slot.innerText();
  await slot.click();
  // picking a date is a request: it holds the day, but only ECD makes it Scheduled
  await expectToast(page, `Date requested for ${label}. ECD will confirm it.`);
  await expect(page.locator('#dpill')).toHaveText('Date requested');
  await expect(page.locator('#dmeta')).toContainText('Requested date');
  await expect(page.locator('#dmeta')).toContainText(label);
  await expect(page.locator('.day.asked')).toHaveCount(1);
  await expect(page.locator('.day.has')).toHaveCount(before);
  await expect(page.locator('.window .legend')).toContainText('date requested');
  await expect(page.locator('.actions .b')).toHaveText([/Pick another date/, /Withdraw the date/]);

  await page.locator('.b:has-text("Withdraw the date")').click();
  await expectToast(page, 'Back in the bank, slot reopened.');
  await expect(page.locator('#dpill')).toHaveText('Approved');
  await expect(page.locator('.day.asked')).toHaveCount(0);
});

test('sent campaigns offer nothing and a scheduled day opens its campaign', async ({ page }) => {
  await openReviewerBank(page);
  await openCard(page, 'Last Chance: Buy Any 2, Save 15%');
  await expect(page.locator('.actions .b')).toHaveCount(1);
  await expect(page.locator('.actions .b')).toBeDisabled();
  await expect(page.locator('.actions .b')).toContainText('Sent');
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer')).not.toHaveClass(/on/);
  await page.locator('.day.has').first().click();
  await expect(page.locator('.drawer')).toHaveClass(/on/);
  await expect(page.locator('#dpill')).toHaveText('Scheduled');
  // ECD scheduled it in Klaviyo, so the client has nothing to press here
  await expect(page.locator('.actions .b')).toHaveCount(0);
  await expect(page.locator('.hintline')).toContainText('ECD scheduled this one');
});

test('mobile layout at 390px is usable: gallery, bottom sheet drawer, actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReviewerBank(page);
  await expect(page.locator('.gcard').first()).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await shot(page, 'reviewer-gallery-390.png');
  await openCard(page, 'Born For Us, Made For You');
  await expect(page.locator('.preview img').first()).toBeVisible();
  await expect(page.locator('.b:has-text("Request a send date")')).toBeVisible();
  await shot(page, 'reviewer-drawer-390.png');
  await page.locator('.b:has-text("Request a send date")').click();
  await expect(page.locator('#picker')).toHaveClass(/on/);
  await expect(page.locator('.slot:enabled').first()).toBeVisible();
  await shot(page, 'reviewer-drawer-picker-390.png');
  await page.locator('#close').click();
  await expect(page.locator('.drawer')).not.toHaveClass(/on/);
  await page.locator('.vt button').nth(1).click();
  await expect(page.locator('.row').first()).toBeVisible();
  await shot(page, 'reviewer-list-390.png');
});

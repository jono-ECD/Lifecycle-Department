// Dev helper: screenshots of the reviewer and admin bank at 390 and 1280 wide.
// Usage: node scripts/shots.mjs [label]   (needs the dev server on localhost:3000 and a seeded db)
process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.APP_URL || 'http://localhost:3000';
const TOKEN = process.env.SEED_REVIEWER_TOKEN || 'bb-dev-reviewer-token-8f3a1c9d2e7b4a6f';
const label = process.argv[2] || 'dev';
const out = 'e2e/screenshots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [w, h, tag] of [
  [1280, 1000, '1280'],
  [390, 844, '390'],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/r/${TOKEN}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.gcard', { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${label}-reviewer-gallery-${tag}.png` });
  await page.locator('.gcard').first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${label}-reviewer-drawer-${tag}.png` });
  await page.keyboard.press('Escape');
  await page.locator('.vt button').nth(1).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${label}-reviewer-list-${tag}.png` });
  await ctx.close();
}
await browser.close();
console.log('saved to', out);

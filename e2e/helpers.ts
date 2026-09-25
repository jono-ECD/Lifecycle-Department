import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';

export const ADMIN = { email: 'admin@e2e.test', password: 'e2e-password' };
export const REVIEWER_TOKEN = 'e2e-reviewer-token-0123456789abcdef';
export const CRON_SECRET = 'e2e-cron-secret';
export const SHOTS = 'e2e/screenshots';

let prisma: PrismaClient | null = null;
/** Direct access to the e2e database for assertions on notification logs. */
export function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient({ datasources: { db: { url: 'file:./e2e.db' } } });
  return prisma;
}

export async function hydrated(page: Page) {
  await page.locator('body[data-hydrated="1"]').waitFor({ timeout: 60_000 });
}

export async function openReviewerBank(page: Page) {
  await page.goto(`/r/${REVIEWER_TOKEN}`);
  await expect(page).toHaveURL(/\/bank$/);
  await page.locator('.gcard, .emptystate').first().waitFor();
  await hydrated(page);
}

export async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[name=email]', ADMIN.email);
  await page.fill('input[name=password]', ADMIN.password);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin$/);
}

export async function openAdminBank(page: Page) {
  await page.goto('/admin/w/blessed-botanicals');
  await page.locator('.gcard').first().waitFor();
  await hydrated(page);
}

export async function openCard(page: Page, name: string) {
  await page.locator(`.gcard[aria-label="${name}"]`).click();
  await expect(page.locator('.drawer')).toHaveClass(/on/);
  await expect(page.locator('#dtitle')).toHaveText(name);
}

export async function expectToast(page: Page, text: string) {
  await expect(page.locator('#toast')).toHaveClass(/on/);
  await expect(page.locator('#toast')).toHaveText(text);
}

export async function pngFile(name: string, width: number, height: number, background: string) {
  return { name, mimeType: 'image/png', buffer: await sharp({ create: { width, height, channels: 3, background } }).png().toBuffer() };
}

/** Screenshot without hiding the caret, so it never touches inline styles before hydration. */
export async function shot(page: Page, file: string, fullPage = false) {
  await page.screenshot({ path: `${SHOTS}/${file}`, fullPage, caret: 'initial', animations: 'disabled' });
}

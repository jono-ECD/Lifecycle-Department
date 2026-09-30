import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { adminLogin, db, hydrated, openAdminBank, openCard } from './helpers';
import { DIRECT_LIMIT, PART_BYTES } from '../lib/uploadParts';

// A design bigger than one request can carry on a host that runs on functions.
async function bigPng(name: string) {
  const width = 1500;
  const height = 1500;
  // noise does not compress, so the PNG stays near the raw size, about 6.7 MB
  const raw = randomBytes(width * height * 3);
  const buffer = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
  expect(buffer.length).toBeGreaterThan(DIRECT_LIMIT);
  return { name, mimeType: 'image/png', buffer };
}

test('a large design goes up in parts and comes out whole', async ({ page }) => {
  const big = await bigPng('huge.png');
  const partRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/admin/uploads')) partRequests.push(r.url());
  });
  await adminLogin(page);
  await page.goto('/admin/w/blessed-botanicals/campaigns/new');
  await hydrated(page);
  await page.fill('input[placeholder="Not Sure Where to Begin?"]', 'Large Upload');
  await page.setInputFiles('[data-testid=file-input]', [big]);
  await expect(page.locator('.asset')).toHaveCount(1);
  await page.click('[data-testid=save-campaign]');
  await page.waitForURL(/\/campaigns\/[a-z0-9]+\/edit\?saved=1/);
  await expect(page.locator('.page-h p')).toContainText('Saved. Version 1.');
  expect(partRequests.length).toBe(Math.ceil(big.buffer.length / PART_BYTES));

  const c = await db().campaign.findFirstOrThrow({ where: { name: 'Large Upload' }, include: { assets: true } });
  expect(c.assets).toHaveLength(1);
  expect(c.assets[0]).toMatchObject({ size: big.buffer.length, width: 1500, height: 1500, originalName: 'huge.png' });
  // the parts were removed once the file was whole
  const leftover = await page.request.get(`/files/tmp/uploads/${'a'.repeat(32)}/00`);
  expect(leftover.status()).toBe(404);

  await openAdminBank(page);
  await openCard(page, 'Large Upload');
  const img = page.locator('.drawer .stack img').first();
  await expect(img).toHaveAttribute('src', /\/v1\/01-/);
  const served = await page.request.get((await img.getAttribute('src'))!);
  expect(served.status()).toBe(200);
  expect((await served.body()).length).toBe(big.buffer.length);
});

test('a wrong file type is refused with a plain sentence, not a server error', async ({ page }) => {
  await adminLogin(page);
  const r = await page.request.post('/api/admin/campaigns/nope/assets', { multipart: { files: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } } });
  expect(r.status()).toBe(404);
  const ws = await db().workspace.findFirstOrThrow({ where: { slug: 'blessed-botanicals' } });
  const c = await db().campaign.findFirstOrThrow({ where: { workspaceId: ws.id } });
  const bad = await page.request.post(`/api/admin/campaigns/${c.id}/assets`, { multipart: { files: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toBe('notes.txt is not a PNG, JPG, WEBP or PDF.');
});

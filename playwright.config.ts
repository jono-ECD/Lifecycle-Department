import { defineConfig } from '@playwright/test';

// End to end tests run against their own database and storage on port 3100, so `npm run check`
// never touches dev.db or a dev server on 3000. scripts/e2e-server.mjs seeds and starts the app.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:3100/admin/login',
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

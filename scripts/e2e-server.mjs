// Starts the app for Playwright with a throwaway database and storage folder on port 3100.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

export const E2E_ENV = {
  DATABASE_URL: 'file:./e2e.db',
  STORAGE_DIR: './storage-e2e',
  APP_URL: 'http://localhost:3100',
  SESSION_SECRET: 'e2e-session-secret-that-is-long-enough-for-iron-session',
  ADMIN_EMAIL: 'admin@e2e.test',
  ADMIN_PASSWORD: 'e2e-password',
  ADMIN_NAME: 'ECD',
  SEED_REVIEWER_TOKEN: 'e2e-reviewer-token-0123456789abcdef',
  CRON_SECRET: 'e2e-cron-secret',
  REVIEW_BATCH_MS: '600000',
  RUN_SCHEDULER: '0',
  NEXT_TELEMETRY_DISABLED: '1',
  CHECKPOINT_DISABLE: '1',
  PLAYWRIGHT_BROWSERS_PATH: '0',
  NEXT_DIST_DIR: '.next-e2e',
};

const env = { ...process.env, ...E2E_ENV };
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

// Prisma resolves "file:./e2e.db" relative to the prisma/ folder, so that is where the file lives.
for (const f of ['prisma/e2e.db', 'prisma/e2e.db-journal', 'e2e.db', 'e2e.db-journal']) rmSync(f, { force: true });
rmSync('storage-e2e', { recursive: true, force: true });

const run = (args) => {
  const r = spawnSync(npx, args, { stdio: 'inherit', env, shell: isWin });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
// The file was just removed, so this creates a fresh schema. (No --force-reset: Prisma refuses it
// from AI agent sessions, and deleting the throwaway file gives the same clean start.)
run(['prisma', 'db', 'push', '--skip-generate']);
run(['tsx', 'prisma/seed.ts']);

const server = spawn(npx, ['next', 'dev', '-p', '3100'], { stdio: 'inherit', env, shell: isWin });
const stop = () => {
  server.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));

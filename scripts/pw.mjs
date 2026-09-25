// Runs Playwright with browsers kept inside node_modules so nothing outside this folder is written.
import { spawnSync } from 'node:child_process';
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0', NEXT_TELEMETRY_DISABLED: '1' };
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(cmd, ['playwright', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);

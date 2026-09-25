import fs from 'node:fs';
import path from 'node:path';

// Loads .env and .env.local into process.env without overriding values that are already set.
// Next.js does this on its own; this is for scripts (seed, Playwright, cron) that run outside Next.
export function loadEnv(cwd = process.cwd()) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

export function env(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

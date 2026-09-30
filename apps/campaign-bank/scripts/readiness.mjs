// Checks a hosted deployment's settings before the build goes any further.
// The example file is public, so its secrets and password must never reach a real site.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function exampleValues(exampleText) {
  const out = new Set();
  for (const line of exampleText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && m[2]) out.add(m[2]);
  }
  return out;
}

/** Returns the problems as plain sentences. Empty means ready. */
export function readiness(env, exampleText) {
  const example = exampleValues(exampleText);
  const problems = [];
  const url = env.DATABASE_URL || '';
  if (!/^postgres(ql)?:/i.test(url)) problems.push('DATABASE_URL must be a Postgres address. A file database does not survive on a host without a disk.');
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32 || example.has(secret)) problems.push('SESSION_SECRET must be a random string of at least 32 characters, not the one from .env.example.');
  const cron = env.CRON_SECRET || '';
  if (cron.length < 16 || example.has(cron)) problems.push('CRON_SECRET must be a random string of at least 16 characters, not the one from .env.example.');
  if (!env.ADMIN_EMAIL) problems.push('ADMIN_EMAIL is the first admin account and must be set.');
  const pw = env.ADMIN_PASSWORD || '';
  if (pw.length < 12 || example.has(pw)) problems.push('ADMIN_PASSWORD must be at least 12 characters and not the one from .env.example.');
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const example = existsSync('.env.example') ? readFileSync('.env.example', 'utf8') : '';
  const problems = readiness(process.env, example);
  if (problems.length) {
    console.error('This site is not ready to deploy:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Set these in the host under environment variables, then deploy again.');
    process.exit(1);
  }
  console.log('Deployment settings look right.');
}

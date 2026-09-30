// Picks the Prisma schema from DATABASE_URL: SQLite by default, Postgres for a postgres:// address.
// The Postgres twin is written from schema.prisma every time, so the two never drift.
// Usage: node scripts/prisma-schema.mjs <prisma arguments>, for example "generate" or "db push --skip-generate".
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SQLITE = 'prisma/schema.prisma';
const POSTGRES = 'prisma/schema.postgres.prisma';

export function schemaFor(databaseUrl) {
  return /^postgres(ql)?:/i.test(databaseUrl || '') ? POSTGRES : SQLITE;
}

export function postgresTwin(sqliteSchema) {
  return sqliteSchema
    .replace(/^\/\/ SQLite by default\..*$/m, `// Postgres variant, written by scripts/prisma-schema.mjs from schema.prisma. Edit schema.prisma, not this file.`)
    .replace(/provider = "sqlite"/, 'provider = "postgresql"');
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of ['.env', '.env.local']) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]*)"?/m);
    if (m) return m[1].trim();
  }
  return '';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const schema = schemaFor(databaseUrl());
  if (schema === POSTGRES) writeFileSync(POSTGRES, postgresTwin(readFileSync(SQLITE, 'utf8')));
  const args = process.argv.slice(2);
  console.log(`prisma ${args.join(' ')} with ${schema}`);
  const r = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args, '--schema', schema], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

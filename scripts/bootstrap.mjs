// Runs in the host's build, before `next build`: checks the settings, brings the database schema up
// to date, and makes sure the first admin exists. Safe to run on every deploy; it never overwrites
// an existing admin's password and never touches workspaces.
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

function run(args) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(['scripts/readiness.mjs']);
run(['scripts/prisma-schema.mjs', 'db', 'push', '--skip-generate']);

const db = new PrismaClient();
const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
const existing = await db.adminUser.findUnique({ where: { email } });
if (existing) {
  console.log(`Admin ${email} is already there.`);
} else {
  await db.adminUser.create({ data: { email, name: process.env.ADMIN_NAME || 'Admin', passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10) } });
  console.log(`Admin ${email} created. Sign in at /admin/login and add the first workspace.`);
}
await db.$disconnect();

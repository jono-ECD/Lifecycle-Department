import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireFullAdminActor } from '@/lib/api';

const Body = z.object({
  name: z.string().trim().min(1, 'Add a name.').max(120),
  email: z.string().trim().email('Add a valid email.').max(200),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  role: z.enum(['admin', 'editor']).default('editor'),
});

// Full admins add teammates. Editors work on campaigns; admins also manage team, connections and workspaces.
export const POST = handler(async (req) => {
  await requireFullAdminActor();
  const input = await parseBody(req, Body);
  const email = input.email.toLowerCase();
  if (await db.adminUser.findUnique({ where: { email } })) throw new ApiError(400, 'That email already has an account.');
  const a = await db.adminUser.create({ data: { name: input.name, email, role: input.role, passwordHash: await bcrypt.hash(input.password, 10) } });
  return json({ id: a.id });
});

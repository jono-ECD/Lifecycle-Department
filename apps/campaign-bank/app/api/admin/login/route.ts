import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { env } from '@/lib/env';

const Body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

function back(req: Request, path: string) {
  return NextResponse.redirect(new URL(path, env('APP_URL', new URL(req.url).origin)), 303);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const parsed = Body.safeParse({ email: String(form.get('email') ?? '').trim().toLowerCase(), password: String(form.get('password') ?? '') });
  if (!parsed.success) return back(req, '/admin/login?error=1');
  const admin = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) return back(req, '/admin/login?error=1');
  const session = await getAdminSession();
  session.adminId = admin.id;
  await session.save();
  const next = String(form.get('next') ?? '');
  return back(req, next.startsWith('/admin') ? next : '/admin');
}

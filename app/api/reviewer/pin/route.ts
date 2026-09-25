import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/tokens';
import { getReviewerSession } from '@/lib/session';
import { env } from '@/lib/env';

const Body = z.object({ token: z.string().min(20).max(128), pin: z.string().regex(/^\d{4}$/) });

export async function POST(req: Request) {
  const origin = env('APP_URL', new URL(req.url).origin);
  const form = await req.formData();
  const parsed = Body.safeParse({ token: String(form.get('token') ?? ''), pin: String(form.get('pin') ?? '') });
  if (!parsed.success) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  const { token, pin } = parsed.data;
  const reviewer = await db.reviewer.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reviewer || reviewer.revokedAt) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  if (!reviewer.pinHash || !(await bcrypt.compare(pin, reviewer.pinHash))) {
    return NextResponse.redirect(new URL(`/r/${encodeURIComponent(token)}/pin?error=1`, origin), 303);
  }
  const session = await getReviewerSession();
  session.reviewerId = reviewer.id;
  await session.save();
  await db.reviewer.update({ where: { id: reviewer.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.redirect(new URL('/bank', origin), 303);
}

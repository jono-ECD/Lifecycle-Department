import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashToken, verifyEmailLink } from '@/lib/tokens';
import { getReviewerSession } from '@/lib/session';
import { env } from '@/lib/env';

const Body = z.object({
  token: z.string().min(20).max(128).optional(),
  sig: z.string().min(20).max(300).optional(),
  pin: z.string().regex(/^\d{4}$/),
});

export async function POST(req: Request) {
  const origin = env('APP_URL', new URL(req.url).origin);
  const form = await req.formData();
  const parsed = Body.safeParse({
    token: form.get('token') ? String(form.get('token')) : undefined,
    sig: form.get('sig') ? String(form.get('sig')) : undefined,
    pin: String(form.get('pin') ?? ''),
  });
  if (!parsed.success) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  const { token, sig, pin } = parsed.data;

  let reviewer = null;
  let retry = '/link-expired';
  if (token) {
    reviewer = await db.reviewer.findUnique({ where: { tokenHash: hashToken(token) } });
    retry = `/r/${encodeURIComponent(token)}/pin?error=1`;
  } else if (sig) {
    const v = verifyEmailLink(sig);
    if (v) reviewer = await db.reviewer.findUnique({ where: { id: v.reviewerId } });
    retry = `/e/${encodeURIComponent(sig)}/pin?error=1`;
  }
  if (!reviewer || reviewer.revokedAt) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  if (!reviewer.pinHash || !(await bcrypt.compare(pin, reviewer.pinHash))) return NextResponse.redirect(new URL(retry, origin), 303);

  const session = await getReviewerSession();
  session.reviewerId = reviewer.id;
  await session.save();
  await db.reviewer.update({ where: { id: reviewer.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.redirect(new URL('/bank', origin), 303);
}

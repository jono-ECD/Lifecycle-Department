import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashToken, looksLikeToken } from '@/lib/tokens';
import { getReviewerSession } from '@/lib/session';
import { env } from '@/lib/env';

// A reviewer's personal link. Opening it sets a 90 day session cookie and shows the bank.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const origin = env('APP_URL', new URL(req.url).origin);
  if (!looksLikeToken(token)) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  const reviewer = await db.reviewer.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reviewer || reviewer.revokedAt) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  if (reviewer.pinHash) return NextResponse.redirect(new URL(`/r/${encodeURIComponent(token)}/pin`, origin), 303);
  const session = await getReviewerSession();
  session.reviewerId = reviewer.id;
  await session.save();
  await db.reviewer.update({ where: { id: reviewer.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.redirect(new URL('/bank', origin), 303);
}

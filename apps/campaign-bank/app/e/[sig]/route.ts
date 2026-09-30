import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyEmailLink } from '@/lib/tokens';
import { getReviewerSession } from '@/lib/session';
import { env } from '@/lib/env';

// Link used in emails. Signed, expiring, and checked against the reviewer row so revocation still applies.
export async function GET(req: Request, ctx: { params: Promise<{ sig: string }> }) {
  const { sig } = await ctx.params;
  const origin = env('APP_URL', new URL(req.url).origin);
  const v = verifyEmailLink(sig);
  if (!v) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  const reviewer = await db.reviewer.findUnique({ where: { id: v.reviewerId } });
  if (!reviewer || reviewer.revokedAt) return NextResponse.redirect(new URL('/link-expired', origin), 303);
  if (reviewer.pinHash) return NextResponse.redirect(new URL(`/e/${encodeURIComponent(sig)}/pin`, origin), 303);
  const session = await getReviewerSession();
  session.reviewerId = reviewer.id;
  await session.save();
  await db.reviewer.update({ where: { id: reviewer.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.redirect(new URL('/bank', origin), 303);
}

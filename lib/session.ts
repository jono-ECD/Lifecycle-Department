import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { env } from '@/lib/env';

export interface AdminSessionData {
  adminId?: string;
}
export interface ReviewerSessionData {
  reviewerId?: string;
}

const DAY = 60 * 60 * 24;

function password(): string {
  const p = env('SESSION_SECRET', 'change-me-to-a-random-string-of-at-least-32-characters');
  if (p.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return p;
}

function base(cookieName: string, maxAge: number): SessionOptions {
  return {
    password: password(),
    cookieName,
    ttl: maxAge,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env('APP_URL', 'http://localhost:3000').startsWith('https://'),
      maxAge,
      path: '/',
    },
  };
}

export const adminSessionOptions = base('cb_admin', 30 * DAY);
export const reviewerSessionOptions = base('cb_reviewer', 90 * DAY);

export async function getAdminSession(): Promise<IronSession<AdminSessionData>> {
  return getIronSession<AdminSessionData>(await cookies(), adminSessionOptions);
}

export async function getReviewerSession(): Promise<IronSession<ReviewerSessionData>> {
  return getIronSession<ReviewerSessionData>(await cookies(), reviewerSessionOptions);
}

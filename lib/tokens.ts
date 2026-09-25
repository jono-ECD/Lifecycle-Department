import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

/** 32 random bytes as URL safe base64. Only the hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function looksLikeToken(s: string): boolean {
  return /^[A-Za-z0-9_-]{20,128}$/.test(s);
}

// Signed email links. Emails need a link that signs the reviewer in, and the personal token is stored
// only as a hash, so email links carry a stateless HMAC over the reviewer id and an expiry instead.
// Revoking the reviewer still works because the reviewer row is checked on every open.

function secret(): string {
  return env('SESSION_SECRET', 'change-me-to-a-random-string-of-at-least-32-characters');
}

export function signEmailLink(reviewerId: string, days = 45, now: Date = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + days * 86400;
  const payload = `${reviewerId}.${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyEmailLink(value: string, now: Date = new Date()): { reviewerId: string } | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [reviewerId, expStr, sig] = parts;
  if (!/^[a-z0-9]{10,40}$/i.test(reviewerId) || !/^\d{1,12}$/.test(expStr)) return null;
  if (Number(expStr) < Math.floor(now.getTime() / 1000)) return null;
  const expected = createHmac('sha256', secret()).update(`${reviewerId}.${expStr}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { reviewerId };
}

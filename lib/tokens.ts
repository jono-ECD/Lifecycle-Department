import { createHash, randomBytes } from 'node:crypto';

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

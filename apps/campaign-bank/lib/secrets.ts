// Encrypts per client secrets (the Klaviyo private key) at rest with AES-256-GCM.
// The key is derived from SESSION_SECRET, so changing that secret means re-entering client keys.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

function key(): Buffer {
  return createHash('sha256').update(`bank-secrets:${env('SESSION_SECRET', 'change-me-to-a-random-string-of-at-least-32-characters')}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split('.');
    if (v !== 'v1') return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** "pk_••••1a2b" for display. Never the whole key. */
export function hintFor(secret: string): string {
  const s = secret.trim();
  return `${s.slice(0, 3)}••••${s.slice(-4)}`;
}

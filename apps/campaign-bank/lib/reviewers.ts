import { env } from '@/lib/env';
import { signEmailLink } from '@/lib/tokens';

const base = () => env('APP_URL', 'http://localhost:3000').replace(/\/$/, '');

/** The reviewer's personal link. Shown once, only its hash is stored. */
export function reviewerLink(token: string): string {
  return `${base()}/r/${token}`;
}

/** A signed link for an existing reviewer, used in emails and for "Copy link". Valid 45 days. */
export function emailLink(reviewerId: string): string {
  return `${base()}/e/${signEmailLink(reviewerId)}`;
}

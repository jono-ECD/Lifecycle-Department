import { env } from '@/lib/env';

export function reviewerLink(token: string): string {
  return `${env('APP_URL', 'http://localhost:3000').replace(/\/$/, '')}/r/${token}`;
}

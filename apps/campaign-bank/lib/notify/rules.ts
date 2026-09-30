// Pure rules for notifications. Unit tested.
import { hourIn } from '@/lib/dates';

export const REMINDER_AFTER_DAYS = 3;
export const REMINDER_HOUR = 9;

export interface ReviewCandidate {
  id: string;
  status: string;
  reviewEnteredAt: Date | null;
  reviewNotifiedAt: Date | null;
}

/** Campaigns that moved to review and have not been emailed yet, once the batch window has passed (or when forced). */
export function selectDigest<T extends ReviewCandidate>(campaigns: T[], now: Date, batchMs: number, force = false): T[] {
  return campaigns.filter((c) => {
    if (c.status !== 'review' || c.reviewNotifiedAt) return false;
    if (!c.reviewEnteredAt) return true;
    return force || now.getTime() - c.reviewEnteredAt.getTime() >= batchMs;
  });
}

export function digestSubject(inReviewCount: number): string {
  return `${inReviewCount} campaign${inReviewCount === 1 ? '' : 's'} ready for your review`;
}

/** Campaigns that have been in review for 3 days or more. */
export function selectReminders<T extends ReviewCandidate>(campaigns: T[], now: Date): T[] {
  const cutoff = now.getTime() - REMINDER_AFTER_DAYS * 86400000;
  return campaigns.filter((c) => c.status === 'review' && c.reviewEnteredAt && c.reviewEnteredAt.getTime() <= cutoff);
}

/** Reminders go out once per day at or after 9:00 workspace time. */
export function reminderDue(tz: string, now: Date, sentTodayAlready: boolean): boolean {
  if (sentTodayAlready) return false;
  return hourIn(tz, now) >= REMINDER_HOUR;
}

export function reminderSubject(n: number): string {
  return n === 1 ? '1 campaign is ready when you are' : `${n} campaigns are ready when you are`;
}

/** Client facing copy rules from HANDOFF section 11: no dashes, no exclamation marks. */
export function copyIsClean(s: string): boolean {
  return !/[!–—]/.test(s) && !/\s-\s/.test(s);
}

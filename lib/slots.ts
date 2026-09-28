// Send window and slot availability. Pure functions, unit tested.
import { addDays, fmtShort, type Ymd } from '@/lib/dates';
import type { Role } from '@/lib/status';

export interface SlotInput {
  today: Ymd;
  windowDays: number;
  maxPerDay: number;
  /** sends already holding each day: scheduled, date requested, and planned in the content calendar */
  counts: Record<Ymd, number>;
  blocked: Iterable<Ymd>;
  role: Role;
  /** When ECD lists the send days itself: capacity per listed day. Null means every day is open. */
  listed?: Record<Ymd, number> | null;
  /** Offer window of the campaign. A promo cannot be booked outside it. */
  offer?: { from?: Ymd | null; until?: Ymd | null } | null;
}

export function windowDates(today: Ymd, windowDays: number): Ymd[] {
  return Array.from({ length: windowDays }, (_, i) => addDays(today, i));
}

export type SlotCheck = { ok: true } | { ok: false; reason: string };

/** Is this date open for one more campaign for this role. Past days never; today only for admins. */
export function checkSlot(input: SlotInput, date: Ymd): SlotCheck {
  const blocked = new Set(input.blocked);
  if (date < input.today) return { ok: false, reason: 'That day has passed.' };
  if (date === input.today && input.role !== 'admin') return { ok: false, reason: 'Today is not open for scheduling.' };
  if (date > addDays(input.today, input.windowDays - 1)) return { ok: false, reason: 'That day is outside the send window.' };
  if (input.offer?.from && date < input.offer.from) return { ok: false, reason: `The offer starts ${fmtShort(input.offer.from)}. Pick that day or later.` };
  if (input.offer?.until && date > input.offer.until) return { ok: false, reason: `The offer ends ${fmtShort(input.offer.until)}. Pick that day or earlier.` };
  if (blocked.has(date)) return { ok: false, reason: 'That day is blocked.' };
  if (input.listed) {
    const cap = input.listed[date];
    if (!cap) return { ok: false, reason: 'That day is not a send day.' };
    if ((input.counts[date] ?? 0) >= cap) return { ok: false, reason: 'That day is full.' };
    return { ok: true };
  }
  if ((input.counts[date] ?? 0) >= input.maxPerDay) return { ok: false, reason: 'That day is full.' };
  return { ok: true };
}

/** Every day in the window the role may schedule into. */
export function openSlots(input: SlotInput): Ymd[] {
  return windowDates(input.today, input.windowDays).filter((d) => checkSlot(input, d).ok);
}

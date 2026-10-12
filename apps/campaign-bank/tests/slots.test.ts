import { describe, expect, it } from 'vitest';
import { checkSlot, openSlots, windowDates } from '@/lib/slots';
import { addDays, daysBetween, fmtLong, fmtShort, todayYmd, weekday2 } from '@/lib/dates';

const base = { today: '2026-09-22', windowDays: 14, maxPerDay: 1, counts: {}, blocked: [], role: 'reviewer' as const };

describe('windowDates', () => {
  it('is a rolling window starting today', () => {
    const w = windowDates('2026-09-22', 14);
    expect(w).toHaveLength(14);
    expect(w[0]).toBe('2026-09-22');
    expect(w[13]).toBe('2026-10-05');
  });
});

describe('openSlots', () => {
  it('offers every future day in the window to a reviewer, not today', () => {
    const s = openSlots(base);
    expect(s).toHaveLength(13);
    expect(s[0]).toBe('2026-09-23');
  });
  it('offers today to admins', () => {
    expect(openSlots({ ...base, role: 'admin' })[0]).toBe('2026-09-22');
  });
  it('skips blocked and full days', () => {
    const s = openSlots({ ...base, blocked: ['2026-09-25'], counts: { '2026-09-24': 1 } });
    expect(s).not.toContain('2026-09-25');
    expect(s).not.toContain('2026-09-24');
    expect(s).toHaveLength(11);
  });
  it('respects max per day', () => {
    const s = openSlots({ ...base, maxPerDay: 2, counts: { '2026-09-24': 1, '2026-09-26': 2 } });
    expect(s).toContain('2026-09-24');
    expect(s).not.toContain('2026-09-26');
  });
  it('never offers past days or days past the window', () => {
    expect(checkSlot(base, '2026-09-21').ok).toBe(false);
    expect(checkSlot(base, '2026-10-06').ok).toBe(false);
    expect(checkSlot(base, '2026-10-05').ok).toBe(true);
  });
  it('gives a reason', () => {
    expect(checkSlot({ ...base, blocked: ['2026-09-30'] }, '2026-09-30')).toEqual({ ok: false, reason: 'That day is blocked.' });
    expect(checkSlot({ ...base, counts: { '2026-09-30': 1 } }, '2026-09-30')).toEqual({ ok: false, reason: 'That day is full.' });
  });
});

describe('dates', () => {
  it('formats like the prototype', () => {
    expect(fmtShort('2026-09-22')).toBe('Sep 22');
    expect(fmtLong('2026-09-22')).toBe('Tuesday, September 22');
    expect(weekday2('2026-09-22')).toBe('Tu');
    expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
    expect(daysBetween('2026-09-22', '2026-09-25')).toBe(3);
  });
  it('computes today in a timezone', () => {
    // 2026-09-23 03:30 UTC is still Sep 22 in Chicago.
    expect(todayYmd('America/Chicago', new Date('2026-09-23T03:30:00Z'))).toBe('2026-09-22');
    expect(todayYmd('UTC', new Date('2026-09-23T03:30:00Z'))).toBe('2026-09-23');
  });
});

import { describe, expect, it } from 'vitest';
import { actionsFor, applyAction, NOTE_REQUIRED, toastFor } from '@/lib/transitions';
import { STATUS_KEYS, type Status } from '@/lib/status';

const labels = (s: Status, role: 'admin' | 'reviewer') => actionsFor(s, role).map((a) => a.label);

describe('reviewer actions match the prototype', () => {
  it('draft and review', () => {
    for (const s of ['draft', 'review'] as const) {
      expect(labels(s, 'reviewer')).toEqual(['Approve', 'Request changes', 'Put on hold']);
      expect(actionsFor(s, 'reviewer').map((a) => a.small)).toEqual(['goes to the bank', 'with a note', 'keep for later']);
    }
  });
  it('approved', () => {
    expect(labels('approved', 'reviewer')).toEqual(['Schedule', 'Put on hold']);
  });
  it('hold', () => {
    expect(labels('hold', 'reviewer')).toEqual(['Back to review', 'Approve as is']);
  });
  it('scheduled', () => {
    expect(labels('scheduled', 'reviewer')).toEqual(['Unschedule']);
  });
  it('sent has nothing', () => {
    expect(labels('sent', 'reviewer')).toEqual([]);
  });
});

describe('admin additions', () => {
  it('draft gets Move to review', () => {
    expect(labels('draft', 'admin')).toContain('Move to review');
    expect(labels('review', 'admin')).not.toContain('Move to review');
  });
  it('approved, hold and scheduled get Mark as sent', () => {
    for (const s of ['approved', 'hold', 'scheduled'] as const) expect(labels(s, 'admin')).toContain('Mark as sent');
    expect(labels('review', 'admin')).not.toContain('Mark as sent');
  });
  it('scheduled gets Move date, sent gets Reopen to hold', () => {
    expect(labels('scheduled', 'admin')).toContain('Move date');
    expect(labels('sent', 'admin')).toEqual(['Reopen to hold']);
  });
  it('reviewers cannot use admin actions', () => {
    expect(applyAction('approved', 'mark_sent', 'reviewer').ok).toBe(false);
    expect(applyAction('sent', 'reopen', 'reviewer').ok).toBe(false);
    expect(applyAction('draft', 'move_to_review', 'reviewer').ok).toBe(false);
  });
});

describe('applyAction', () => {
  it('moves to the right status', () => {
    expect(applyAction('review', 'approve', 'reviewer')).toMatchObject({ ok: true, to: 'approved' });
    expect(applyAction('review', 'hold', 'reviewer')).toMatchObject({ ok: true, to: 'hold' });
    expect(applyAction('hold', 'back_to_review', 'reviewer')).toMatchObject({ ok: true, to: 'review' });
    expect(applyAction('hold', 'approve', 'reviewer')).toMatchObject({ ok: true, to: 'approved' });
    expect(applyAction('approved', 'schedule', 'reviewer')).toMatchObject({ ok: true, to: 'scheduled' });
    expect(applyAction('scheduled', 'unschedule', 'reviewer')).toMatchObject({ ok: true, to: 'approved' });
    expect(applyAction('scheduled', 'mark_sent', 'admin')).toMatchObject({ ok: true, to: 'sent' });
    expect(applyAction('sent', 'reopen', 'admin')).toMatchObject({ ok: true, to: 'hold' });
  });
  it('request changes needs a note and goes back to draft', () => {
    expect(applyAction('review', 'request_changes', 'reviewer', '')).toEqual({ ok: false, reason: NOTE_REQUIRED });
    expect(applyAction('review', 'request_changes', 'reviewer', '   ')).toEqual({ ok: false, reason: NOTE_REQUIRED });
    expect(applyAction('review', 'request_changes', 'reviewer', 'Swap the hero')).toMatchObject({ ok: true, to: 'draft' });
  });
  it('rejects actions that are not offered for the status', () => {
    expect(applyAction('sent', 'approve', 'reviewer').ok).toBe(false);
    expect(applyAction('approved', 'approve', 'reviewer').ok).toBe(false);
    expect(applyAction('review', 'unschedule', 'admin').ok).toBe(false);
  });
  it('every status has a definition', () => {
    for (const s of STATUS_KEYS) expect(Array.isArray(actionsFor(s, 'admin'))).toBe(true);
  });
});

describe('toasts copy the prototype', () => {
  it('has the exact strings', () => {
    expect(toastFor('approve')).toBe('Approved. It is in the bank.');
    expect(toastFor('request_changes')).toBe('Sent back to ECD with your note.');
    expect(toastFor('hold')).toBe('On hold. Nothing is lost.');
    expect(toastFor('back_to_review')).toBe('Back in review.');
    expect(toastFor('unschedule')).toBe('Back in the bank, slot reopened.');
    expect(toastFor('schedule', '2026-09-30')).toBe('Scheduled for Sep 30.');
  });
});

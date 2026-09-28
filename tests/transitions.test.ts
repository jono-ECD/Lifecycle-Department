import { describe, expect, it } from 'vitest';
import { actionsFor, applyAction, COMMENTER_ONLY, NOTE_REQUIRED, threadLineFor, toastFor } from '@/lib/transitions';
import { HOLDS_A_DAY, ORDER, STATUS, STATUS_KEYS, VOIDED_BY_NEW_VERSION, type Status } from '@/lib/status';

const labels = (s: Status, role: 'admin' | 'reviewer', canApprove = true) => actionsFor(s, role, canApprove).map((a) => a.label);

describe('statuses', () => {
  it('are the six of the prototype plus Changes requested and Date requested', () => {
    expect(STATUS_KEYS).toEqual(['draft', 'review', 'changes', 'approved', 'requested', 'hold', 'scheduled', 'sent']);
    expect(STATUS.changes).toBe('Changes requested');
    expect(STATUS.requested).toBe('Date requested');
    expect([...ORDER].sort()).toEqual([...STATUS_KEYS].sort());
  });
  it('know which hold a day and which a new version reopens', () => {
    expect(HOLDS_A_DAY).toEqual(['requested', 'scheduled']);
    expect(VOIDED_BY_NEW_VERSION).toEqual(['approved', 'requested', 'changes']);
  });
});

describe('client approver actions', () => {
  it('review keeps the prototype buttons and captions', () => {
    expect(labels('review', 'reviewer')).toEqual(['Approve', 'Request changes', 'Put on hold']);
    expect(actionsFor('review', 'reviewer').map((a) => a.small)).toEqual(['goes to the bank', 'with a note', 'keep for later']);
  });
  it('approved work gets a date request, not a schedule', () => {
    expect(labels('approved', 'reviewer')).toEqual(['Request a send date', 'Put on hold']);
    expect(applyAction('approved', 'request_date', 'reviewer')).toMatchObject({ ok: true, to: 'requested' });
    expect(applyAction('approved', 'schedule', 'reviewer').ok).toBe(false);
  });
  it('a requested date can be changed or withdrawn', () => {
    expect(labels('requested', 'reviewer')).toEqual(['Pick another date', 'Withdraw the date']);
    expect(applyAction('requested', 'withdraw_date', 'reviewer')).toMatchObject({ ok: true, to: 'approved' });
  });
  it('the client never schedules, unschedules or sends', () => {
    expect(labels('scheduled', 'reviewer')).toEqual([]);
    expect(labels('sent', 'reviewer')).toEqual([]);
    for (const s of STATUS_KEYS) for (const a of ['schedule', 'confirm_date', 'unschedule', 'mark_sent', 'move_date', 'move_to_review', 'reopen'] as const) expect(applyAction(s, a, 'reviewer').ok).toBe(false);
  });
  it('hold and changes requested', () => {
    expect(labels('hold', 'reviewer')).toEqual(['Back to review', 'Approve as is']);
    expect(labels('changes', 'reviewer')).toEqual(['Approve as is', 'Put on hold']);
  });
});

describe('commenters', () => {
  it('see everything but decide nothing', () => {
    for (const s of STATUS_KEYS) expect(labels(s, 'reviewer', false)).toEqual([]);
    expect(applyAction('review', 'approve', 'reviewer', '', false)).toEqual({ ok: false, reason: COMMENTER_ONLY });
    expect(applyAction('review', 'request_changes', 'reviewer', 'a note', false)).toEqual({ ok: false, reason: COMMENTER_ONLY });
  });
});

describe('ECD actions', () => {
  it('ECD confirms a requested date, because ECD schedules in Klaviyo', () => {
    expect(labels('requested', 'admin')).toEqual(['Confirm the date', 'Schedule another day', 'Back to the bank', 'Mark as sent']);
    const confirm = applyAction('requested', 'confirm_date', 'admin');
    expect(confirm).toMatchObject({ ok: true, to: 'scheduled' });
    expect(confirm.ok && confirm.def.keepsDate).toBe(true);
  });
  it('ECD schedules approved work directly', () => {
    expect(labels('approved', 'admin')).toEqual(['Schedule', 'Put on hold', 'Mark as sent']);
    expect(applyAction('approved', 'schedule', 'admin')).toMatchObject({ ok: true, to: 'scheduled' });
  });
  it('drafts and changes go to review, scheduled can move, sent can reopen', () => {
    expect(labels('draft', 'admin')).toContain('Move to review');
    expect(labels('changes', 'admin')).toContain('Move to review');
    expect(labels('review', 'admin')).not.toContain('Move to review');
    expect(labels('scheduled', 'admin')).toEqual(['Move date', 'Unschedule', 'Mark as sent']);
    expect(labels('sent', 'admin')).toEqual(['Reopen to hold']);
  });
});

describe('applyAction', () => {
  it('moves to the right status', () => {
    expect(applyAction('review', 'approve', 'reviewer')).toMatchObject({ ok: true, to: 'approved' });
    expect(applyAction('review', 'hold', 'reviewer')).toMatchObject({ ok: true, to: 'hold' });
    expect(applyAction('hold', 'back_to_review', 'reviewer')).toMatchObject({ ok: true, to: 'review' });
    expect(applyAction('scheduled', 'mark_sent', 'admin')).toMatchObject({ ok: true, to: 'sent' });
    expect(applyAction('sent', 'reopen', 'admin')).toMatchObject({ ok: true, to: 'hold' });
  });
  it('request changes needs a note and becomes Changes requested', () => {
    expect(applyAction('review', 'request_changes', 'reviewer', '')).toEqual({ ok: false, reason: NOTE_REQUIRED });
    expect(applyAction('review', 'request_changes', 'reviewer', '   ')).toEqual({ ok: false, reason: NOTE_REQUIRED });
    expect(applyAction('review', 'request_changes', 'reviewer', 'Swap the hero')).toMatchObject({ ok: true, to: 'changes' });
  });
  it('rejects actions that are not offered for the status', () => {
    expect(applyAction('sent', 'approve', 'reviewer').ok).toBe(false);
    expect(applyAction('approved', 'approve', 'reviewer').ok).toBe(false);
    expect(applyAction('review', 'unschedule', 'admin').ok).toBe(false);
  });
});

describe('copy', () => {
  it('toasts from the prototype are unchanged', () => {
    expect(toastFor('approve')).toBe('Approved. It is in the bank.');
    expect(toastFor('request_changes')).toBe('Sent back to ECD with your note.');
    expect(toastFor('hold')).toBe('On hold. Nothing is lost.');
    expect(toastFor('back_to_review')).toBe('Back in review.');
    expect(toastFor('withdraw_date')).toBe('Back in the bank, slot reopened.');
    expect(toastFor('schedule', '2026-09-30')).toBe('Scheduled for Sep 30.');
  });
  it('a date request says ECD will confirm', () => {
    expect(toastFor('request_date', '2026-09-30')).toBe('Date requested for Sep 30. ECD will confirm it.');
    expect(threadLineFor('request_date', '2026-09-30')).toBe('Requested Sep 30 as the send date.');
  });
  it('an approval names the version it covers', () => {
    expect(threadLineFor('approve', undefined, 2)).toBe('Approved version 2.');
    expect(threadLineFor('approve')).toBe('Approved.');
  });
});

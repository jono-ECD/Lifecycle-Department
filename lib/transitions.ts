// The state machine. One place decides which moves exist for which role. Pure functions, unit tested.
// Labels, captions and toasts come from the prototype wherever the prototype has them.
import type { Role, Status } from '@/lib/status';
import { fmtShort } from '@/lib/dates';

export type Action =
  | 'approve'
  | 'request_changes'
  | 'hold'
  | 'back_to_review'
  | 'request_date'
  | 'withdraw_date'
  | 'confirm_date'
  | 'schedule'
  | 'unschedule'
  | 'move_to_review'
  | 'mark_sent'
  | 'move_date'
  | 'reopen';

export interface ActionDef {
  action: Action;
  label: string;
  small: string;
  cls: 'primary' | '' | 'ghost';
  to: Status;
  /** A note is required (prototype: Request changes). */
  needsNote?: boolean;
  /** Opens the slot picker; the transition happens when a slot is picked. */
  needsDate?: boolean;
  /** Keeps the date already on the campaign. */
  keepsDate?: boolean;
  adminOnly?: boolean;
}

const A = (action: Action, label: string, small: string, cls: ActionDef['cls'], to: Status, extra: Partial<ActionDef> = {}): ActionDef => ({ action, label, small, cls, to, ...extra });

const approve = A('approve', 'Approve', 'goes to the bank', 'primary', 'approved');
const changes = A('request_changes', 'Request changes', 'with a note', '', 'changes', { needsNote: true });
const hold = A('hold', 'Put on hold', 'keep for later', 'ghost', 'hold');
const sent = A('mark_sent', 'Mark as sent', 'sent from Klaviyo', 'ghost', 'sent', { adminOnly: true });
const toReview = A('move_to_review', 'Move to review', 'emails the reviewer', '', 'review', { adminOnly: true });

// What a client approver can do. The client decides; the client never schedules or sends.
const REVIEWER: Record<Status, ActionDef[]> = {
  draft: [approve, changes, hold],
  review: [approve, changes, hold],
  changes: [A('approve', 'Approve as is', 'no change needed', '', 'approved'), hold],
  approved: [A('request_date', 'Request a send date', 'pick an open slot', 'primary', 'requested', { needsDate: true }), hold],
  requested: [A('request_date', 'Pick another date', 'pick an open slot', '', 'requested', { needsDate: true }), A('withdraw_date', 'Withdraw the date', 'back to the bank', 'ghost', 'approved')],
  hold: [A('back_to_review', 'Back to review', 'I want to use this', 'primary', 'review'), A('approve', 'Approve as is', 'goes to the bank', '', 'approved')],
  scheduled: [],
  sent: [],
};

// What ECD can do. ECD confirms dates, because ECD is who schedules in Klaviyo.
const ADMIN: Record<Status, ActionDef[]> = {
  draft: [approve, changes, hold, toReview],
  review: [approve, changes, hold],
  changes: [toReview, A('approve', 'Approve as is', 'no change needed', '', 'approved'), hold],
  approved: [A('schedule', 'Schedule', 'pick an open slot', 'primary', 'scheduled', { needsDate: true, adminOnly: true }), hold, sent],
  requested: [
    A('confirm_date', 'Confirm the date', 'scheduled in Klaviyo', 'primary', 'scheduled', { keepsDate: true, adminOnly: true }),
    A('move_date', 'Schedule another day', 'pick an open slot', '', 'scheduled', { needsDate: true, adminOnly: true }),
    A('withdraw_date', 'Back to the bank', 'drop the date', 'ghost', 'approved'),
    sent,
  ],
  hold: [A('back_to_review', 'Back to review', 'I want to use this', 'primary', 'review'), A('approve', 'Approve as is', 'goes to the bank', '', 'approved'), sent],
  scheduled: [A('move_date', 'Move date', 'pick another slot', '', 'scheduled', { needsDate: true, adminOnly: true }), A('unschedule', 'Unschedule', 'back to the bank', '', 'approved', { adminOnly: true }), sent],
  sent: [A('reopen', 'Reopen to hold', 'rare', 'ghost', 'hold', { adminOnly: true })],
};

/** Commenters see everything and leave notes, but decide nothing. */
export function actionsFor(status: Status, role: Role, canApprove = true): ActionDef[] {
  if (role === 'admin') return ADMIN[status] ?? [];
  return canApprove ? (REVIEWER[status] ?? []) : [];
}

export function findAction(status: Status, role: Role, action: Action, canApprove = true): ActionDef | null {
  return actionsFor(status, role, canApprove).find((a) => a.action === action) ?? null;
}

/** Toast messages, copied from the prototype where they exist. */
export function toastFor(action: Action, date?: string): string {
  const d = date ? fmtShort(date) : 'that day';
  switch (action) {
    case 'approve':
      return 'Approved. It is in the bank.';
    case 'request_changes':
      return 'Sent back to ECD with your note.';
    case 'hold':
      return 'On hold. Nothing is lost.';
    case 'back_to_review':
      return 'Back in review.';
    case 'request_date':
      return `Date requested for ${d}. ECD will confirm it.`;
    case 'withdraw_date':
      return 'Back in the bank, slot reopened.';
    case 'confirm_date':
    case 'schedule':
      return `Scheduled for ${d}.`;
    case 'unschedule':
      return 'Back in the bank, slot reopened.';
    case 'move_to_review':
      return 'In review. The reviewer will get an email.';
    case 'mark_sent':
      return 'Marked as sent.';
    case 'move_date':
      return `Moved to ${d}.`;
    case 'reopen':
      return 'Reopened to hold.';
  }
}

/** Thread entry written when no note is given. */
export function threadLineFor(action: Action, date?: string, version?: number): string {
  const d = date ? fmtShort(date) : 'an open slot';
  switch (action) {
    case 'approve':
      return version ? `Approved version ${version}.` : 'Approved.';
    case 'request_changes':
      return 'Requested changes.';
    case 'hold':
      return 'Put on hold.';
    case 'back_to_review':
      return 'Back to review.';
    case 'request_date':
      return `Requested ${d} as the send date.`;
    case 'withdraw_date':
      return 'Withdrew the date, back in the bank.';
    case 'confirm_date':
      return `Confirmed. Scheduled for ${d}.`;
    case 'schedule':
      return `Scheduled for ${d}.`;
    case 'unschedule':
      return 'Unscheduled, back in the bank.';
    case 'move_to_review':
      return 'Ready for your review.';
    case 'mark_sent':
      return 'Marked as sent.';
    case 'move_date':
      return `Moved to ${d}.`;
    case 'reopen':
      return 'Reopened to hold.';
  }
}

export const NOTE_REQUIRED = 'Add a short note so ECD knows what to change.';
export const COMMENTER_ONLY = 'You can leave notes here. Decisions are made by the approvers on your team.';

export type ApplyResult = { ok: true; to: Status; def: ActionDef } | { ok: false; reason: string };

/** Validates an action for a status and role. Date validity is checked by the caller. */
export function applyAction(status: Status, action: Action, role: Role, note?: string, canApprove = true): ApplyResult {
  if (role === 'reviewer' && !canApprove) return { ok: false, reason: COMMENTER_ONLY };
  const def = findAction(status, role, action, canApprove);
  if (!def) return { ok: false, reason: 'That action is not available right now.' };
  if (def.needsNote && !(note ?? '').trim()) return { ok: false, reason: NOTE_REQUIRED };
  return { ok: true, to: def.to, def };
}

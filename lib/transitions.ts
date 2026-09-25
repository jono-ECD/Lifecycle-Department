// The status model from HANDOFF.md section 4 and the prototype's renderDrawer. Pure functions, unit tested.
import type { Role, Status } from '@/lib/status';
import { fmtShort } from '@/lib/dates';

export type Action =
  | 'approve'
  | 'request_changes'
  | 'hold'
  | 'back_to_review'
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
  /** Reviewer note is required (prototype: Request changes). */
  needsNote?: boolean;
  /** Opens the slot picker; the transition happens when a slot is picked. */
  needsDate?: boolean;
  /** Admin only. */
  adminOnly?: boolean;
}

const A = (action: Action, label: string, small: string, cls: ActionDef['cls'], to: Status, extra: Partial<ActionDef> = {}): ActionDef => ({ action, label, small, cls, to, ...extra });

// Reviewer actions, copied from the prototype with the same labels, captions and order.
const REVIEWER: Record<Status, ActionDef[]> = {
  draft: [A('approve', 'Approve', 'goes to the bank', 'primary', 'approved'), A('request_changes', 'Request changes', 'with a note', '', 'draft', { needsNote: true }), A('hold', 'Put on hold', 'keep for later', 'ghost', 'hold')],
  review: [A('approve', 'Approve', 'goes to the bank', 'primary', 'approved'), A('request_changes', 'Request changes', 'with a note', '', 'draft', { needsNote: true }), A('hold', 'Put on hold', 'keep for later', 'ghost', 'hold')],
  approved: [A('schedule', 'Schedule', 'pick an open slot', 'primary', 'scheduled', { needsDate: true }), A('hold', 'Put on hold', 'keep for later', 'ghost', 'hold')],
  hold: [A('back_to_review', 'Back to review', 'I want to use this', 'primary', 'review'), A('approve', 'Approve as is', 'goes to the bank', '', 'approved')],
  scheduled: [A('unschedule', 'Unschedule', 'back to the bank', '', 'approved')],
  sent: [],
};

// What an admin can do on top of the reviewer actions.
const ADMIN_EXTRA: Record<Status, ActionDef[]> = {
  draft: [A('move_to_review', 'Move to review', 'the reviewer gets an email', '', 'review', { adminOnly: true })],
  review: [],
  approved: [A('mark_sent', 'Mark as sent', 'sent from Klaviyo', 'ghost', 'sent', { adminOnly: true })],
  hold: [A('mark_sent', 'Mark as sent', 'sent from Klaviyo', 'ghost', 'sent', { adminOnly: true })],
  scheduled: [A('move_date', 'Move date', 'pick another slot', '', 'scheduled', { needsDate: true, adminOnly: true }), A('mark_sent', 'Mark as sent', 'sent from Klaviyo', 'ghost', 'sent', { adminOnly: true })],
  sent: [A('reopen', 'Reopen to hold', 'rare', 'ghost', 'hold', { adminOnly: true })],
};

export function actionsFor(status: Status, role: Role): ActionDef[] {
  const base = REVIEWER[status] ?? [];
  return role === 'admin' ? [...base, ...(ADMIN_EXTRA[status] ?? [])] : base;
}

export function findAction(status: Status, role: Role, action: Action): ActionDef | null {
  return actionsFor(status, role).find((a) => a.action === action) ?? null;
}

/** Toast messages, copied from the prototype where they exist. */
export function toastFor(action: Action, date?: string): string {
  switch (action) {
    case 'approve':
      return 'Approved. It is in the bank.';
    case 'request_changes':
      return 'Sent back to ECD with your note.';
    case 'hold':
      return 'On hold. Nothing is lost.';
    case 'back_to_review':
      return 'Back in review.';
    case 'schedule':
      return `Scheduled for ${date ? fmtShort(date) : 'the open slot'}.`;
    case 'unschedule':
      return 'Back in the bank, slot reopened.';
    case 'move_to_review':
      return 'In review. The reviewer will get an email.';
    case 'mark_sent':
      return 'Marked as sent.';
    case 'move_date':
      return `Moved to ${date ? fmtShort(date) : 'the new slot'}.`;
    case 'reopen':
      return 'Reopened to hold.';
  }
}

/** Thread entry written when no note is given. */
export function threadLineFor(action: Action, date?: string): string {
  switch (action) {
    case 'approve':
      return 'Approved.';
    case 'request_changes':
      return 'Requested changes.';
    case 'hold':
      return 'Put on hold.';
    case 'back_to_review':
      return 'Back to review.';
    case 'schedule':
      return `Scheduled for ${date ? fmtShort(date) : 'an open slot'}.`;
    case 'unschedule':
      return 'Unscheduled, back in the bank.';
    case 'move_to_review':
      return 'Ready for your review.';
    case 'mark_sent':
      return 'Marked as sent.';
    case 'move_date':
      return `Moved to ${date ? fmtShort(date) : 'a new slot'}.`;
    case 'reopen':
      return 'Reopened to hold.';
  }
}

export const NOTE_REQUIRED = 'Add a short note so ECD knows what to change.';

export type ApplyResult = { ok: true; to: Status; def: ActionDef } | { ok: false; reason: string };

/** Validates an action for a status and role. Date and note validity are checked by the caller. */
export function applyAction(status: Status, action: Action, role: Role, note?: string): ApplyResult {
  const def = findAction(status, role, action);
  if (!def) return { ok: false, reason: 'That action is not available right now.' };
  if (def.needsNote && !(note ?? '').trim()) return { ok: false, reason: NOTE_REQUIRED };
  return { ok: true, to: def.to, def };
}

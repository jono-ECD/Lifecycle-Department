// Every event that leaves the app carries a self contained payload, so Slack, Asana and webhooks
// can render it without touching the database again.

export type IntegrationEventType =
  | 'change_request'
  | 'comment'
  | 'pin_created'
  | 'pin_reply'
  | 'pin_resolved'
  | 'pin_reopened'
  | 'approved'
  | 'hold'
  | 'back_to_review'
  | 'scheduled'
  | 'unscheduled'
  | 'moved_to_review'
  | 'marked_sent'
  | 'version_uploaded';

export type IntegrationTarget = 'slack' | 'asana' | 'webhook';

export interface EventPayload {
  type: IntegrationEventType;
  workspace: { id: string; name: string; slug: string };
  campaign: { id: string; name: string; subtitle: string; status: string; version: number };
  actor: { role: 'admin' | 'reviewer'; name: string };
  /** The client's words, verbatim. */
  text?: string;
  /** Which email in a multi email campaign. */
  em?: { index: number; count: number };
  pin?: { threadId: string; number: number; position: string; cropUrl: string | null; x: number; y: number; w: number | null; h: number | null };
  /** For change requests, the thread entry that holds the note. */
  commentId?: string;
  date?: string;
  links: { admin: string; reviewer: string };
  at: string;
}

/** Events that are actions for ECD, as opposed to status updates. */
export const ACTIONABLE: IntegrationEventType[] = ['change_request', 'comment', 'pin_created', 'pin_reply'];

export function headline(p: EventPayload): string {
  const who = p.actor.name;
  const c = p.campaign.name;
  switch (p.type) {
    case 'change_request':
      return `${who} requested changes on ${c}`;
    case 'comment':
      return `${who} left a note on ${c}`;
    case 'pin_created':
      return `${who} left note ${p.pin?.number ?? ''} on ${c}`.replace('  ', ' ');
    case 'pin_reply':
      return `${who} replied on note ${p.pin?.number ?? ''} of ${c}`.replace('  ', ' ');
    case 'pin_resolved':
      return `${who} marked note ${p.pin?.number ?? ''} on ${c} as done`.replace('  ', ' ');
    case 'pin_reopened':
      return `${who} reopened note ${p.pin?.number ?? ''} on ${c}`.replace('  ', ' ');
    case 'approved':
      return `${who} approved ${c}`;
    case 'hold':
      return `${who} put ${c} on hold`;
    case 'back_to_review':
      return `${who} moved ${c} back to review`;
    case 'scheduled':
      return `${who} scheduled ${c}${p.date ? ` for ${p.date}` : ''}`;
    case 'unscheduled':
      return `${who} unscheduled ${c}`;
    case 'moved_to_review':
      return `${who} moved ${c} to review`;
    case 'marked_sent':
      return `${who} marked ${c} as sent`;
    case 'version_uploaded':
      return `${who} uploaded version ${p.campaign.version} of ${c}`;
  }
}

/** One line of context: workspace, email number, version, position. */
export function contextLine(p: EventPayload): string {
  const parts = [p.workspace.name];
  if (p.em && p.em.count > 1) parts.push(`EM${p.em.index} of ${p.em.count}`);
  if (p.campaign.version > 0) parts.push(`version ${p.campaign.version}`);
  if (p.pin) parts.push(`${p.pin.position}, note ${p.pin.number}`);
  return parts.join(' · ');
}

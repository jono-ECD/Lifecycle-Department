// Labels and order. The six statuses of the prototype, plus two that keep the record honest:
// "Changes requested" (instead of falling back to Draft) and "Date requested" (a client picking a
// date is a request; Scheduled means ECD really scheduled it).
export const TYPES = { promo: 'Promo', spot: 'Product Spotlight', edu: 'Education', ever: 'Evergreen' } as const;
export const STATUS = {
  draft: 'Draft',
  review: 'In review',
  changes: 'Changes requested',
  approved: 'Approved',
  requested: 'Date requested',
  hold: 'On hold',
  scheduled: 'Scheduled',
  sent: 'Sent',
} as const;
export const ORDER = ['review', 'changes', 'approved', 'requested', 'hold', 'draft', 'scheduled', 'sent'] as const;
export const CHANNELS = { email: 'Email', sms: 'SMS' } as const;

export type CampaignType = keyof typeof TYPES;
export type Status = keyof typeof STATUS;
export type Channel = keyof typeof CHANNELS;
export type Role = 'admin' | 'reviewer';

export const TYPE_KEYS = Object.keys(TYPES) as CampaignType[];
export const STATUS_KEYS = Object.keys(STATUS) as Status[];
export const CHANNEL_KEYS = Object.keys(CHANNELS) as Channel[];

/** Statuses that hold a day on the calendar. */
export const HOLDS_A_DAY: Status[] = ['requested', 'scheduled'];
/** Statuses whose approval is voided by a new design version. */
export const VOIDED_BY_NEW_VERSION: Status[] = ['approved', 'requested', 'changes'];

export function isStatus(s: string): s is Status {
  return s in STATUS;
}
export function isType(s: string): s is CampaignType {
  return s in TYPES;
}

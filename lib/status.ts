// Copied from the prototype. Labels and order are part of the spec.
export const TYPES = { promo: 'Promo', spot: 'Product Spotlight', edu: 'Education', ever: 'Evergreen' } as const;
export const STATUS = { draft: 'Draft', review: 'In review', approved: 'Approved', hold: 'On hold', scheduled: 'Scheduled', sent: 'Sent' } as const;
export const ORDER = ['review', 'approved', 'hold', 'draft', 'scheduled', 'sent'] as const;

export type CampaignType = keyof typeof TYPES;
export type Status = keyof typeof STATUS;
export type Role = 'admin' | 'reviewer';

export const TYPE_KEYS = Object.keys(TYPES) as CampaignType[];
export const STATUS_KEYS = Object.keys(STATUS) as Status[];

export function isStatus(s: string): s is Status {
  return s in STATUS;
}
export function isType(s: string): s is CampaignType {
  return s in TYPES;
}

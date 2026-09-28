// How many sends each day already holds: campaigns scheduled or with a date requested in the bank,
// plus items planned in the content calendar. A planned item that is the same campaign counts once.
import type { Workspace } from '@prisma/client';
import { db } from '@/lib/db';
import { dateToYmd, todayYmd, type Ymd } from '@/lib/dates';
import { sameCampaign } from '@/lib/integrations/sheet';
import { HOLDS_A_DAY, type Role } from '@/lib/status';
import type { SlotInput } from '@/lib/slots';

export interface Planned {
  label: string;
  note: string | null;
}

/** Planned items for a day that are not already represented by a campaign holding that day. */
export function unmatched(planned: Planned[], names: string[]): Planned[] {
  const left = [...names];
  return planned.filter((p) => {
    const i = left.findIndex((n) => sameCampaign(n, p.label));
    if (i >= 0) {
      left.splice(i, 1);
      return false;
    }
    return true;
  });
}

export async function dayCounts(workspaceId: string, excludeCampaignId?: string): Promise<Record<Ymd, number>> {
  const [holding, planned] = await Promise.all([
    db.campaign.findMany({ where: { workspaceId, status: { in: HOLDS_A_DAY }, scheduledDate: { not: null }, ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {}) }, select: { name: true, scheduledDate: true } }),
    db.scheduleItem.findMany({ where: { workspaceId }, select: { date: true, label: true, note: true } }),
  ]);
  // the campaign being moved must not be blocked by its own line in the calendar
  const moving = excludeCampaignId ? await db.campaign.findUnique({ where: { id: excludeCampaignId }, select: { name: true } }) : null;
  const names = new Map<Ymd, string[]>();
  for (const s of holding) {
    const k = dateToYmd(s.scheduledDate!);
    names.set(k, [...(names.get(k) ?? []), s.name]);
  }
  const plans = new Map<Ymd, Planned[]>();
  for (const p of planned) {
    if (moving && sameCampaign(moving.name, p.label)) continue;
    const k = dateToYmd(p.date);
    plans.set(k, [...(plans.get(k) ?? []), { label: p.label, note: p.note }]);
  }
  const counts: Record<Ymd, number> = {};
  for (const k of new Set([...names.keys(), ...plans.keys()])) {
    const n = names.get(k) ?? [];
    counts[k] = n.length + unmatched(plans.get(k) ?? [], n).length;
  }
  return counts;
}

/** Send days ECD opened, when the workspace lists its slots. Null when every day is open. */
export async function listedSlots(workspace: Pick<Workspace, 'id' | 'slotMode'>): Promise<Record<Ymd, number> | null> {
  if (workspace.slotMode !== 'listed') return null;
  const rows = await db.openSlot.findMany({ where: { workspaceId: workspace.id } });
  return Object.fromEntries(rows.map((r) => [dateToYmd(r.date), r.capacity]));
}

/** Everything checkSlot needs for one campaign and one role. */
export async function slotInputFor(workspace: Workspace, campaign: { id: string; validFrom: Date | null; validUntil: Date | null }, role: Role): Promise<SlotInput> {
  const [counts, blocks, listed] = await Promise.all([dayCounts(workspace.id, campaign.id), db.calendarBlock.findMany({ where: { workspaceId: workspace.id }, select: { date: true } }), listedSlots(workspace)]);
  return {
    today: todayYmd(workspace.timezone),
    windowDays: workspace.windowDays,
    maxPerDay: workspace.maxPerDay,
    counts,
    blocked: blocks.map((b) => dateToYmd(b.date)),
    role,
    listed,
    offer: campaign.validFrom || campaign.validUntil ? { from: campaign.validFrom ? dateToYmd(campaign.validFrom) : null, until: campaign.validUntil ? dateToYmd(campaign.validUntil) : null } : null,
  };
}

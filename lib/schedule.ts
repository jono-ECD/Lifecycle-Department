// How many sends each day already holds: campaigns scheduled in the bank plus items planned in the
// content calendar. A planned item that is the same campaign as a scheduled one counts once.
import { db } from '@/lib/db';
import { dateToYmd, type Ymd } from '@/lib/dates';
import { sameCampaign } from '@/lib/integrations/sheet';

export interface Planned {
  label: string;
  note: string | null;
}

/** Planned items for a day that are not already represented by a scheduled campaign. */
export function unmatched(planned: Planned[], scheduledNames: string[]): Planned[] {
  const left = [...scheduledNames];
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
  const [scheduled, planned] = await Promise.all([
    db.campaign.findMany({ where: { workspaceId, status: 'scheduled', scheduledDate: { not: null }, ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {}) }, select: { name: true, scheduledDate: true } }),
    db.scheduleItem.findMany({ where: { workspaceId }, select: { date: true, label: true, note: true } }),
  ]);
  // the campaign being moved must not be blocked by its own line in the calendar
  const moving = excludeCampaignId ? await db.campaign.findUnique({ where: { id: excludeCampaignId }, select: { name: true } }) : null;
  const names = new Map<Ymd, string[]>();
  for (const s of scheduled) {
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

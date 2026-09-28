// Revision analytics from the event log: how long approvals take, how many rounds, how often work is held.
import { db } from '@/lib/db';

export interface Insights {
  decided: number;
  medianDaysToApprove: number | null;
  roundsPerCampaign: number | null;
  holdRate: number | null;
  waiting: number;
  oldestWaitingDays: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Pure part, unit tested. Events are status entries in time order per campaign. */
export function summarize(campaigns: { status: string; reviewEnteredAt: Date | null; events: { toStatus: string | null; fromStatus: string | null; createdAt: Date }[] }[], now: Date): Insights {
  const days: number[] = [];
  let rounds = 0;
  let decided = 0;
  let held = 0;
  for (const c of campaigns) {
    const ev = [...c.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const changes = ev.filter((e) => e.toStatus === 'changes' || (e.toStatus === 'draft' && e.fromStatus === 'review')).length;
    const approved = ev.find((e) => e.toStatus === 'approved');
    const everHeld = ev.some((e) => e.toStatus === 'hold');
    if (approved || changes || everHeld) {
      decided++;
      rounds += changes + 1;
      if (everHeld) held++;
    }
    // time from the first move into review to the first approval after it
    const entered = ev.find((e) => e.toStatus === 'review');
    const start = entered?.createdAt ?? c.reviewEnteredAt;
    if (approved && start && approved.createdAt > start) days.push((approved.createdAt.getTime() - start.getTime()) / 86400000);
  }
  const waiting = campaigns.filter((c) => c.status === 'review');
  const oldest = waiting.map((c) => c.reviewEnteredAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
  return {
    decided,
    medianDaysToApprove: median(days),
    roundsPerCampaign: decided ? rounds / decided : null,
    holdRate: decided ? held / decided : null,
    waiting: waiting.length,
    oldestWaitingDays: oldest ? Math.floor((now.getTime() - oldest.getTime()) / 86400000) : null,
  };
}

export async function loadInsights(workspaceId: string): Promise<Insights> {
  const campaigns = await db.campaign.findMany({ where: { workspaceId }, select: { status: true, reviewEnteredAt: true, comments: { where: { kind: 'status' }, select: { toStatus: true, fromStatus: true, createdAt: true } } } });
  return summarize(campaigns.map((c) => ({ status: c.status, reviewEnteredAt: c.reviewEnteredAt, events: c.comments })), new Date());
}

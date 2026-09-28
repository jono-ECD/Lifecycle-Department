// Revision analytics for ECD, from the event log. Server component.
import { loadInsights } from '@/lib/insights';
import { pct } from '@/lib/format';

const days = (n: number | null) => (n == null ? '' : n < 1 ? 'same day' : `${n.toFixed(n < 10 ? 1 : 0)} days`);

export async function InsightsPanel({ workspaceId }: { workspaceId: string }) {
  const i = await loadInsights(workspaceId);
  if (i.decided === 0 && i.waiting === 0) return null;
  return (
    <div className="panel" data-testid="insights">
      <div className="k">How reviews are going</div>
      <div className="tiles insights">
        <div>
          <b>{i.medianDaysToApprove == null ? 'n/a' : days(i.medianDaysToApprove)}</b>
          <span>typical time to approve</span>
        </div>
        <div>
          <b>{i.roundsPerCampaign == null ? 'n/a' : i.roundsPerCampaign.toFixed(1)}</b>
          <span>rounds per campaign</span>
        </div>
        <div>
          <b>{i.holdRate == null ? 'n/a' : pct(i.holdRate)}</b>
          <span>put on hold at some point</span>
        </div>
        <div>
          <b>{i.waiting}</b>
          <span>{i.waiting === 1 ? 'waiting for review' : 'waiting for review'}{i.oldestWaitingDays ? `, oldest ${i.oldestWaitingDays} days` : ''}</span>
        </div>
      </div>
    </div>
  );
}

// Compact activity feed for the admin workspace page. Server component.
import { db } from '@/lib/db';
import { fmtStamp } from '@/lib/dates';
import { STATUS, type Status } from '@/lib/status';

export async function ActivityFeed({ workspaceId, slug, timezone, limit = 8 }: { workspaceId: string; slug: string; timezone: string; limit?: number }) {
  const entries = await db.comment.findMany({
    where: { campaign: { workspaceId } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { campaign: { select: { id: true, name: true } } },
  });
  return (
    <div className="panel" data-testid="activity-feed">
      <div className="k">Recent activity</div>
      <div className="activity">
        {entries.map((m) => (
          <div key={m.id} className={'msg' + (m.authorKind === 'admin' ? ' you' : '') + (m.kind === 'system' ? ' sys' : '')}>
            <a className="c link" href={`/admin/w/${slug}/campaigns/${m.campaign.id}/edit`}>
              {m.campaign.name}
            </a>
            <b>{m.authorName}</b>
            <span>{fmtStamp(m.createdAt, timezone)}</span>
            {m.kind === 'status' && m.toStatus && (
              <span className={'pill ' + m.toStatus} style={{ marginLeft: 8 }}>
                {STATUS[m.toStatus as Status]}
              </span>
            )}
            <div>{m.body}</div>
          </div>
        ))}
        {entries.length === 0 && <div className="small">Nothing has happened yet.</div>}
      </div>
      <a className="link small" href={`/admin/w/${slug}/activity`}>
        See all activity
      </a>
    </div>
  );
}

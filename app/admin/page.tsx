import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { ORDER, STATUS } from '@/lib/status';

export const dynamic = 'force-dynamic';

function age(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default async function AdminHome() {
  await requireAdmin();
  const workspaces = await db.workspace.findMany({ orderBy: { name: 'asc' }, include: { campaigns: { select: { status: true, reviewEnteredAt: true, lastActivityAt: true } } } });
  return (
    <div className="app">
      <AdminNav current="workspaces" />
      <div className="page-h">
        <div>
          <h2>Workspaces</h2>
          <p>One bank per client.</p>
        </div>
        <a className="btn primary" href="/admin/workspaces/new">
          New workspace
        </a>
      </div>
      <div className="cards">
        {workspaces.map((w) => {
          const counts: Record<string, number> = {};
          let oldest: Date | null = null;
          for (const c of w.campaigns) {
            counts[c.status] = (counts[c.status] ?? 0) + 1;
            if (c.status === 'review') {
              const t = c.reviewEnteredAt ?? c.lastActivityAt;
              if (!oldest || t < oldest) oldest = t;
            }
          }
          return (
            <a key={w.id} className="wcard" href={`/admin/w/${w.slug}`}>
              <h3>{w.name}</h3>
              <div className="counts">
                {ORDER.map((s) => (
                  <span key={s} className={'pill ' + s}>
                    {STATUS[s]} {counts[s] ?? 0}
                  </span>
                ))}
              </div>
              <div className="age">{oldest ? <>Oldest in review: <b>{age(oldest)}</b></> : 'Nothing waiting for review.'}</div>
            </a>
          );
        })}
        {workspaces.length === 0 && <div className="empty">No workspaces yet.</div>}
      </div>
    </div>
  );
}

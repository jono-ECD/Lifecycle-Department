import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { fmtStamp } from '@/lib/dates';
import { STATUS, type Status } from '@/lib/status';

export const dynamic = 'force-dynamic';

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug } });
  if (!ws) notFound();
  const entries = await db.comment.findMany({
    where: { campaign: { workspaceId: ws.id } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { campaign: { select: { id: true, name: true } } },
  });
  return (
    <div className="app">
      <AdminNav slug={ws.slug} name={ws.name} current="activity" />
      <div className="page-h">
        <div>
          <h2>Activity</h2>
          <p>The last 50 thread entries across {ws.name}.</p>
        </div>
      </div>
      <div className="activity">
        {entries.map((m) => (
          <div key={m.id} className={'msg' + (m.authorKind === 'admin' ? ' you' : '') + (m.kind === 'system' ? ' sys' : '')}>
            <a className="c link" href={`/admin/w/${ws.slug}/campaigns/${m.campaign.id}/edit`}>
              {m.campaign.name}
            </a>
            <b>{m.authorName}</b>
            <span>{fmtStamp(m.createdAt, ws.timezone)}</span>
            {m.kind === 'status' && m.toStatus && (
              <span className={'pill ' + m.toStatus} style={{ marginLeft: 8 }}>
                {STATUS[m.toStatus as Status]}
              </span>
            )}
            <div>{m.body}</div>
          </div>
        ))}
        {entries.length === 0 && <div className="empty">Nothing has happened yet.</div>}
      </div>
    </div>
  );
}

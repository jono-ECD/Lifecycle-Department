import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { ReviewerPanel } from '@/components/ReviewerPanel';
import { BlocksPanel } from '@/components/BlocksPanel';
import { SlotsPanel } from '@/components/SlotsPanel';
import { WorkspaceForm } from '@/components/WorkspaceForm';
import { assetUrl } from '@/lib/uploads';
import { dateToYmd, fmtStamp, todayYmd } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug }, include: { reviewers: { orderBy: { createdAt: 'asc' } }, blocks: { orderBy: { date: 'asc' } }, openSlots: { orderBy: { date: 'asc' } } } });
  if (!ws) notFound();
  const today = todayYmd(ws.timezone);
  return (
    <div className="app">
      <AdminNav slug={ws.slug} name={ws.name} current="settings" />
      <div className="page-h">
        <div>
          <h2>Reviewers and calendar</h2>
          <p>{ws.name}</p>
        </div>
      </div>
      <div className="panels" style={{ marginTop: 0 }}>
        <ReviewerPanel workspaceId={ws.id} initial={ws.reviewers.map((r) => ({ id: r.id, name: r.name, email: r.email, hasPin: !!r.pinHash, lastSeen: r.lastSeenAt ? fmtStamp(r.lastSeenAt, ws.timezone) : null, revoked: !!r.revokedAt, canApprove: r.canApprove }))} />
        <BlocksPanel workspaceId={ws.id} today={today} initial={ws.blocks.map((b) => ({ id: b.id, date: dateToYmd(b.date), label: b.label }))} />
      </div>
      {ws.slotMode === 'listed' && (
        <div style={{ marginTop: 14 }}>
          <SlotsPanel workspaceId={ws.id} today={today} initial={ws.openSlots.filter((s) => dateToYmd(s.date) >= today).map((s) => ({ date: dateToYmd(s.date), capacity: s.capacity }))} />
        </div>
      )}
      {admin.role === 'admin' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="k">Workspace</div>
          <h3>Settings</h3>
          <WorkspaceForm initial={{ id: ws.id, name: ws.name, slug: ws.slug, timezone: ws.timezone, windowDays: ws.windowDays, maxPerDay: ws.maxPerDay, brandColor: ws.brandColor ?? '', logoUrl: assetUrl(ws.logoPath), clientSeesDrafts: ws.clientSeesDrafts, slotMode: ws.slotMode }} />
        </div>
      )}
    </div>
  );
}

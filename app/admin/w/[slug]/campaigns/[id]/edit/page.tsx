import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { CampaignEditor } from '@/components/CampaignEditor';
import { assetUrl } from '@/lib/uploads';
import { dateToYmd } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { slug, id } = await params;
  const sp = await searchParams;
  const ws = await db.workspace.findUnique({ where: { slug } });
  if (!ws) notFound();
  const c = await db.campaign.findUnique({ where: { id }, include: { assets: { orderBy: [{ version: 'asc' }, { orderIndex: 'asc' }] } } });
  if (!c || c.workspaceId !== ws.id) notFound();
  return (
    <div className="app">
      <AdminNav slug={ws.slug} name={ws.name} current="bank" />
      <div className="page-h">
        <div>
          <h2>{c.name}</h2>
          <p>{sp.saved ? 'Saved. ' : ''}Version {c.currentVersion || 'none yet'}. Uploading again creates the next version and keeps the old one in the thread.</p>
        </div>
      </div>
      <CampaignEditor
        workspaceId={ws.id}
        base={`/admin/w/${ws.slug}`}
        campaign={{
          id: c.id,
          name: c.name,
          subtitle: c.subtitle,
          type: c.type,
          status: c.status,
          builtDate: dateToYmd(c.builtDate),
          scheduledDate: c.scheduledDate ? dateToYmd(c.scheduledDate) : '',
          currentVersion: c.currentVersion,
          assets: c.assets.map((a) => ({ id: a.id, version: a.version, kind: a.kind, url: assetUrl(a.path)!, thumbUrl: assetUrl(a.thumbPath), name: a.originalName, size: a.size })),
        }}
      />
    </div>
  );
}

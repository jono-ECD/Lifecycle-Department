import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { loadBank } from '@/lib/bank';
import { Bank } from '@/components/Bank';
import { AdminNav } from '@/components/AdminNav';
import { ActivityFeed } from '@/components/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function AdminWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug } });
  if (!ws) notFound();
  const bank = await loadBank(ws, { role: 'admin', admin, name: admin.name, id: admin.id });
  const base = `/admin/w/${ws.slug}`;
  return (
    <>
      <div className="app" style={{ paddingBottom: 0 }}>
        <AdminNav slug={ws.slug} name={ws.name} current="bank" />
      </div>
      <Bank initial={bank} adminBase={base} />
      <div className="app" style={{ marginTop: -50 }}>
        <ActivityFeed workspaceId={ws.id} slug={ws.slug} timezone={ws.timezone} />
      </div>
    </>
  );
}

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { loadHistory } from '@/lib/history';
import { History } from '@/components/History';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug } });
  if (!ws) notFound();
  return (
    <>
      <div className="app" style={{ paddingBottom: 0 }}>
        <AdminNav slug={ws.slug} name={ws.name} current="history" />
      </div>
      <History data={await loadHistory(ws)} backHref={`/admin/w/${ws.slug}`} admin />
    </>
  );
}

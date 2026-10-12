import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { CampaignEditor } from '@/components/CampaignEditor';
import { todayYmd } from '@/lib/dates';
import { envStatus } from '@/lib/integrations/env';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug } });
  if (!ws) notFound();
  return (
    <div className="app">
      <AdminNav slug={ws.slug} name={ws.name} current="new" />
      <div className="page-h">
        <div>
          <h2>Add campaign</h2>
          <p>Upload the finished design and set the status. Drafts stay with ECD until you move them to review.</p>
        </div>
      </div>
      <CampaignEditor workspaceId={ws.id} base={`/admin/w/${ws.slug}`} campaign={null} today={todayYmd(ws.timezone)} figmaEnabled={envStatus().figmaToken} canDelete={false} />
    </div>
  );
}

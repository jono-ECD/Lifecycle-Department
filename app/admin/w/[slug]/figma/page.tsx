import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { FigmaImport } from '@/components/FigmaImport';
import { envStatus } from '@/lib/integrations/env';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function FigmaImportPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug }, include: { integration: true } });
  if (!ws) notFound();
  const key = ws.integration?.figmaFileKey ?? '';
  return (
    <div className="app">
      <AdminNav slug={ws.slug} name={ws.name} current="figma" />
      <div className="page-h">
        <div>
          <h2>Import from Figma</h2>
          <p>Bring finished frames into the {ws.name} bank without exporting anything by hand.</p>
        </div>
      </div>
      <FigmaImport workspaceId={ws.id} base={`/admin/w/${ws.slug}`} enabled={envStatus().figmaToken} defaultFile={key ? `https://www.figma.com/design/${key}/` : ''} sample={env('ENABLE_DEV_MOCKS') === '1' && !!env('FIGMA_API_BASE')} />
    </div>
  );
}

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { IntegrationsPanel } from '@/components/IntegrationsPanel';
import { envStatus } from '@/lib/integrations/env';
import { fmtStamp } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = await db.workspace.findUnique({ where: { slug }, include: { integration: true } });
  if (!ws) notFound();
  const events = await db.integrationEvent.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: 'desc' }, take: 40 });
  const names = new Map((await db.campaign.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const cfg = ws.integration;
  return (
    <div className="app">
      <AdminNav slug={ws.slug} name={ws.name} current="integrations" />
      <div className="page-h">
        <div>
          <h2>Connections</h2>
          <p>Where notes and change requests from {ws.name} go, so nobody has to jump between tools.</p>
        </div>
      </div>
      <IntegrationsPanel
        workspaceId={ws.id}
        env={envStatus()}
        initial={{
          slackWebhookUrl: cfg?.slackWebhookUrl ?? '',
          slackQuietUpdates: cfg?.slackQuietUpdates ?? false,
          asanaProjectGid: cfg?.asanaProjectGid ?? '',
          asanaSectionGid: cfg?.asanaSectionGid ?? '',
          asanaAssigneeEmail: cfg?.asanaAssigneeEmail ?? '',
          figmaFileKey: cfg?.figmaFileKey ?? '',
          webhookUrl: cfg?.webhookUrl ?? '',
          webhookSecret: cfg?.webhookSecret ?? '',
        }}
        events={events.map((e) => ({ id: e.id, type: e.type, target: e.target, status: e.status, error: e.error, result: e.result, attempts: e.attempts, when: fmtStamp(e.createdAt, ws.timezone), campaign: e.campaignId ? (names.get(e.campaignId) ?? null) : null }))}
      />
    </div>
  );
}

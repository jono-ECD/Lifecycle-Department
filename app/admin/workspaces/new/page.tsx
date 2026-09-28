import { requireFullAdmin as requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { WorkspaceForm } from '@/components/WorkspaceForm';

export const dynamic = 'force-dynamic';

export default async function NewWorkspacePage() {
  await requireAdmin();
  return (
    <div className="app">
      <AdminNav current="workspaces" />
      <div className="page-h">
        <div>
          <h2>New workspace</h2>
          <p>One per client. You can add reviewers and the logo after it exists.</p>
        </div>
      </div>
      <WorkspaceForm initial={{ name: '', slug: '', timezone: 'America/Chicago', windowDays: 14, maxPerDay: 1, brandColor: '', logoUrl: null, clientSeesDrafts: false, slotMode: 'open' }} />
    </div>
  );
}

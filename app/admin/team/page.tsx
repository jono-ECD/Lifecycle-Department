import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';
import { TeamForm } from '@/components/TeamForm';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  await requireAdmin();
  const admins = await db.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  return (
    <div className="app">
      <AdminNav current="team" />
      <div className="page-h">
        <div>
          <h2>ECD team</h2>
          <p>Admins can do everything in every workspace.</p>
        </div>
      </div>
      <div className="panels" style={{ marginTop: 0 }}>
        <div className="panel">
          <div className="k">Admins</div>
          <table className="tbl">
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="muted">{a.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <div className="k">Add an admin</div>
          <TeamForm />
        </div>
      </div>
    </div>
  );
}

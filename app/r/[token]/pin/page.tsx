import { db } from '@/lib/db';
import { hashToken, looksLikeToken } from '@/lib/tokens';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!looksLikeToken(token)) redirect('/link-expired');
  const reviewer = await db.reviewer.findUnique({ where: { tokenHash: hashToken(token) }, include: { workspace: true } });
  if (!reviewer || reviewer.revokedAt) redirect('/link-expired');
  if (!reviewer.pinHash) redirect(`/r/${encodeURIComponent(token)}`);
  return (
    <div className="app">
      <form className="pinbox" method="post" action="/api/reviewer/pin">
        <h1>Campaign Bank</h1>
        <p className="muted" style={{ margin: 0 }}>
          Enter your 4 digit PIN to open the {reviewer.workspace.name} bank.
        </p>
        {sp.error && <div className="err">That PIN did not match.</div>}
        <input type="hidden" name="token" value={token} />
        <input name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" autoFocus required />
        <button className="btn primary" type="submit">
          Open
        </button>
      </form>
    </div>
  );
}

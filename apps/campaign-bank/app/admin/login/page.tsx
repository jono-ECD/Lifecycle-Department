import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  if (await currentAdmin()) redirect('/admin');
  return (
    <div className="app">
      <form className="login form" method="post" action="/api/admin/login">
        <div>
          <h1>Campaign Bank</h1>
          <p>ECD admin sign in.</p>
        </div>
        {sp.error && <div className="err">That email and password did not match.</div>}
        <label>
          <b>Email</b>
          <input type="email" name="email" autoComplete="username" required autoFocus />
        </label>
        <label>
          <b>Password</b>
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {sp.next && <input type="hidden" name="next" value={sp.next} />}
        <div className="actions-r">
          <button className="btn primary" type="submit">
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}

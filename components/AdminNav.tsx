// Top strip for admin pages. Server component, plain links.
export function AdminNav({ slug, name, current }: { slug?: string; name?: string; current?: 'workspaces' | 'bank' | 'new' | 'activity' | 'settings' | 'integrations' | 'team' }) {
  const base = slug ? `/admin/w/${slug}` : '';
  return (
    <div className="admin-top">
      <a className="brand" href="/admin">
        ECD
      </a>
      <nav>
        <a href="/admin" className={current === 'workspaces' ? 'on' : ''}>
          Workspaces
        </a>
        {slug && (
          <>
            <a href={base} className={current === 'bank' ? 'on' : ''}>
              {name ?? 'Bank'}
            </a>
            <a href={`${base}/campaigns/new`} className={current === 'new' ? 'on' : ''}>
              Add campaign
            </a>
            <a href={`${base}/activity`} className={current === 'activity' ? 'on' : ''}>
              Activity
            </a>
            <a href={`${base}/settings`} className={current === 'settings' ? 'on' : ''}>
              Reviewers and calendar
            </a>
            <a href={`${base}/integrations`} className={current === 'integrations' ? 'on' : ''}>
              Connections
            </a>
          </>
        )}
        <a href="/admin/team" className={current === 'team' ? 'on' : ''}>
          Team
        </a>
      </nav>
      <span className="spacer" />
      <form method="post" action="/api/admin/logout">
        <button className="btn sm" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}

// Top strip for admin pages. Server component, plain links.
type Current = 'workspaces' | 'bank' | 'new' | 'figma' | 'history' | 'activity' | 'settings' | 'integrations' | 'team';

export function AdminNav({ slug, name, current }: { slug?: string; name?: string; current?: Current }) {
  const base = slug ? `/admin/w/${slug}` : '';
  const link = (href: string, key: Current, label: string) => (
    <a href={href} className={current === key ? 'on' : ''}>
      {label}
    </a>
  );
  return (
    <div className="admin-top">
      <a className="brand" href="/admin">
        ECD
      </a>
      <nav>
        {link('/admin', 'workspaces', 'Workspaces')}
        {slug && (
          <>
            {link(base, 'bank', name ?? 'Bank')}
            {link(`${base}/campaigns/new`, 'new', 'Add campaign')}
            {link(`${base}/figma`, 'figma', 'Import from Figma')}
            {link(`${base}/history`, 'history', 'Sent history')}
            {link(`${base}/activity`, 'activity', 'Activity')}
            {link(`${base}/settings`, 'settings', 'Reviewers and calendar')}
            {link(`${base}/integrations`, 'integrations', 'Connections')}
          </>
        )}
        {link('/admin/team', 'team', 'Team')}
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

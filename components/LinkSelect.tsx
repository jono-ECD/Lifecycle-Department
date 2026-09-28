'use client';

// ECD only: tie a Klaviyo email to a campaign in the bank when the names did not match on their own.
import { useState } from 'react';
import { api } from '@/lib/client';

export function LinkSelect({ rowId, current, options }: { rowId: string; current: string | null; options: { id: string; name: string }[] }) {
  const [value, setValue] = useState(current ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function change(v: string) {
    setValue(v);
    setState('saving');
    const r = await api(`/api/admin/klaviyo/${rowId}`, { body: { campaignId: v || null } });
    setState(r.ok ? 'saved' : 'error');
    if (r.ok) window.setTimeout(() => window.location.reload(), 500);
  }

  return (
    <span>
      <select value={value} onChange={(e) => change(e.target.value)} aria-label="Link to a campaign in the bank" disabled={state === 'saving'}>
        <option value="">Not linked to a campaign</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {state === 'error' && <span className="small"> Could not save.</span>}
    </span>
  );
}

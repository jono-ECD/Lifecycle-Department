'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/client';

export interface WorkspaceInput {
  id?: string;
  name: string;
  slug: string;
  timezone: string;
  windowDays: number;
  maxPerDay: number;
  brandColor: string;
  logoUrl: string | null;
}

export function WorkspaceForm({ initial }: { initial: WorkspaceInput }) {
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const isNew = !initial.id;

  const set = <K extends keyof WorkspaceInput>(k: K, v: WorkspaceInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const body = { name: f.name, slug: f.slug, timezone: f.timezone, windowDays: f.windowDays, maxPerDay: f.maxPerDay, brandColor: f.brandColor };
    const r = isNew ? await api<{ slug: string }>('/api/admin/workspaces', { body }) : await api<{ slug: string }>(`/api/admin/workspaces/${initial.id}`, { method: 'PATCH', body });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    if (isNew || r.data.slug !== initial.slug) {
      window.location.href = `/admin/w/${r.data.slug}${isNew ? '' : '/settings'}`;
      return;
    }
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function uploadLogo(file: File) {
    if (!initial.id) return;
    setBusy(true);
    const form = new FormData();
    form.set('logo', file, file.name);
    const r = await api<{ url: string }>(`/api/admin/workspaces/${initial.id}/logo`, { form });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    set('logoUrl', r.data.url);
    setMsg({ kind: 'ok', text: 'Logo updated.' });
  }

  return (
    <div className="form">
      {msg && <div className={msg.kind}>{msg.text}</div>}
      <label>
        <b>Name</b>
        <input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Blessed Botanicals" />
      </label>
      <div className="row2">
        <label>
          <b>Slug</b>
          <input type="text" value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="blessed-botanicals" />
        </label>
        <label>
          <b>Timezone</b>
          <input type="text" value={f.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="America/Chicago" />
        </label>
      </div>
      <div className="row2">
        <label>
          <b>Send window, days</b>
          <input type="number" min={7} max={60} value={f.windowDays} onChange={(e) => set('windowDays', Number(e.target.value))} />
        </label>
        <label>
          <b>Max campaigns per day</b>
          <input type="number" min={1} max={5} value={f.maxPerDay} onChange={(e) => set('maxPerDay', Number(e.target.value))} />
        </label>
      </div>
      <label>
        <b>Brand color, optional</b>
        <input type="text" value={f.brandColor} onChange={(e) => set('brandColor', e.target.value)} placeholder="#2f5d3a" />
      </label>
      {!isNew && (
        <div className="inline">
          {f.logoUrl ? <img src={f.logoUrl} alt="" style={{ height: 40 }} /> : <span className="small">No mark yet.</span>}
          <button className="btn" type="button" disabled={busy} onClick={() => logoInput.current?.click()}>
            Upload mark
          </button>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </div>
      )}
      <div className="actions-r">
        <button className="btn primary" type="button" disabled={busy} onClick={save}>
          {isNew ? 'Create workspace' : 'Save'}
        </button>
      </div>
    </div>
  );
}

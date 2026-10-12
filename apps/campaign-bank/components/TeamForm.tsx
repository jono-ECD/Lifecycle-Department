'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export function TeamForm() {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'editor' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    const r = await api('/api/admin/admins', { body: f });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setMsg({ kind: 'ok', text: `${f.name} can now sign in.` });
    setF({ name: '', email: '', password: '', role: 'editor' });
    window.setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="form">
      {msg && <div className={msg.kind}>{msg.text}</div>}
      <div className="row2">
        <label>
          <b>Name</b>
          <input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label>
          <b>Email</b>
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
      </div>
      <label>
        <b>Password</b>
        <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
      </label>
      <label>
        <b>Role</b>
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="editor">Editor: campaigns, reviewers, calendar</option>
          <option value="admin">Admin: also team, connections and workspaces</option>
        </select>
      </label>
      <div className="actions-r">
        <button className="btn primary" type="button" disabled={busy || !f.name || !f.email || !f.password} onClick={create}>
          Add admin
        </button>
      </div>
    </div>
  );
}

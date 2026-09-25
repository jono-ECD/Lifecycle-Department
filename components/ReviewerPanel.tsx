'use client';

// Reviewer links: create, copy, show QR, revoke, regenerate, PIN.
import { useState } from 'react';
import { api } from '@/lib/client';

export interface ReviewerRow {
  id: string;
  name: string;
  email: string;
  hasPin: boolean;
  lastSeen: string | null;
  revoked: boolean;
}

export function ReviewerPanel({ workspaceId, initial }: { workspaceId: string; initial: ReviewerRow[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [link, setLink] = useState<{ id: string; url: string; qr: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  async function showLink(id: string, url: string) {
    const q = await api<{ dataUrl: string }>('/api/admin/qr', { body: { text: url } });
    setLink({ id, url, qr: q.ok ? q.data.dataUrl : null });
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    const r = await api<{ id: string; link: string }>('/api/admin/reviewers', { body: { workspaceId, name, email } });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setRows((x) => [...x, { id: r.data.id, name, email, hasPin: false, lastSeen: null, revoked: false }]);
    setName('');
    setEmail('');
    await showLink(r.data.id, r.data.link);
  }

  async function op(id: string, body: { op: 'revoke' | 'regenerate' | 'link' | 'clear_pin' } | { op: 'set_pin'; pin: string }) {
    setBusy(true);
    setMsg(null);
    const r = await api<{ link?: string }>(`/api/admin/reviewers/${id}`, { body });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    if (body.op === 'revoke') setRows((x) => x.map((row) => (row.id === id ? { ...row, revoked: true } : row)));
    if (body.op === 'regenerate') {
      setRows((x) => x.map((row) => (row.id === id ? { ...row, revoked: false } : row)));
      if (r.data.link) await showLink(id, r.data.link);
    }
    if (body.op === 'link' && r.data.link) {
      await showLink(id, r.data.link);
      await copy(r.data.link);
    }
    if (body.op === 'set_pin') setRows((x) => x.map((row) => (row.id === id ? { ...row, hasPin: true } : row)));
    if (body.op === 'clear_pin') setRows((x) => x.map((row) => (row.id === id ? { ...row, hasPin: false } : row)));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ kind: 'ok', text: 'Link copied.' });
    } catch {
      setMsg({ kind: 'err', text: 'Copy failed. Select the link and copy it by hand.' });
    }
  }

  function setPin(id: string) {
    const pin = window.prompt('4 digit PIN for this reviewer');
    if (pin === null) return;
    void op(id, { op: 'set_pin', pin: pin.trim() });
  }

  return (
    <div className="panel">
      <div className="k">Reviewer links</div>
      <h3>Who reviews this bank</h3>
      <p className="small" style={{ margin: 0 }}>
        Each reviewer gets a personal link. It signs them in for 90 days on that device. The personal link is shown once, right after it is created. Copy link gives a 45 day link and a QR code for an existing reviewer.
      </p>
      {msg && <div className={msg.kind}>{msg.text}</div>}
      {link && (
        <div className="qr" data-testid="reviewer-link">
          {link.qr && <img src={link.qr} alt="QR code for the reviewer link" />}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="small">Reviewer link for {rows.find((r) => r.id === link.id)?.name}</div>
            <code style={{ display: 'block', wordBreak: 'break-all', margin: '6px 0' }}>{link.url}</code>
            <div className="inline">
              <button className="btn sm" type="button" onClick={() => copy(link.url)}>
                Copy link
              </button>
              <button className="btn sm" type="button" onClick={() => setLink(null)}>
                Hide
              </button>
            </div>
          </div>
        </div>
      )}
      <table className="tbl">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Last seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {r.name}
                {r.revoked && <span className="pill sent" style={{ marginLeft: 6 }}>Revoked</span>}
                {r.hasPin && <span className="pill hold" style={{ marginLeft: 6 }}>PIN</span>}
              </td>
              <td>{r.email}</td>
              <td className="muted">{r.lastSeen ?? 'never'}</td>
              <td className="r">
                {!r.revoked && (
                  <>
                    <button className="btn sm" type="button" disabled={busy} onClick={() => op(r.id, { op: 'link' })} data-testid="copy-link">
                      Copy link
                    </button>{' '}
                  </>
                )}
                <button className="btn sm" type="button" disabled={busy} onClick={() => op(r.id, { op: 'regenerate' })}>
                  New link
                </button>{' '}
                {r.hasPin ? (
                  <button className="btn sm" type="button" disabled={busy} onClick={() => op(r.id, { op: 'clear_pin' })}>
                    Clear PIN
                  </button>
                ) : (
                  <button className="btn sm" type="button" disabled={busy} onClick={() => setPin(r.id)}>
                    Set PIN
                  </button>
                )}{' '}
                {!r.revoked && (
                  <button className="btn sm danger" type="button" disabled={busy} onClick={() => op(r.id, { op: 'revoke' })}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No reviewers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="inline">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn primary" type="button" disabled={busy || !name || !email} onClick={create}>
          Create link
        </button>
      </div>
    </div>
  );
}

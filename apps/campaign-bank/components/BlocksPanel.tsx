'use client';

// Calendar blocks: days ECD marks unavailable for reasons outside the app.
import { useState } from 'react';
import { api } from '@/lib/client';
import { fmtShort } from '@/lib/dates';

export interface BlockRow {
  id: string;
  date: string;
  label: string;
}

export function BlocksPanel({ workspaceId, initial, today }: { workspaceId: string; initial: BlockRow[]; today: string }) {
  const [rows, setRows] = useState(initial);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setMsg(null);
    const r = await api<{ id: string }>('/api/admin/blocks', { body: { workspaceId, date, label } });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setRows((x) => [...x.filter((b) => b.date !== date), { id: r.data.id, date, label }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate('');
    setLabel('');
  }

  async function remove(id: string) {
    setBusy(true);
    const r = await api(`/api/admin/blocks/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setRows((x) => x.filter((b) => b.id !== id));
  }

  const upcoming = rows.filter((b) => b.date >= today);

  return (
    <div className="panel">
      <div className="k">Blocked days</div>
      <h3>Days that cannot take a campaign</h3>
      <p className="small" style={{ margin: 0 }}>
        Klaviyo flow tests, client blackouts, holidays. Blocked days are skipped by the slot picker.
      </p>
      {msg && <div className="err">{msg}</div>}
      <table className="tbl">
        <tbody>
          {upcoming.map((b) => (
            <tr key={b.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtShort(b.date)}</td>
              <td>{b.label}</td>
              <td className="r">
                <button className="btn sm" type="button" disabled={busy} onClick={() => remove(b.id)}>
                  Unblock
                </button>
              </td>
            </tr>
          ))}
          {upcoming.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No blocked days ahead.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="inline">
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        <input type="text" placeholder="Klaviyo: flow test" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn primary" type="button" disabled={busy || !date || !label} onClick={add}>
          Block day
        </button>
      </div>
    </div>
  );
}

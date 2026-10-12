'use client';

// Send days ECD makes available, for workspaces that list their slots.
import { useState } from 'react';
import { api } from '@/lib/client';
import { fmtShort, weekday2 } from '@/lib/dates';

export interface SlotRow {
  date: string;
  capacity: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SlotsPanel({ workspaceId, initial, today }: { workspaceId: string; initial: SlotRow[]; today: string }) {
  const [rows, setRows] = useState(initial);
  const [date, setDate] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([2, 4]);
  const [weeks, setWeeks] = useState(8);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const r = await api<{ slots: SlotRow[] }>('/api/admin/slots', { body: { workspaceId, ...body } });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setRows(r.data.slots.filter((s) => s.date >= today));
  }

  return (
    <div className="panel" data-testid="slots-panel">
      <div className="k">Send days</div>
      <h3>Days the client can ask for</h3>
      <p className="small" style={{ margin: 0 }}>
        This workspace lists its send days. Only these days show as open in the slot picker. Blocked days still win.
      </p>
      {msg && <div className="err">{msg}</div>}
      <div className="form" style={{ maxWidth: 'none' }}>
        <label>
          <b>Open the same weekdays</b>
          <div className="weekdays">
            {DAYS.map((d, i) => (
              <label key={d} className={weekdays.includes(i) ? 'on' : ''}>
                <input type="checkbox" checked={weekdays.includes(i)} onChange={() => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))} />
                {d}
              </label>
            ))}
          </div>
        </label>
        <div className="inline">
          <span className="small">for the next</span>
          <input type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ flex: 'none', width: 80 }} />
          <span className="small">weeks</span>
          <button className="btn primary" type="button" disabled={busy || weekdays.length === 0} onClick={() => run({ op: 'cadence', from: today, weekdays, weeks })} data-testid="open-cadence">
            Open these days
          </button>
        </div>
        <div className="inline">
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          <button className="btn" type="button" disabled={busy || !date} onClick={() => run({ op: 'open', date }).then(() => setDate(''))}>
            Open one day
          </button>
        </div>
      </div>
      <div className="inline" data-testid="open-days">
        {rows.slice(0, 40).map((s) => (
          <button key={s.date} type="button" className="btn sm" disabled={busy} title="Close this day" onClick={() => run({ op: 'close', date: s.date })}>
            {weekday2(s.date)} {fmtShort(s.date)} ×
          </button>
        ))}
        {rows.length === 0 && <span className="small">No send days open yet, so the client cannot ask for a date.</span>}
        {rows.length > 40 && <span className="small">and {rows.length - 40} more</span>}
      </div>
    </div>
  );
}

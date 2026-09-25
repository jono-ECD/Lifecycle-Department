'use client';

// Admin campaign editor: metadata, ordered multi file uploader, versions, delete.
import { useRef, useState } from 'react';
import { api } from '@/lib/client';
import { STATUS, STATUS_KEYS, TYPES, TYPE_KEYS } from '@/lib/status';

export interface EditorAsset {
  id: string;
  version: number;
  kind: string;
  url: string;
  thumbUrl: string | null;
  name: string;
  size: number;
}

export interface EditorCampaign {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  status: string;
  builtDate: string;
  scheduledDate: string;
  currentVersion: number;
  assets: EditorAsset[];
}

function fmtSize(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Ordered file list with move buttons and drag to reorder. */
function FileList<T>({ items, label, thumb, onChange }: { items: T[]; label: (t: T) => { name: string; meta: string }; thumb: (t: T) => string | null; onChange: (next: T[]) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <div className="assets">
      {items.map((it, i) => {
        const l = label(it);
        const t = thumb(it);
        return (
          <div
            key={i}
            className={'asset' + (drag === i ? ' dragging' : '')}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
          >
            <div className="th">{t ? <img src={t} alt="" /> : 'PDF'}</div>
            <div className="n">
              EM{i + 1} · {l.name}
              <span>{l.meta}</span>
            </div>
            <div className="ctl">
              <button type="button" aria-label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                ↑
              </button>
              <button type="button" aria-label="Move down" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}>
                ↓
              </button>
              <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CampaignEditor({ workspaceId, base, campaign }: { workspaceId: string; base: string; campaign: EditorCampaign | null }) {
  const isNew = !campaign;
  const [f, setF] = useState({
    name: campaign?.name ?? '',
    subtitle: campaign?.subtitle ?? '',
    type: campaign?.type ?? 'promo',
    status: campaign?.status ?? 'draft',
    builtDate: campaign?.builtDate ?? new Date().toISOString().slice(0, 10),
    scheduledDate: campaign?.scheduledDate ?? '',
  });
  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  const [current, setCurrent] = useState<EditorAsset[]>(campaign?.assets.filter((a) => a.version === campaign.currentVersion) ?? []);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const versions = campaign
    ? Array.from(new Set(campaign.assets.map((a) => a.version)))
        .sort((a, b) => b - a)
        .map((v) => ({ v, files: campaign.assets.filter((a) => a.version === v) }))
    : [];

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const next = new Map(previews);
    for (const file of files) if (file.type.startsWith('image/')) next.set(file, URL.createObjectURL(file));
    setPreviews(next);
    setPending((p) => [...p, ...files]);
  }

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    if (isNew) {
      const form = new FormData();
      form.set('workspaceId', workspaceId);
      for (const [k, v] of Object.entries(f)) form.set(k, v);
      for (const file of pending) form.append('files', file, file.name);
      const r = await api<{ id: string }>('/api/admin/campaigns', { form });
      setBusy(false);
      if (!r.ok) return setMsg({ kind: 'err', text: r.error });
      window.location.href = `${base}/campaigns/${r.data.id}/edit?saved=1`;
      return;
    }
    const r = await api(`/api/admin/campaigns/${campaign.id}`, { method: 'PATCH', body: f });
    if (!r.ok) {
      setBusy(false);
      return setMsg({ kind: 'err', text: r.error });
    }
    const orderChanged = current.map((a) => a.id).join() !== campaign.assets.filter((a) => a.version === campaign.currentVersion).map((a) => a.id).join();
    if (orderChanged && current.length) {
      const o = await api(`/api/admin/campaigns/${campaign.id}/assets`, { method: 'PATCH', body: { order: current.map((a) => a.id) } });
      if (!o.ok) {
        setBusy(false);
        return setMsg({ kind: 'err', text: o.error });
      }
    }
    if (pending.length) {
      const form = new FormData();
      for (const file of pending) form.append('files', file, file.name);
      const u = await api<{ version: number }>(`/api/admin/campaigns/${campaign.id}/assets`, { form });
      if (!u.ok) {
        setBusy(false);
        return setMsg({ kind: 'err', text: u.error });
      }
      window.location.href = `${base}/campaigns/${campaign.id}/edit?saved=1`;
      return;
    }
    setBusy(false);
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function remove() {
    if (!campaign) return;
    if (!window.confirm(`Delete "${campaign.name}" and its files? This cannot be undone.`)) return;
    setBusy(true);
    const r = await api(`/api/admin/campaigns/${campaign.id}`, { method: 'DELETE' });
    if (!r.ok) {
      setBusy(false);
      return setMsg({ kind: 'err', text: r.error });
    }
    window.location.href = base;
  }

  return (
    <div className="form" style={{ maxWidth: 720 }}>
      {msg && <div className={msg.kind}>{msg.text}</div>}
      <label>
        <b>Name</b>
        <input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Not Sure Where to Begin?" />
      </label>
      <label>
        <b>Subtitle</b>
        <input type="text" value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="One line on what it is" />
      </label>
      <div className="row2">
        <label>
          <b>Type</b>
          <select value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPE_KEYS.map((t) => (
              <option key={t} value={t}>
                {TYPES[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <b>Built</b>
          <input type="date" value={f.builtDate} onChange={(e) => set('builtDate', e.target.value)} />
        </label>
      </div>
      <div className="row2">
        <label>
          <b>Status</b>
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_KEYS.map((s) => (
              <option key={s} value={s}>
                {STATUS[s]}
              </option>
            ))}
          </select>
        </label>
        {f.status === 'scheduled' && (
          <label>
            <b>Send date</b>
            <input type="date" value={f.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
          </label>
        )}
      </div>

      {current.length > 0 && (
        <div>
          <div className="small" style={{ marginBottom: 6 }}>
            <b>Current design, version {campaign?.currentVersion}.</b> Drag or use the arrows to change the order.
          </div>
          <FileList items={current} label={(a) => ({ name: a.name || a.kind, meta: fmtSize(a.size) })} thumb={(a) => a.thumbUrl} onChange={setCurrent} />
        </div>
      )}

      <div>
        <div className="small" style={{ marginBottom: 6 }}>
          <b>{isNew ? 'Design files.' : `Upload version ${(campaign?.currentVersion ?? 0) + 1}.`}</b> PNG, JPG or WEBP up to 15 MB each, PDF up to 25 MB. EM1, EM2 and so on in the order below.
        </div>
        <div
          className={'uploader' + (over ? ' over' : '')}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          Drop files here or click to choose.
          <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" data-testid="file-input" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>
        {pending.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <FileList items={pending} label={(file) => ({ name: file.name, meta: fmtSize(file.size) })} thumb={(file) => previews.get(file) ?? null} onChange={setPending} />
          </div>
        )}
      </div>

      <div className="actions-r">
        <button className="btn primary" type="button" disabled={busy} onClick={save} data-testid="save-campaign">
          {busy ? 'Saving' : isNew ? 'Create campaign' : pending.length ? 'Save and upload' : 'Save'}
        </button>
        <a className="btn" href={base}>
          Back to the bank
        </a>
        {!isNew && (
          <button className="btn danger" type="button" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>
            Delete campaign
          </button>
        )}
      </div>

      {versions.length > 0 && (
        <div className="panel">
          <div className="k">Version history</div>
          <table className="tbl">
            <tbody>
              {versions.map(({ v, files }) => (
                <tr key={v}>
                  <td>
                    Version {v}
                    {v === campaign?.currentVersion ? ' (current)' : ''}
                  </td>
                  <td>
                    {files.map((a, i) => (
                      <span key={a.id}>
                        {i > 0 && ', '}
                        <a className="link" href={a.url} target="_blank" rel="noreferrer">
                          {a.name || `File ${i + 1}`}
                        </a>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

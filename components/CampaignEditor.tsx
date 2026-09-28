'use client';

// Admin campaign editor: metadata, channel, offer window, links to Asana, Figma and Klaviyo,
// ordered multi file uploader or SMS copy, versions, delete.
import { useRef, useState } from 'react';
import { api } from '@/lib/client';
import { CHANNELS, CHANNEL_KEYS, HOLDS_A_DAY, STATUS, STATUS_KEYS, TYPES, TYPE_KEYS, VOIDED_BY_NEW_VERSION, type Status } from '@/lib/status';

export interface EditorAsset {
  id: string;
  version: number;
  kind: string;
  url: string;
  thumbUrl: string | null;
  name: string;
  size: number;
  text: string | null;
}

export interface EditorCampaign {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  channel: string;
  status: string;
  builtDate: string;
  scheduledDate: string;
  validFrom: string;
  validUntil: string;
  figmaUrl: string;
  asanaUrl: string;
  asanaStage: string | null;
  klaviyoCampaignId: string;
  approval: string | null;
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

export function CampaignEditor({ workspaceId, base, campaign, today, figmaEnabled, canDelete }: { workspaceId: string; base: string; campaign: EditorCampaign | null; today: string; figmaEnabled: boolean; canDelete: boolean }) {
  const isNew = !campaign;
  const currentSms = campaign?.assets.find((a) => a.version === campaign.currentVersion && a.kind === 'sms')?.text ?? '';
  const [f, setF] = useState({
    name: campaign?.name ?? '',
    subtitle: campaign?.subtitle ?? '',
    type: campaign?.type ?? 'promo',
    channel: campaign?.channel ?? 'email',
    status: campaign?.status ?? 'draft',
    builtDate: campaign?.builtDate ?? today,
    scheduledDate: campaign?.scheduledDate ?? '',
    validFrom: campaign?.validFrom ?? '',
    validUntil: campaign?.validUntil ?? '',
    figmaUrl: campaign?.figmaUrl ?? '',
    asanaUrl: campaign?.asanaUrl ?? '',
    klaviyoCampaignId: campaign?.klaviyoCampaignId ?? '',
    smsBody: currentSms,
  });
  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  const [current, setCurrent] = useState<EditorAsset[]>(campaign?.assets.filter((a) => a.version === campaign.currentVersion && a.kind !== 'sms') ?? []);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isSms = f.channel === 'sms';
  const needsDate = HOLDS_A_DAY.includes(f.status as Status);
  // an approval covers one version, so say so before ECD uploads over it
  const willReopen = !isNew && VOIDED_BY_NEW_VERSION.includes(campaign.status as Status) && (pending.length > 0 || (isSms && f.smsBody.trim() !== currentSms.trim()));

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
      if (!isSms) for (const file of pending) form.append('files', file, file.name);
      const r = await api<{ id: string }>('/api/admin/campaigns', { form });
      setBusy(false);
      if (!r.ok) return setMsg({ kind: 'err', text: r.error });
      window.location.href = `${base}/campaigns/${r.data.id}/edit?saved=1`;
      return;
    }
    const r = await api<{ reopened: boolean }>(`/api/admin/campaigns/${campaign.id}`, { method: 'PATCH', body: f });
    if (!r.ok) {
      setBusy(false);
      return setMsg({ kind: 'err', text: r.error });
    }
    const before = campaign.assets.filter((a) => a.version === campaign.currentVersion && a.kind !== 'sms');
    const orderChanged = current.map((a) => a.id).join() !== before.map((a) => a.id).join();
    if (orderChanged && current.length) {
      const o = await api(`/api/admin/campaigns/${campaign.id}/assets`, { method: 'PATCH', body: { order: current.map((a) => a.id) } });
      if (!o.ok) {
        setBusy(false);
        return setMsg({ kind: 'err', text: o.error });
      }
    }
    if (!isSms && pending.length) {
      const form = new FormData();
      for (const file of pending) form.append('files', file, file.name);
      const u = await api<{ version: number }>(`/api/admin/campaigns/${campaign.id}/assets`, { form });
      if (!u.ok) {
        setBusy(false);
        return setMsg({ kind: 'err', text: u.error });
      }
    }
    if (pending.length || r.data.reopened || (isSms && f.smsBody.trim() !== currentSms.trim())) {
      window.location.href = `${base}/campaigns/${campaign.id}/edit?saved=1`;
      return;
    }
    setBusy(false);
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function pullFigma() {
    if (!campaign) return;
    setBusy(true);
    setMsg(null);
    const r = await api<{ version: number; unchanged: boolean; message: string }>(`/api/admin/campaigns/${campaign.id}/figma-import`, { body: { url: f.figmaUrl } });
    if (!r.ok) {
      setBusy(false);
      return setMsg({ kind: 'err', text: r.error });
    }
    if (r.data.unchanged) {
      setBusy(false);
      return setMsg({ kind: 'ok', text: r.data.message });
    }
    window.location.href = `${base}/campaigns/${campaign.id}/edit?saved=1`;
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
      {campaign?.approval && <div className="ok" data-testid="approval-record">{campaign.approval}</div>}
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
          <b>Channel</b>
          <select value={f.channel} onChange={(e) => set('channel', e.target.value)} data-testid="channel">
            {CHANNEL_KEYS.map((c) => (
              <option key={c} value={c}>
                {CHANNELS[c]}
              </option>
            ))}
          </select>
        </label>
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
      </div>
      <div className="row2">
        <label>
          <b>Built</b>
          <input type="date" value={f.builtDate} onChange={(e) => set('builtDate', e.target.value)} />
        </label>
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
      </div>
      {needsDate && (
        <label>
          <b>{f.status === 'requested' ? 'Requested date' : 'Send date'}</b>
          <input type="date" value={f.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
        </label>
      )}
      <div className="row2">
        <label>
          <b>Offer starts, optional</b>
          <input type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} data-testid="valid-from" />
        </label>
        <label>
          <b>Offer ends, optional</b>
          <input type="date" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} data-testid="valid-until" />
        </label>
      </div>
      <span className="small" style={{ marginTop: -8 }}>
        A promo cannot be booked outside its offer window, so an approved promo never goes out after its code expires. Leave empty for evergreen work.
      </span>

      <div className="panel">
        <div className="k">Where this campaign lives elsewhere</div>
        <label>
          <b>Asana task{campaign?.asanaStage ? `, Stage: ${campaign.asanaStage}` : ''}</b>
          <input type="text" value={f.asanaUrl} onChange={(e) => set('asanaUrl', e.target.value)} placeholder="https://app.asana.com/0/PROJECT/TASK" />
          <span className="small">When set, client decisions and notes go onto this task as comments, and notes on the design become its subtasks.</span>
        </label>
        {!isSms && (
          <label>
            <b>Figma frame</b>
            <input type="text" value={f.figmaUrl} onChange={(e) => set('figmaUrl', e.target.value)} placeholder="https://www.figma.com/design/FILEKEY/Name?node-id=12-34" />
            <span className="small">
              Select the frame in Figma and copy its link so it includes node-id. {isNew ? 'Save first, then pull the frame.' : figmaEnabled ? 'A changed frame is picked up on its own; you can also pull it now.' : 'Pulling frames needs FIGMA_ACCESS_TOKEN in the environment; the link is kept either way.'}
            </span>
            {!isNew && (
              <span>
                <button type="button" className="btn sm" disabled={busy || !f.figmaUrl || !figmaEnabled} onClick={pullFigma}>
                  Pull the latest from Figma
                </button>
              </span>
            )}
          </label>
        )}
        <label>
          <b>Klaviyo campaign id</b>
          <input type="text" value={f.klaviyoCampaignId} onChange={(e) => set('klaviyoCampaignId', e.target.value)} placeholder="01JABCDEF" />
          <span className="small">With the id, Scheduled and Sent follow what Klaviyo actually did, and results attach to this campaign.</span>
        </label>
      </div>

      {willReopen && (
        <div className="flag" data-testid="reopen-warning">
          {campaign?.approval ? 'The client approved the current version. ' : ''}Saving a new version sends this back to review, because an approval covers one version only.
        </div>
      )}

      {isSms ? (
        <label>
          <b>{isNew || !currentSms ? 'SMS copy' : `SMS copy, version ${campaign?.currentVersion}. Editing it creates the next version`}</b>
          <textarea value={f.smsBody} onChange={(e) => set('smsBody', e.target.value)} rows={5} placeholder="Blessed Botanicals: 20% off Sea Moss ends tonight. Shop now: https://..." data-testid="sms-body" />
          <span className="small">
            {f.smsBody.length} characters, {Math.max(1, Math.ceil(f.smsBody.length / 160))} message{f.smsBody.length > 160 ? 's' : ''}. SMS has no design, so the client reviews the copy itself.
          </span>
        </label>
      ) : (
        <>
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
        </>
      )}

      <div className="actions-r">
        <button className="btn primary" type="button" disabled={busy} onClick={save} data-testid="save-campaign">
          {busy ? 'Saving' : isNew ? 'Create campaign' : pending.length ? 'Save and upload' : 'Save'}
        </button>
        <a className="btn" href={base}>
          Back to the bank
        </a>
        {!isNew && canDelete && (
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
                        {a.kind === 'sms' ? (
                          <span className="muted">{(a.text ?? '').slice(0, 80)}</span>
                        ) : (
                          <a className="link" href={a.url} target="_blank" rel="noreferrer">
                            {a.name || `File ${i + 1}`}
                          </a>
                        )}
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

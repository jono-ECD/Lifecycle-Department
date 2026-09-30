'use client';

// Import from Figma: load a file, tick the frames that are ready, name them, import as campaigns.
import { useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { TYPES, TYPE_KEYS } from '@/lib/status';

interface Frame {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  importedAs: string | null;
}
interface Page {
  id: string;
  name: string;
  frames: Frame[];
}
interface Loaded {
  fileKey: string;
  fileName: string;
  pages: Page[];
}
interface Group {
  key: string;
  name: string;
  type: string;
  frameIds: string[];
}

/** "October Promo, EM2" and "October Promo - Email 1" both read as "October Promo". */
function baseName(name: string): string {
  return name
    .replace(/[\s,\-–—_/|:]*\b(em|email|e)\s*#?\d+\b.*$/i, '')
    .replace(/[\s,\-–—_/|:]+$/, '')
    .trim();
}

export function FigmaImport({ workspaceId, base, enabled, defaultFile, sample }: { workspaceId: string; base: string; enabled: boolean; defaultFile: string; sample: boolean }) {
  const [file, setFile] = useState(defaultFile);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [combine, setCombine] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'draft' | 'review'>('draft');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const frames = useMemo(() => new Map((loaded?.pages ?? []).flatMap((p) => p.frames).map((f) => [f.id, f])), [loaded]);

  // Frames that share a base name become one campaign with EM1, EM2 and so on, unless combining is off.
  const groups: Group[] = useMemo(() => {
    const out: Group[] = [];
    for (const id of picked) {
      const f = frames.get(id);
      if (!f) continue;
      const b = baseName(f.name) || f.name;
      const hasNumber = b !== f.name;
      const existing = combine && hasNumber ? out.find((g) => g.key === `g:${b.toLowerCase()}`) : undefined;
      if (existing) existing.frameIds.push(id);
      else out.push({ key: combine && hasNumber ? `g:${b.toLowerCase()}` : `f:${id}`, name: combine && hasNumber ? b : f.name, type: 'promo', frameIds: [id] });
    }
    return out.map((g) => ({ ...g, name: names[g.key] ?? g.name, type: types[g.key] ?? g.type }));
  }, [picked, frames, combine, names, types]);

  async function load() {
    setBusy(true);
    setMsg(null);
    const r = await api<Loaded>('/api/admin/figma/frames', { body: { workspaceId, file } });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setLoaded(r.data);
    setPicked([]);
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function run() {
    if (!loaded || groups.length === 0) return;
    setBusy(true);
    setMsg(null);
    const r = await api<{ created: { id: string; name: string }[] }>('/api/admin/figma/import', {
      body: { workspaceId, fileKey: loaded.fileKey, status, items: groups.map((g) => ({ name: g.name, type: g.type, nodeIds: g.frameIds })) },
    });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    window.location.href = `${base}?imported=${r.data.created.length}`;
  }

  if (!enabled) {
    return (
      <div className="panel">
        <div className="k">Not connected yet</div>
        <h3>Add the Figma token to turn this on</h3>
        <p className="small" style={{ margin: 0 }}>
          In Figma open Settings, Security, Personal access tokens, and create one with file read access. Put it in the environment as <code>FIGMA_ACCESS_TOKEN</code> and restart the app. One token covers every client file that account can open.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sample && <div className="sample">Sample mode is on, so this shows stand in frames instead of a real Figma file. Any link works.</div>}
      {msg && <div className={msg.kind}>{msg.text}</div>}
      <div className="panel">
        <div className="k">Step 1</div>
        <h3>Which Figma file</h3>
        <div className="inline">
          <input type="text" value={file} onChange={(e) => setFile(e.target.value)} placeholder="https://www.figma.com/design/FILEKEY/Client-emails" data-testid="figma-file" />
          <button className="btn primary" type="button" disabled={busy || !file.trim()} onClick={load} data-testid="figma-load">
            {busy && !loaded ? 'Loading' : 'Show frames'}
          </button>
        </div>
      </div>

      {loaded && (
        <div className="panel">
          <div className="k">Step 2</div>
          <h3>Tick the frames that are ready</h3>
          <p className="small" style={{ margin: 0 }}>
            {loaded.fileName}. The order you tick them in is the order they show in the campaign.
          </p>
          {loaded.pages.map((p) => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="small">
                <b>{p.name}</b>
              </div>
              <div className="fpick">
                {p.frames.map((f) => {
                  const idx = picked.indexOf(f.id);
                  return (
                    <button key={f.id} type="button" className={'fframe' + (idx >= 0 ? ' on' : '')} onClick={() => toggle(f.id)} data-testid="figma-frame" aria-pressed={idx >= 0}>
                      <span className="tick">{idx >= 0 ? idx + 1 : ''}</span>
                      {f.importedAs && <span className="was" title={`Already in the bank as ${f.importedAs}`}>In the bank</span>}
                      <div className="im">{f.thumbUrl ? <img src={f.thumbUrl} alt="" loading="lazy" /> : null}</div>
                      <div className="nm">
                        {f.name}
                        <span>{f.width && f.height ? `${f.width} by ${f.height}` : ''}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {loaded.pages.length === 0 && <div className="small">No frames found in this file.</div>}
        </div>
      )}

      {loaded && picked.length > 0 && (
        <div className="panel">
          <div className="k">Step 3</div>
          <h3>
            {groups.length} campaign{groups.length === 1 ? '' : 's'} to create
          </h3>
          <label className="inline small" style={{ gap: 8 }}>
            <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} style={{ width: 'auto', flex: 'none' }} />
            Combine frames named EM1, EM2 and so on into one campaign
          </label>
          {groups.map((g) => (
            <div className="fgroup" key={g.key} data-testid="figma-group">
              <input type="text" value={g.name} onChange={(e) => setNames((n) => ({ ...n, [g.key]: e.target.value }))} aria-label="Campaign name" />
              <select value={g.type} onChange={(e) => setTypes((t) => ({ ...t, [g.key]: e.target.value }))} aria-label="Type">
                {TYPE_KEYS.map((t) => (
                  <option key={t} value={t}>
                    {TYPES[t]}
                  </option>
                ))}
              </select>
              <span className="small">
                {g.frameIds.length} email{g.frameIds.length === 1 ? '' : 's'}
              </span>
              <div className="frames">{g.frameIds.map((id, i) => `EM${i + 1}: ${frames.get(id)?.name ?? id}`).join('  ·  ')}</div>
            </div>
          ))}
          <div className="inline" style={{ marginTop: 6 }}>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'review')} aria-label="Status after import" style={{ font: 'inherit', fontSize: 13.5, border: '1px solid var(--line-2)', borderRadius: 10, padding: '8px 10px', background: 'var(--card)' }}>
              <option value="draft">Import as drafts</option>
              <option value="review">Import and send to review</option>
            </select>
            <button className="btn primary" type="button" disabled={busy} onClick={run} data-testid="figma-import">
              {busy ? 'Importing' : `Import ${groups.length} campaign${groups.length === 1 ? '' : 's'}`}
            </button>
            <span className="small">{status === 'review' ? 'The reviewer gets one email for the batch.' : 'Drafts stay with ECD until you move them to review.'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

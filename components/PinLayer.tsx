'use client';

// The design image with pinned notes on top, like Figma comments. Tap to pin, drag to mark an area.
import { useEffect, useRef, useState } from 'react';
import type { BankAsset, BankPin } from '@/lib/bank';

export interface Draft {
  assetId: string;
  x: number;
  y: number;
  w: number | null;
  h: number | null;
}

interface Props {
  asset: BankAsset;
  pins: BankPin[];
  isAdmin: boolean;
  placing: boolean;
  activeId: string | null;
  draft: Draft | null;
  showDone: boolean;
  busy: boolean;
  onPlace: (d: Draft) => void;
  onSelect: (id: string | null) => void;
  onCancelDraft: () => void;
  onSubmitDraft: (body: string) => void;
  onReply: (id: string, body: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
}

const DRAG_PX = 8;

export function PinLayer(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [band, setBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; id: number } | null>(null);

  const frac = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };

  function down(e: React.PointerEvent) {
    if (!p.placing || p.draft) return;
    if ((e.target as HTMLElement).closest('.pin, .pinpop')) return;
    e.preventDefault();
    const f = frac(e);
    start.current = { px: e.clientX, py: e.clientY, x: f.x, y: f.y, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    if (Math.hypot(e.clientX - s.px, e.clientY - s.py) < DRAG_PX && !band) return;
    const f = frac(e);
    setBand({ x: Math.min(s.x, f.x), y: Math.min(s.y, f.y), w: Math.abs(f.x - s.x), h: Math.abs(f.y - s.y) });
  }
  function up(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    start.current = null;
    const f = frac(e);
    const b = band;
    setBand(null);
    if (b && b.w > 0.02 && b.h > 0.02) p.onPlace({ assetId: p.asset.id, x: b.x, y: b.y, w: b.w, h: b.h });
    else p.onPlace({ assetId: p.asset.id, x: f.x, y: f.y, w: null, h: null });
  }

  const visible = p.pins.filter((pin) => p.showDone || pin.status === 'open' || pin.id === p.activeId);
  const active = p.pins.find((pin) => pin.id === p.activeId) ?? null;
  const draftHere = p.draft && p.draft.assetId === p.asset.id ? p.draft : null;

  return (
    <div ref={ref} className={'pinlayer' + (p.placing ? ' placing' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => ((start.current = null), setBand(null))}>
      <img src={p.asset.url} alt="" width={p.asset.width ?? undefined} height={p.asset.height ?? undefined} draggable={false} />
      {visible.map((pin) => (
        <PinMarker key={pin.id} pin={pin} active={pin.id === p.activeId} dim={!!p.activeId && pin.id !== p.activeId} onClick={() => p.onSelect(pin.id === p.activeId ? null : pin.id)} />
      ))}
      {band && <div className="band" style={{ left: `${band.x * 100}%`, top: `${band.y * 100}%`, width: `${band.w * 100}%`, height: `${band.h * 100}%` }} />}
      {draftHere && (
        <>
          {draftHere.w && draftHere.h && <div className="pinarea" style={{ left: `${draftHere.x * 100}%`, top: `${draftHere.y * 100}%`, width: `${draftHere.w * 100}%`, height: `${draftHere.h * 100}%` }} />}
          <div className="pin draft" style={{ left: `${draftHere.x * 100}%`, top: `${draftHere.y * 100}%` }} aria-hidden="true">
            <span>{p.pins.length + 1}</span>
          </div>
          <Popover x={draftHere.x} y={draftHere.y} area={draftHere.w != null}>
            <DraftForm onCancel={p.onCancelDraft} onSubmit={p.onSubmitDraft} busy={p.busy} />
          </Popover>
        </>
      )}
      {active && !draftHere && (
        <Popover x={active.x} y={active.y} area={active.w != null}>
          <Thread pin={active} isAdmin={p.isAdmin} busy={p.busy} onClose={() => p.onSelect(null)} onReply={(b) => p.onReply(active.id, b)} onResolve={(r) => p.onResolve(active.id, r)} onDelete={() => p.onDelete(active.id)} />
        </Popover>
      )}
    </div>
  );
}

function PinMarker({ pin, active, dim, onClick }: { pin: BankPin; active: boolean; dim: boolean; onClick: () => void }) {
  const done = pin.status === 'resolved';
  return (
    <>
      {pin.w != null && pin.h != null && <div className={'pinarea' + (done ? ' done' : '') + (dim ? ' dim' : '')} style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, width: `${pin.w * 100}%`, height: `${pin.h * 100}%` }} />}
      <button
        type="button"
        className={'pin' + (active ? ' on' : '') + (done ? ' done' : '') + (dim ? ' dim' : '')}
        style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
        title={`Note ${pin.number}, ${pin.author}: ${pin.comments[0]?.body ?? ''}`}
        aria-label={`Note ${pin.number}`}
        data-pin={pin.number}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <span>{pin.number}</span>
      </button>
    </>
  );
}

function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

/** Sits next to the pin, flips to the left near the right edge. On phones the stylesheet pins it to the bottom instead. */
function Popover({ x, y, area, children }: { x: number; y: number; area: boolean; children: React.ReactNode }) {
  const mobile = useMobile();
  const right = x > 0.55;
  let style: React.CSSProperties = {};
  if (!mobile) {
    style = right ? { right: `${(1 - x) * 100}%`, marginRight: 18 } : { left: `${x * 100}%`, marginLeft: 18 };
    style.top = `${y * 100}%`;
    style.transform = area ? 'translateY(-6px)' : 'translateY(-50%)';
  }
  return (
    <div className="pinpop" style={style} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

function DraftForm({ onCancel, onSubmit, busy }: { onCancel: () => void; onSubmit: (body: string) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ta.current?.focus();
  }, []);
  const send = () => text.trim() && onSubmit(text.trim());
  return (
    <>
      <div className="pph">
        <b>New note</b>
        <button type="button" className="x" aria-label="Cancel" onClick={onCancel}>
          ×
        </button>
      </div>
      <textarea
        ref={ta}
        value={text}
        placeholder="What should change here?"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
          if (e.key === 'Escape') onCancel();
        }}
        data-testid="pin-draft"
      />
      <div className="row">
        <span className="small">Enter to post, Shift and Enter for a new line.</span>
        <span className="sp" />
        <button type="button" className="btn sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn sm primary" disabled={busy || !text.trim()} onClick={send} data-testid="pin-post">
          Post note
        </button>
      </div>
    </>
  );
}

function Thread({ pin, isAdmin, busy, onClose, onReply, onResolve, onDelete }: { pin: BankPin; isAdmin: boolean; busy: boolean; onClose: () => void; onReply: (b: string) => void; onResolve: (r: boolean) => void; onDelete: () => void }) {
  const [text, setText] = useState('');
  const done = pin.status === 'resolved';
  const canDelete = isAdmin || (pin.mine && pin.comments.length <= 1);
  const send = () => {
    if (!text.trim()) return;
    onReply(text.trim());
    setText('');
  };
  return (
    <>
      <div className="pph">
        <div>
          <b>Note {pin.number}</b> <span>{pin.position}</span> {done && <span className="done-tag">Done</span>}
        </div>
        <button type="button" className="x" aria-label="Close note" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="msgs">
        {pin.comments.map((m) => (
          <div key={m.id} className={'msg' + (m.you ? ' you' : '')}>
            <b>{m.who}</b>
            <span>{m.when}</span>
            <div>{m.body}</div>
          </div>
        ))}
      </div>
      {done && pin.resolvedBy && <div className="small">Marked done by {pin.resolvedBy}.</div>}
      <textarea
        value={text}
        placeholder="Reply"
        style={{ minHeight: 44 }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        data-testid="pin-reply"
      />
      <div className="row">
        {isAdmin && (
          <button type="button" className="btn sm" disabled={busy} onClick={() => onResolve(!done)} data-testid="pin-resolve">
            {done ? 'Reopen' : 'Mark done'}
          </button>
        )}
        {canDelete && (
          <button type="button" className="btn sm danger" disabled={busy} onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="sp" />
        <button type="button" className="btn sm primary" disabled={busy || !text.trim()} onClick={send}>
          Reply
        </button>
      </div>
    </>
  );
}

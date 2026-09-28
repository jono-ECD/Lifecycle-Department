'use client';

// The bank page and the campaign drawer. A port of the prototype's render functions; same markup, same classes.
// Pinned notes on the design live in PinLayer and the "Notes on the design" section of the drawer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BankCampaign, BankPayload, BankPin } from '@/lib/bank';
import { ORDER, STATUS, TYPES, type Status } from '@/lib/status';
import { actionsFor, COMMENTER_ONLY, NOTE_REQUIRED, type Action, type ActionDef } from '@/lib/transitions';
import { openSlots, windowDates } from '@/lib/slots';
import { fmtShort } from '@/lib/dates';
import { PinLayer, type Draft } from '@/components/PinLayer';
import { sameCampaign } from '@/lib/integrations/sheet';
import { money, num, pct } from '@/lib/format';

type Filter = 'all' | 'bank' | Status;
type View = 'gallery' | 'list';

const POLL_MS = 30_000;

function GalleryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="3" width="16" height="3" rx="1.5" />
      <rect x="2" y="8.5" width="16" height="3" rx="1.5" />
      <rect x="2" y="14" width="16" height="3" rx="1.5" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h18v12H3z" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5H4l2-3a8.5 8.5 0 1 1 15-5.5z" />
    </svg>
  );
}

export function EmptyWorkspace({ admin }: { admin: boolean }) {
  return (
    <div className="emptystate">
      <svg viewBox="0 0 160 110" fill="none" aria-hidden="true">
        <rect x="20" y="30" width="120" height="70" rx="10" stroke="var(--line-2)" strokeDasharray="4 4" />
        <rect x="34" y="44" width="52" height="42" rx="6" fill="var(--purple-soft)" stroke="var(--line)" />
        <rect x="94" y="44" width="32" height="8" rx="3" fill="var(--gray)" />
        <rect x="94" y="58" width="24" height="6" rx="3" fill="var(--gray)" />
        <rect x="94" y="70" width="28" height="6" rx="3" fill="var(--gray)" />
        <path d="M60 12c8-8 22-8 30 0" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="14" r="3" fill="var(--purple)" />
        <circle cx="90" cy="14" r="3" fill="var(--purple)" />
      </svg>
      <p>{admin ? 'No campaigns yet. Add the first one and it shows up here.' : 'Nothing here yet. Campaigns appear as soon as ECD uploads them.'}</p>
    </div>
  );
}

export function Bank({ initial, adminBase }: { initial: BankPayload; adminBase?: string }) {
  const [data, setData] = useState<BankPayload>(initial);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('gallery');
  const [openId, setOpenId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; on: boolean }>({ msg: '', on: false });
  const [placing, setPlacing] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [wantPin, setWantPin] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [previewWidth, setPreviewWidth] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  const role = data.role;
  const isAdmin = role === 'admin';
  const ws = data.workspace;

  const showToast = useCallback((msg: string) => {
    setToast({ msg, on: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, on: false })), 2200);
  }, []);

  // Polling every 30 seconds keeps the page fresh without real time plumbing.
  useEffect(() => {
    const id = setInterval(async () => {
      if (busyRef.current || document.hidden || draft) return;
      try {
        const r = await fetch(`/api/bank?workspace=${encodeURIComponent(ws.id)}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {
        /* offline, try again on the next tick */
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [ws.id, draft]);

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const i of data.campaigns) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [data.campaigns]);

  const open = openId ? data.campaigns.find((c) => c.id === openId) ?? null : null;

  const closeDrawer = useCallback(() => {
    setOpenId(null);
    setPicker(null);
    setPlacing(false);
    setActivePin(null);
    setDraft(null);
  }, []);

  const openItem = useCallback((id: string) => {
    setOpenId(id);
    setPicker(null);
    setNote('');
    setPlacing(false);
    setActivePin(null);
    setDraft(null);
    setZoom('fit');
  }, []);

  // Width available for the design inside the preview, so "Fit" and "100%" can be computed.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const measure = () => setPreviewWidth(el.clientWidth - 44);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Deep links: ?c=<campaign>&pin=<number> open the drawer and focus a note (used by emails, Slack and Asana).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get('c');
    if (c && initial.campaigns.some((x) => x.id === c)) {
      openItem(c);
      const n = Number(sp.get('pin'));
      if (n) setWantPin(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open || wantPin === null) return;
    const pin = open.pins.find((p) => p.number === wantPin);
    setWantPin(null);
    if (pin) focusPin(pin);
  }, [open, wantPin]);

  function focusPin(pin: BankPin) {
    if (pin.status === 'resolved') setShowDone(true);
    setActivePin(pin.id);
    setDraft(null);
    setTimeout(() => document.querySelector<HTMLElement>(`.pin[data-pin="${pin.number}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }

  // ---- list ----
  const rows = useMemo(() => {
    const r = data.campaigns.filter((i) => (filter === 'all' ? true : filter === 'bank' ? i.status === 'approved' || i.status === 'hold' : i.status === filter));
    return [...r].sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status));
  }, [data.campaigns, filter]);

  // Keyboard: Escape backs out one step (draft, note, pin mode, drawer). Arrows move between campaigns.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!openId) return;
      if (e.key === 'Escape') {
        if (draft) setDraft(null);
        else if (activePin) setActivePin(null);
        else if (placing) setPlacing(false);
        else closeDrawer();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
      if (!forward && !back) return;
      const idx = rows.findIndex((r) => r.id === openId);
      if (idx < 0) return;
      const next = forward ? idx + 1 : idx - 1;
      if (next < 0 || next >= rows.length) return;
      e.preventDefault();
      openItem(rows[next].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openId, rows, closeDrawer, openItem, draft, activePin, placing]);

  useEffect(() => {
    document.body.style.overflow = openId ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openId]);

  async function post(url: string, body: unknown, method = 'POST'): Promise<{ ok: boolean; threadId?: string }> {
    setBusy(true);
    busyRef.current = true;
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; toast?: string; bank?: BankPayload; threadId?: string };
      if (!r.ok) {
        showToast(j.error || 'Something went wrong. Try again.');
        return { ok: false };
      }
      if (j.bank) setData(j.bank);
      if (j.toast) showToast(j.toast);
      return { ok: true, threadId: j.threadId };
    } catch {
      showToast('No connection. Try again.');
      return { ok: false };
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  function act(item: BankCampaign, def: ActionDef) {
    if (def.needsDate) {
      setPicker((p) => (p === def.action ? null : def.action));
      return;
    }
    if (def.needsNote && !note.trim()) {
      showToast(NOTE_REQUIRED);
      noteRef.current?.focus();
      return;
    }
    void post(`/api/campaigns/${item.id}/transition`, { action: def.action, note: note.trim() || undefined }).then((r) => {
      if (r.ok) {
        setNote('');
        setPicker(null);
      }
    });
  }

  function pickSlot(item: BankCampaign, date: string) {
    if (!picker) return;
    void post(`/api/campaigns/${item.id}/transition`, { action: picker, date, note: note.trim() || undefined }).then((r) => {
      if (r.ok) {
        setNote('');
        setPicker(null);
      }
    });
  }

  function sendNote(item: BankCampaign) {
    if (!note.trim()) return;
    void post(`/api/campaigns/${item.id}/comments`, { body: note.trim() }).then((r) => r.ok && setNote(''));
  }

  // ---- pinned notes ----
  function submitDraft(item: BankCampaign, body: string) {
    if (!draft) return;
    void post(`/api/campaigns/${item.id}/pins`, { assetId: draft.assetId, x: draft.x, y: draft.y, w: draft.w, h: draft.h, body }).then((r) => {
      if (r.ok) {
        setDraft(null);
        setPlacing(false);
        if (r.threadId) setActivePin(r.threadId);
      }
    });
  }
  function replyPin(id: string, body: string) {
    void post(`/api/pins/${id}`, { op: 'reply', body });
  }
  function resolvePin(id: string, resolved: boolean) {
    void post(`/api/pins/${id}`, { op: 'resolve', resolved });
  }
  function deletePin(id: string) {
    if (!window.confirm('Remove this note?')) return;
    void post(`/api/pins/${id}`, undefined, 'DELETE').then((r) => r.ok && setActivePin(null));
  }

  // ---- headline ----
  const n = counts.review ?? 0;
  const a = counts.approved ?? 0;
  const h = counts.hold ?? 0;

  // ---- window ----
  const held = (d: (typeof data.days)[number]) => d.scheduled.length + d.requested.length + d.planned.length;
  const filled = data.days.filter((d) => d.scheduled.length > 0).length;
  const requestedDays = data.days.filter((d) => d.requested.length > 0).length;
  const plannedDays = data.days.filter((d) => d.planned.length > 0).length;
  const openDays = data.days.filter((d) => !d.blocked && !d.closed && held(d) < d.capacity).length;
  const windowLabel = ws.windowDays === 14 ? 'Next two weeks' : `Next ${ws.windowDays} days`;

  // ---- slots for the open item ----
  const slotInput = useMemo(() => {
    const cnt: Record<string, number> = {};
    // a line in the content calendar for this same campaign must not block its own slot
    const openName = data.campaigns.find((c) => c.id === openId)?.name ?? '';
    const openItemNow = data.campaigns.find((c) => c.id === openId);
    for (const d of data.days) cnt[d.ymd] = [...d.scheduled, ...d.requested].filter((x) => x.id !== openId).length + d.planned.filter((p) => !sameCampaign(openName, p.label)).length;
    const listed = ws.slotMode === 'listed' ? Object.fromEntries(data.days.filter((d) => !d.closed).map((d) => [d.ymd, d.capacity])) : null;
    return { today: data.today, windowDays: ws.windowDays, maxPerDay: ws.maxPerDay, counts: cnt, blocked: data.days.filter((d) => d.blocked).map((d) => d.ymd), role, listed, offer: openItemNow?.offer ?? null };
  }, [data.days, data.campaigns, data.today, ws.windowDays, ws.maxPerDay, ws.slotMode, role, openId]);
  const openSet = useMemo(() => new Set(openSlots(slotInput)), [slotInput]);
  const slotDays = useMemo(() => windowDates(data.today, ws.windowDays).filter((d) => isAdmin || d !== data.today), [data.today, ws.windowDays, isAdmin]);

  const editHref = (id: string) => (adminBase ? `${adminBase}/campaigns/${id}/edit` : '#');
  const cardOf = (i: BankCampaign) => i.assets[0] ?? null;

  const actions = open ? actionsFor(open.status, role, data.canDecide) : [];
  const currentPins = open ? open.pins.filter((p) => p.version === open.version) : [];
  const earlierPins = open ? open.pins.filter((p) => p.version !== open.version) : [];
  const openCount = currentPins.filter((p) => p.status === 'open').length;
  const doneCount = currentPins.length - openCount;
  const hasImages = !!open && open.assets.some((as) => as.kind === 'image');
  const offerLine = (o: NonNullable<BankCampaign['offer']>) => (o.from && o.until ? `${fmtShort(o.from)} to ${fmtShort(o.until)}` : o.until ? `until ${fmtShort(o.until)}` : `from ${fmtShort(o.from!)}`);

  // An email is shown at its real width. Exports wider than 900px are treated as 2x and halved.
  const firstImage = open?.assets.find((as) => as.kind === 'image');
  const emailWidth = firstImage?.width ? (firstImage.width > 900 ? Math.round(firstImage.width / 2) : firstImage.width) : 600;
  const fitZoom = previewWidth > 0 ? Math.min(1, previewWidth / emailWidth) : 1;
  const zoomValue = zoom === 'fit' ? fitZoom : zoom;
  const stackWidth = Math.round(emailWidth * zoomValue);
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const zoomStep = (dir: 1 | -1) => {
    const cur = zoomValue;
    const next = dir > 0 ? ZOOMS.find((z) => z > cur + 0.001) : [...ZOOMS].reverse().find((z) => z < cur - 0.001);
    if (next) setZoom(next);
  };

  return (
    <>
      <div className="app">
        <div className="top">
          <a className="brand" href={isAdmin ? adminBase ?? '/admin' : '/bank'}>
            {ws.logoUrl ? (
              <img className="mark" src={ws.logoUrl} alt="" />
            ) : (
              <span className="mark" style={{ width: 40, borderRadius: 10, background: 'var(--purple-soft)', color: 'var(--purple-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Newsreader, Georgia, serif', fontSize: 20 }}>
                {ws.name[0]}
              </span>
            )}
            <div className="bt">
              <h1>Campaign Bank</h1>
              <span>{ws.name}</span>
            </div>
          </a>
          <div className="who">
            {isAdmin ? (
              <>
                ECD admin <b>{data.viewerName}</b> · {data.todayLong}
              </>
            ) : (
              <>
                Reviewing as <b>{ws.name}</b> · {data.todayLong}
              </>
            )}
          </div>
        </div>

        <div className="head">
          <div>
            <h2 id="headline">
              {n ? (
                <>
                  <em>
                    {n} campaign{n > 1 ? 's' : ''}
                  </em>{' '}
                  ready for your review. {a} approved in the bank, {h} on hold.
                </>
              ) : (
                <>
                  Nothing to review right now. {a} approved in the bank, {h} on hold.
                </>
              )}
            </h2>
            <p>Every campaign ECD prepares lives here until it sends. Approve it, ask for a change, or park it for later. Approved work waits in the bank and drops into any open slot when the timing fits. Nothing is ever lost.</p>
          </div>
          <div className="window">
            <div className="k">
              {windowLabel}{' '}
              <span id="winsum">
                {filled} scheduled, {requestedDays > 0 ? `${requestedDays} requested, ` : ''}
                {plannedDays > 0 ? `${plannedDays} planned, ` : ''}
                {openDays} open
              </span>
            </div>
            <div className="days" id="days" style={ws.windowDays !== 14 ? { gridTemplateColumns: `repeat(${Math.min(ws.windowDays, 14)},1fr)` } : undefined}>
              {data.days.map((d) => {
                const has = d.scheduled.length > 0;
                const asked = d.requested.length > 0;
                const planned = d.planned.length > 0;
                const plannedNames = d.planned.map((x) => x.label).join(', ');
                const cls = 'day' + (d.today ? ' today' : '') + (has ? ' has pick' : asked ? ' asked pick' : planned ? ' planned pick' : '') + (d.blocked ? ' blocked' : '') + (d.closed && !d.blocked ? ' closed' : '');
                const title =
                  [has ? `Scheduled: ${d.scheduled.map((x) => x.name).join(', ')}` : '', asked ? `Date requested: ${d.requested.map((x) => x.name).join(', ')}` : '', planned ? `Planned by ECD: ${plannedNames}` : '', d.blocked ? `Blocked: ${d.blocked}` : '', d.closed && !d.blocked ? 'Not a send day' : '']
                    .filter(Boolean)
                    .join('. ') || undefined;
                const click = has ? () => openItem(d.scheduled[0].id) : asked ? () => openItem(d.requested[0].id) : planned ? () => showToast(`${fmtShort(d.ymd)} is planned: ${plannedNames}`) : undefined;
                const chip = (n: number, kind: string) => <span className={'chip' + kind + (n > 1 ? ' two' : '')}>{n > 1 ? `${n} EM` : 'EM'}</span>;
                return (
                  <button key={d.ymd} type="button" className={cls} title={title} onClick={click} tabIndex={has || asked || planned ? 0 : -1} aria-label={`${fmtShort(d.ymd)}${title ? `, ${title}` : ''}`} data-planned={planned ? d.planned.length : undefined}>
                    <b>{d.day}</b>
                    <span>{d.wd}</span>
                    {has && chip(d.scheduled.length, '')}
                    {asked && chip(d.requested.length, ' ask')}
                    {planned && chip(d.planned.length, ' plan')}
                  </button>
                );
              })}
            </div>
            <div className="foot">
              Any open day can take an approved campaign. Pick the slot, we handle the rest.
              {data.days.some((d) => d.planned.length + d.requested.length > 0) && (
                <span className="legend">
                  <i className="chip" /> scheduled
                  {requestedDays > 0 && (
                    <>
                      {' '}
                      <i className="chip ask" /> date requested
                    </>
                  )}
                  {plannedDays > 0 && (
                    <>
                      {' '}
                      <i className="chip plan" /> planned by ECD
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="filters" id="filters">
          <div className="vt">
            <button type="button" className={view === 'gallery' ? 'on' : ''} aria-label="Gallery view" onClick={() => setView('gallery')}>
              <GalleryIcon />
            </button>
            <button type="button" className={view === 'list' ? 'on' : ''} aria-label="List view" onClick={() => setView('list')}>
              <ListIcon />
            </button>
          </div>
          <button type="button" className={'f' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>
            All <span className="n">{data.campaigns.length}</span>
          </button>
          <button type="button" className={'f bank' + (filter === 'bank' ? ' on' : '')} onClick={() => setFilter('bank')}>
            Bank <span className="n">{a + h}</span>
          </button>
          {ORDER.filter((s) => s !== 'draft' || ws.showsDrafts).map((s) => (
            <button key={s} type="button" className={'f ' + s + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>
              {STATUS[s]} <span className="n">{counts[s] ?? 0}</span>
            </button>
          ))}
          <a className="hist" href={isAdmin ? `${adminBase ?? '/admin'}/history` : '/bank/history'}>
            Sent history
          </a>
        </div>

        {data.campaigns.length === 0 ? (
          <EmptyWorkspace admin={isAdmin} />
        ) : rows.length === 0 ? (
          <div className="list" id="list">
            <div className="empty">Nothing here right now.</div>
          </div>
        ) : view === 'gallery' ? (
          <div className="gal" id="list">
            {rows.map((i) => {
              const first = cardOf(i);
              return (
                <div
                  key={i.id}
                  className={'gcard' + (i.late ? ' late' : '')}
                  role="button"
                  tabIndex={0}
                  aria-label={i.name}
                  onClick={() => openItem(i.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openItem(i.id);
                    }
                  }}
                >
                  {first?.thumbUrl ? (
                    <img src={first.thumbUrl} alt="" loading="lazy" />
                  ) : first?.kind === 'pdf' ? (
                    <div className="gph pdfph">
                      <PdfIcon />
                      <span>PDF</span>
                    </div>
                  ) : first?.kind === 'sms' ? (
                    <div className="smscard">
                      <span className="tag">SMS</span>
                      <div className="bubble">{first.text}</div>
                    </div>
                  ) : (
                    <div className="gph">
                      <MailIcon />
                    </div>
                  )}
                  <span className={'pill ' + i.status}>{STATUS[i.status]}</span>
                  {i.openNotes > 0 && (
                    <span className="notesbadge" title={`${i.openNotes} open note${i.openNotes > 1 ? 's' : ''} on the design`}>
                      <i />
                      {i.openNotes} note{i.openNotes > 1 ? 's' : ''}
                    </span>
                  )}
                  {adminBase && (
                    <a className="edit" href={editHref(i.id)} aria-label="Edit" onClick={(e) => e.stopPropagation()}>
                      <PencilIcon />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="list" id="list">
            {rows.map((i) => {
              const first = cardOf(i);
              const when =
                i.status === 'review' ? (
                  <>
                    <b>Ready for review</b>since {i.since}
                  </>
                ) : i.status === 'sent' ? (
                  <>Sent {i.since}</>
                ) : i.late ? (
                  <>
                    <b>Date passed</b>was {fmtShort(i.scheduled!)}
                  </>
                ) : i.status === 'scheduled' && i.scheduled ? (
                  <>Sends {fmtShort(i.scheduled)}</>
                ) : (
                  <>Built {i.built}</>
                );
              return (
                <button key={i.id} type="button" className="row" onClick={() => openItem(i.id)}>
                  {first?.thumbUrl ? (
                    <div className="th">
                      <img src={first.thumbUrl} alt="" />
                    </div>
                  ) : (
                    <div className="th none">{first?.kind === 'pdf' ? 'PDF' : first?.kind === 'sms' ? 'SMS' : i.name[0]}</div>
                  )}
                  <div className="t">
                    <b>{i.name}</b>
                    <span>
                      {i.sub}
                      {i.openNotes > 0 && (
                        <span className="notesbadge">
                          {i.openNotes} note{i.openNotes > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="type">
                    <i className={i.type} />
                    {TYPES[i.type]}
                  </div>
                  <span className={'pill ' + i.status}>{STATUS[i.status]}</span>
                  <div className="when">{when}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={'scrim' + (open ? ' on' : '')} id="scrim" onClick={closeDrawer} />
      <aside className={'drawer' + (open ? ' on' : '')} id="drawer" aria-hidden={!open}>
        <div className="preview" id="preview" ref={previewRef} onClick={() => activePin && !draft && setActivePin(null)}>
          {open && open.assets.length > 0 ? (
            <div className="stack" style={{ width: stackWidth }} data-testid="design-stack">
              {hasImages && (
                <div className="ptools" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={'pinbtn' + (placing ? ' on' : '')}
                    data-testid="pin-mode"
                    onClick={() => {
                      setPlacing((v) => !v);
                      setDraft(null);
                      setActivePin(null);
                    }}
                  >
                    <PinIcon />
                    {placing ? 'Done placing' : 'Leave a note on the design'}
                    {!placing && openCount > 0 && <span className="n">{openCount}</span>}
                  </button>
                  {placing && !draft && <span className="hint">Tap the design where the note goes. Drag to mark an area.</span>}
                  {!placing && (
                    <span className="zoom" aria-label="Zoom">
                      <button type="button" aria-label="Zoom out" onClick={() => zoomStep(-1)} disabled={zoomValue <= 0.5}>
                        −
                      </button>
                      <span className="pct" data-testid="zoom-pct">
                        {Math.round(zoomValue * 100)}%
                      </span>
                      <button type="button" aria-label="Zoom in" onClick={() => zoomStep(1)} disabled={zoomValue >= 2}>
                        +
                      </button>
                      <button type="button" className={'fit' + (zoom === 'fit' ? ' on' : '')} onClick={() => setZoom(zoom === 'fit' ? 1 : 'fit')} title="Fit the width, or show at the real email width">
                        {zoom === 'fit' ? 'Fit' : '100%'}
                      </button>
                    </span>
                  )}
                </div>
              )}
              {open.assets.map((as) =>
                as.kind === 'image' ? (
                  <PinLayer
                    key={as.id}
                    asset={as}
                    pins={currentPins.filter((p) => p.assetId === as.id)}
                    isAdmin={isAdmin}
                    placing={placing}
                    activeId={activePin}
                    draft={draft}
                    showDone={showDone}
                    busy={busy}
                    onPlace={(d) => {
                      setDraft(d);
                      setActivePin(null);
                    }}
                    onSelect={(id) => {
                      setActivePin(id);
                      setDraft(null);
                    }}
                    onCancelDraft={() => setDraft(null)}
                    onSubmitDraft={(body) => submitDraft(open, body)}
                    onReply={replyPin}
                    onResolve={resolvePin}
                    onDelete={deletePin}
                  />
                ) : as.kind === 'sms' ? (
                  <div key={as.id} className="phone" data-testid="sms-preview">
                    <div className="from">{ws.name}</div>
                    <div className="bubble">{as.text}</div>
                    <div className="count">
                      {(as.text ?? '').length} characters, {Math.max(1, Math.ceil((as.text ?? '').length / 160))} message{(as.text ?? '').length > 160 ? 's' : ''}
                    </div>
                  </div>
                ) : (
                  <a key={as.id} className="pdfcard" href={as.url} target="_blank" rel="noreferrer">
                    {as.thumbUrl ? <img src={as.thumbUrl} alt="" style={{ boxShadow: 'none', borderRadius: 8 }} /> : <PdfIcon />}
                    <span>Open the PDF</span>
                  </a>
                ),
              )}
              {hasImages && !placing && (
                <div className="small" style={{ textAlign: 'center', paddingBottom: 8 }}>
                  <a className="link" href={open.assets.find((as) => as.kind === 'image')?.url} target="_blank" rel="noreferrer">
                    Open full size
                  </a>
                </div>
              )}
            </div>
          ) : open ? (
            <div className="ph">
              Preview attaches here when the design is uploaded.
              <br />
              {open.name}
            </div>
          ) : null}
        </div>
        <div className="side">
          <button type="button" className="x" id="close" aria-label="Close" onClick={closeDrawer}>
            ×
          </button>
          {open && (
            <>
              <h3 id="dtitle">{open.name}</h3>
              <div className="now">
                <span>Status</span>
                <span className={'pill ' + open.status} id="dpill">
                  {STATUS[open.status]}
                </span>
              </div>
              {open.late && isAdmin && <div className="flag">Scheduled date passed, mark as sent or move</div>}
              <div className="meta" id="dmeta">
                <span>Type</span>
                <b>{TYPES[open.type]}</b>
                <span>Built</span>
                <b>{open.built}</b>
                <span>Last update</span>
                <b>{open.since}</b>
                {open.channel === 'sms' && (
                  <>
                    <span>Channel</span>
                    <b>SMS</b>
                  </>
                )}
                {open.approval && (
                  <>
                    <span>Approved</span>
                    <b id="approval">
                      version {open.approval.version} by {open.approval.by}, {open.approval.on}
                    </b>
                  </>
                )}
                {open.offer && (
                  <>
                    <span>Offer runs</span>
                    <b id="offer">{offerLine(open.offer)}</b>
                  </>
                )}
                {open.scheduled && open.status === 'requested' && (
                  <>
                    <span>Requested date</span>
                    <b>{fmtShort(open.scheduled)}</b>
                  </>
                )}
                {open.scheduled && open.status === 'scheduled' && (
                  <>
                    <span>Send date</span>
                    <b className={open.late ? 'late' : ''}>{fmtShort(open.scheduled)}</b>
                  </>
                )}
                {open.asana && (
                  <>
                    <span>Asana</span>
                    <b>
                      {open.asana.url ? (
                        <a className="link" href={open.asana.url} target="_blank" rel="noreferrer">
                          {open.asana.stage ?? 'Open the task'}
                        </a>
                      ) : (
                        (open.asana.stage ?? 'Linked')
                      )}
                    </b>
                  </>
                )}
                {open.sent && open.status === 'sent' && (
                  <>
                    <span>Sent</span>
                    <b>{fmtShort(open.sent)}</b>
                  </>
                )}
                {open.figmaUrl && (
                  <>
                    <span>Figma</span>
                    <b>
                      <a className="link" href={open.figmaUrl} target="_blank" rel="noreferrer">
                        Open in Figma
                      </a>
                    </b>
                  </>
                )}
              </div>
              {open.results && (
                <div className="results" id="results">
                  <div className="k">
                    Results <span>{open.results.sentOn ? `sent ${open.results.sentOn}` : ''}</span>
                  </div>
                  <div className="tiles">
                    {open.results.openRate != null && (
                      <div>
                        <b>{pct(open.results.openRate)}</b>
                        <span>opened</span>
                      </div>
                    )}
                    {open.results.clickRate != null && (
                      <div>
                        <b>{pct(open.results.clickRate)}</b>
                        <span>clicked</span>
                      </div>
                    )}
                    {open.results.revenue != null && (
                      <div>
                        <b>{money(open.results.revenue)}</b>
                        <span>revenue</span>
                      </div>
                    )}
                    {open.results.recipients != null && (
                      <div>
                        <b>{num(open.results.recipients)}</b>
                        <span>recipients</span>
                      </div>
                    )}
                  </div>
                  {open.results.subject && <div className="small">Subject line: {open.results.subject}</div>}
                </div>
              )}
              <div className="actions" id="dactions">
                {actions.map((def) => (
                  <button key={def.action} type="button" className={'b ' + def.cls} disabled={busy} onClick={() => act(open, def)}>
                    <span>{def.label}</span>
                    <small>{def.small}</small>
                  </button>
                ))}
                {open.status === 'sent' && !isAdmin && (
                  <button type="button" className="b ghost" disabled>
                    <span>Sent</span>
                    <small>no actions</small>
                  </button>
                )}
                {!isAdmin && !data.canDecide && open.status !== 'sent' && <div className="hintline" id="commenter">{COMMENTER_ONLY}</div>}
                {!isAdmin && data.canDecide && open.status === 'scheduled' && <div className="hintline">ECD scheduled this one. Leave a note if the date needs to move.</div>}
                {!isAdmin && data.canDecide && open.status === 'requested' && <div className="hintline">ECD will confirm the date. It shows as Scheduled once it is set.</div>}
                {!isAdmin && data.canDecide && open.status === 'changes' && <div className="hintline">ECD is working on your changes. A new version comes back here for review.</div>}
                {adminBase && (
                  <a className="b ghost" href={editHref(open.id)}>
                    <span>Edit</span>
                    <small>name, files, dates</small>
                  </a>
                )}
              </div>
              <div className={'picker' + (picker ? ' on' : '')} id="picker">
                <div className="k">Pick an open slot</div>
                <div className="slots" id="slots">
                  {slotDays.map((d) => (
                    <button key={d} type="button" className="slot" disabled={busy || !openSet.has(d)} onClick={() => pickSlot(open, d)}>
                      {fmtShort(d)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="note">
                <div className="k">{isAdmin ? 'Note to the reviewer' : 'Note to ECD'}</div>
                <textarea id="note" ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isAdmin ? 'A note for the reviewer. Optional.' : 'What should change, or why it is on hold. Optional.'} />
                {note.trim() && (
                  <div>
                    <button type="button" className="btn sm" disabled={busy} onClick={() => sendNote(open)}>
                      Send note only
                    </button>
                  </div>
                )}
              </div>
              {hasImages && (
                <div className="notes" id="notes">
                  <div className="k">
                    Notes on the design <span>{openCount ? `${openCount} open` : currentPins.length ? 'all done' : ''}</span>
                  </div>
                  {currentPins.length === 0 && <div className="empty-notes">{isAdmin ? 'No notes on this version yet.' : 'Tap "Leave a note on the design" to point at exactly what should change.'}</div>}
                  {currentPins
                    .filter((p) => showDone || p.status === 'open')
                    .map((p) => (
                      <button key={p.id} type="button" className={'noteitem' + (p.id === activePin ? ' on' : '') + (p.status === 'resolved' ? ' done' : '')} onClick={() => focusPin(p)} data-testid="note-item">
                        <span className="num">{p.number}</span>
                        <span className="t">
                          <div>{p.comments[0]?.body}</div>
                          <span>
                            {p.author} · {p.when}
                            {open.assets.length > 1 ? ` · EM${p.em}` : ''}
                            {p.comments.length > 1 ? ` · ${p.comments.length - 1} repl${p.comments.length - 1 === 1 ? 'y' : 'ies'}` : ''}
                          </span>
                        </span>
                        {p.status === 'resolved' ? <span className="st">Done</span> : <span />}
                      </button>
                    ))}
                  {doneCount > 0 && (
                    <button type="button" className="toggle" onClick={() => setShowDone((v) => !v)}>
                      {showDone ? 'Hide done notes' : `Show ${doneCount} done note${doneCount > 1 ? 's' : ''}`}
                    </button>
                  )}
                  {earlierPins.length > 0 && (
                    <>
                      <div className="k" style={{ marginTop: 6 }}>
                        Notes on earlier versions
                      </div>
                      {earlierPins.map((p) => (
                        <div key={p.id} className={'noteitem' + (p.status === 'resolved' ? ' done' : '')} style={{ cursor: 'default' }}>
                          <span className="num">{p.number}</span>
                          <span className="t">
                            <div>{p.comments[0]?.body}</div>
                            <span>
                              {p.author} · {p.when} · version {p.version}
                            </span>
                          </span>
                          {p.cropUrl ? <img src={p.cropUrl} alt="" /> : <span />}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              <div className="thread" id="thread">
                {open.thread.map((m) => (
                  <div key={m.id} className={'msg' + (m.you ? ' you' : '') + (m.kind === 'system' ? ' sys' : '')}>
                    {m.pinNumber != null && (
                      <button type="button" className="pinref" title={`Show note ${m.pinNumber}`} onClick={() => open.pins.find((p) => p.number === m.pinNumber) && focusPin(open.pins.find((p) => p.number === m.pinNumber)!)}>
                        {m.pinNumber}
                      </button>
                    )}
                    <b>{m.who}</b>
                    <span>{m.when}</span>
                    <div>{m.body}</div>
                    {m.files.map((f, idx) => (
                      <a key={idx} className="v" href={f.url} target="_blank" rel="noreferrer">
                        {f.name}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
      <div className={'toast' + (toast.on ? ' on' : '')} id="toast">
        {toast.msg}
      </div>
    </>
  );
}

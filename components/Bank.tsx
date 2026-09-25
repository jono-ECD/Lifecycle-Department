'use client';

// The bank page and the campaign drawer. A port of the prototype's render functions; same markup, same classes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BankCampaign, BankPayload } from '@/lib/bank';
import { ORDER, STATUS, TYPES, type Status } from '@/lib/status';
import { actionsFor, NOTE_REQUIRED, type Action, type ActionDef } from '@/lib/transitions';
import { openSlots, windowDates } from '@/lib/slots';
import { fmtShort } from '@/lib/dates';

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
      if (busyRef.current || document.hidden) return;
      try {
        const r = await fetch(`/api/bank?workspace=${encodeURIComponent(ws.id)}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {
        /* offline, try again on the next tick */
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [ws.id]);

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const i of data.campaigns) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [data.campaigns]);

  const open = openId ? data.campaigns.find((c) => c.id === openId) ?? null : null;

  const closeDrawer = useCallback(() => {
    setOpenId(null);
    setPicker(null);
  }, []);

  const openItem = useCallback((id: string) => {
    setOpenId(id);
    setPicker(null);
    setNote('');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openId) closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openId, closeDrawer]);

  useEffect(() => {
    document.body.style.overflow = openId ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openId]);

  async function post(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    busyRef.current = true;
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; toast?: string; bank?: BankPayload };
      if (!r.ok) {
        showToast(j.error || 'Something went wrong. Try again.');
        return false;
      }
      if (j.bank) setData(j.bank);
      setNote('');
      setPicker(null);
      if (j.toast) showToast(j.toast);
      return true;
    } catch {
      showToast('No connection. Try again.');
      return false;
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
    void post(`/api/campaigns/${item.id}/transition`, { action: def.action, note: note.trim() || undefined });
  }

  function pickSlot(item: BankCampaign, date: string) {
    if (!picker) return;
    void post(`/api/campaigns/${item.id}/transition`, { action: picker, date, note: note.trim() || undefined });
  }

  function sendNote(item: BankCampaign) {
    if (!note.trim()) return;
    void post(`/api/campaigns/${item.id}/comments`, { body: note.trim() });
  }

  // ---- headline ----
  const n = counts.review ?? 0;
  const a = counts.approved ?? 0;
  const h = counts.hold ?? 0;

  // ---- window ----
  const filled = data.days.filter((d) => d.scheduled.length > 0).length;
  const openDays = data.days.filter((d) => !d.blocked && d.scheduled.length < ws.maxPerDay).length;
  const windowLabel = ws.windowDays === 14 ? 'Next two weeks' : `Next ${ws.windowDays} days`;

  // ---- list ----
  const rows = useMemo(() => {
    const r = data.campaigns.filter((i) => (filter === 'all' ? true : filter === 'bank' ? i.status === 'approved' || i.status === 'hold' : i.status === filter));
    return [...r].sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status));
  }, [data.campaigns, filter]);

  // ---- slots for the open item ----
  const slotInput = useMemo(() => {
    const cnt: Record<string, number> = {};
    for (const d of data.days) cnt[d.ymd] = d.scheduled.filter((s) => s.id !== openId).length;
    return { today: data.today, windowDays: ws.windowDays, maxPerDay: ws.maxPerDay, counts: cnt, blocked: data.days.filter((d) => d.blocked).map((d) => d.ymd), role };
  }, [data.days, data.today, ws.windowDays, ws.maxPerDay, role, openId]);
  const openSet = useMemo(() => new Set(openSlots(slotInput)), [slotInput]);
  const slotDays = useMemo(() => windowDates(data.today, ws.windowDays).filter((d) => isAdmin || d !== data.today), [data.today, ws.windowDays, isAdmin]);

  const editHref = (id: string) => (adminBase ? `${adminBase}/campaigns/${id}/edit` : '#');
  const cardOf = (i: BankCampaign) => i.assets[0] ?? null;

  const actions = open ? actionsFor(open.status, role) : [];

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
                {filled} scheduled, {openDays} open
              </span>
            </div>
            <div className="days" id="days" style={ws.windowDays !== 14 ? { gridTemplateColumns: `repeat(${Math.min(ws.windowDays, 14)},1fr)` } : undefined}>
              {data.days.map((d) => {
                const has = d.scheduled.length > 0;
                const cls = 'day' + (d.today ? ' today' : '') + (has ? ' has pick' : '') + (d.blocked ? ' blocked' : '');
                const title = has ? d.scheduled.map((s) => s.name).join(', ') : d.blocked ? `Blocked: ${d.blocked}` : undefined;
                return (
                  <button key={d.ymd} type="button" className={cls} title={title} onClick={has ? () => openItem(d.scheduled[0].id) : undefined} tabIndex={has ? 0 : -1} aria-label={`${fmtShort(d.ymd)}${title ? `, ${title}` : ''}`}>
                    <b>{d.day}</b>
                    <span>{d.wd}</span>
                    {has && <span className={'chip' + (d.scheduled.length > 1 ? ' two' : '')}>{d.scheduled.length > 1 ? `${d.scheduled.length} EM` : 'EM'}</span>}
                  </button>
                );
              })}
            </div>
            <div className="foot">Any open day can take an approved campaign. Pick the slot, we handle the rest.</div>
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
          {ORDER.map((s) => (
            <button key={s} type="button" className={'f ' + s + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>
              {STATUS[s]} <span className="n">{counts[s] ?? 0}</span>
            </button>
          ))}
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
                  ) : (
                    <div className="gph">
                      <MailIcon />
                    </div>
                  )}
                  <span className={'pill ' + i.status}>{STATUS[i.status]}</span>
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
                    <div className="th none">{first?.kind === 'pdf' ? 'PDF' : i.name[0]}</div>
                  )}
                  <div className="t">
                    <b>{i.name}</b>
                    <span>{i.sub}</span>
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
        <div className="preview" id="preview">
          {open && open.assets.length > 0 ? (
            <div className="stack">
              {open.assets.map((as) =>
                as.kind === 'image' ? (
                  <a key={as.id} href={as.url} target="_blank" rel="noreferrer" title="Open full size">
                    <img src={as.url} alt="" width={as.width ?? undefined} height={as.height ?? undefined} />
                  </a>
                ) : (
                  <a key={as.id} className="pdfcard" href={as.url} target="_blank" rel="noreferrer">
                    {as.thumbUrl ? <img src={as.thumbUrl} alt="" style={{ boxShadow: 'none', borderRadius: 8 }} /> : <PdfIcon />}
                    <span>Open the PDF</span>
                  </a>
                ),
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
                {open.scheduled && open.status === 'scheduled' && (
                  <>
                    <span>Send date</span>
                    <b className={open.late ? 'late' : ''}>{fmtShort(open.scheduled)}</b>
                  </>
                )}
                {open.sent && open.status === 'sent' && (
                  <>
                    <span>Sent</span>
                    <b>{fmtShort(open.sent)}</b>
                  </>
                )}
              </div>
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
              <div className="thread" id="thread">
                {open.thread.map((m) => (
                  <div key={m.id} className={'msg' + (m.you ? ' you' : '') + (m.kind === 'system' ? ' sys' : '')}>
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

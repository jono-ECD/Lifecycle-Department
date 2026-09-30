// Sent history with results. Same view for the client and for ECD; ECD also gets the link control.
import type { HistoryPayload } from '@/lib/history';
import { money, num, pct } from '@/lib/format';
import { LinkSelect } from '@/components/LinkSelect';

export function History({ data, backHref, admin }: { data: HistoryPayload; backHref: string; admin: boolean }) {
  const s = data.summary;
  const hasResults = data.rows.some((r) => r.openRate != null);
  return (
    <div className="app">
      <div className="top">
        <a className="brand" href={backHref}>
          {data.workspace.logoUrl ? <img className="mark" src={data.workspace.logoUrl} alt="" /> : null}
          <div className="bt">
            <h1>Campaign Bank</h1>
            <span>{data.workspace.name}</span>
          </div>
        </a>
        <a className="back" href={backHref}>
          Back to the bank
        </a>
      </div>

      <div className="page-h">
        <div>
          <h2 id="history-title">Sent history</h2>
          <p>
            {data.rows.length} email{data.rows.length === 1 ? '' : 's'} sent so far.
            {hasResults ? ` Results come from Klaviyo${data.syncedOn ? `, updated ${data.syncedOn}` : ''}.` : ''}
          </p>
        </div>
      </div>

      {admin && !data.connected && <div className="flag" style={{ marginBottom: 16 }}>Connect Klaviyo in Connections to see opens, clicks and revenue here. Until then the history lists what was marked as sent in the bank.</div>}

      {hasResults && (
        <div className="tiles wide" id="history-summary">
          <div>
            <b>{s.sent}</b>
            <span>emails in the last {s.days} days</span>
          </div>
          <div>
            <b>{num(s.recipients)}</b>
            <span>recipients</span>
          </div>
          <div>
            <b>{pct(s.openRate)}</b>
            <span>opened</span>
          </div>
          <div>
            <b>{pct(s.clickRate)}</b>
            <span>clicked</span>
          </div>
          <div>
            <b>{money(s.revenue)}</b>
            <span>revenue</span>
          </div>
        </div>
      )}

      {data.rows.length === 0 ? (
        <div className="empty">Nothing has been sent yet. Sent emails will be listed here with their results.</div>
      ) : (
        <div className="hist-list" id="history-list">
          <div className="hrow head">
            <span />
            <span>Email</span>
            <span className="n">Sent</span>
            <span className="n">Recipients</span>
            <span className="n">Opened</span>
            <span className="n">Clicked</span>
            <span className="n">Revenue</span>
          </div>
          {data.rows.map((r) => (
            <div className="hrow" key={r.key} data-testid="history-row">
              <div className="th">{r.thumbUrl ? <img src={r.thumbUrl} alt="" /> : r.name[0]}</div>
              <div className="t">
                <b>{r.name}</b>
                <span>{r.subject ? `Subject line: ${r.subject}` : (r.type ?? '')}</span>
                {admin && r.klaviyoRowId && r.source === 'klaviyo' && <LinkSelect rowId={r.klaviyoRowId} current={r.campaignId} options={data.linkable} />}
              </div>
              <div className="n">
                <small>Sent</small>
                {r.sentOn}
              </div>
              <div className={'n' + (r.recipients == null ? ' none' : '')}>
                <small>Recipients</small>
                {num(r.recipients)}
              </div>
              <div className={'n' + (r.openRate == null ? ' none' : '')}>
                <small>Opened</small>
                <b>{pct(r.openRate)}</b>
              </div>
              <div className={'n' + (r.clickRate == null ? ' none' : '')}>
                <small>Clicked</small>
                <b>{pct(r.clickRate)}</b>
              </div>
              <div className={'n' + (r.revenue == null ? ' none' : '')}>
                <small>Revenue</small>
                {money(r.revenue)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

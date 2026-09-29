'use client';

// Per workspace connections: Slack, Asana, Figma, Klaviyo, the content calendar sheet and a generic webhook.
// Plus the delivery log.
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { STAGE_KEYS, STAGE_LABELS, type AsanaEnumField, type StageMap } from '@/lib/integrations/asanaStage';

export interface IntegrationConfig {
  slackWebhookUrl: string;
  slackQuietUpdates: boolean;
  asanaProjectGid: string;
  asanaSectionGid: string;
  asanaAssigneeEmail: string;
  figmaFileKey: string;
  webhookUrl: string;
  webhookSecret: string;
  sheetUrl: string;
  sheetDateColumn: string;
  sheetNameColumn: string;
  sheetFilterColumn: string;
  sheetFilterValue: string;
  klaviyoKey: string;
  asanaStageFieldGid: string;
  asanaStageMap: Record<string, string>;
  googleSheetId: string;
  googleSheetTab: string;
  feed: 'keep' | 'create' | 'remove';
}

export interface SyncStatus {
  sheetSyncedOn: string | null;
  sheetError: string | null;
  sheetCount: number;
  klaviyoConnected: boolean;
  klaviyoHint: string | null;
  klaviyoSyncedOn: string | null;
  klaviyoError: string | null;
  asanaPulledOn: string | null;
  asanaPullError: string | null;
  feedUrl: string | null;
  sheetPushedOn: string | null;
  sheetPushError: string | null;
  googleReady: boolean;
}

export interface EventRow {
  id: string;
  type: string;
  target: string;
  status: string;
  error: string | null;
  result: string | null;
  attempts: number;
  when: string;
  campaign: string | null;
}

type Target = 'slack' | 'asana' | 'figma' | 'webhook';
type SyncTarget = 'sheet' | 'klaviyo' | 'asana' | 'asana_fields' | 'sheet_tab';
type Note = { kind: 'ok' | 'err'; text: string };

export function IntegrationsPanel({ workspaceId, initial, env, status: initialStatus, events: initialEvents, sample }: { workspaceId: string; initial: IntegrationConfig; env: { asanaToken: boolean; figmaToken: boolean; resend: boolean }; status: SyncStatus; events: EventRow[]; sample: { sheetUrl: string } | null }) {
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [events, setEvents] = useState(initialEvents);
  const [msg, setMsg] = useState<Note | null>(null);
  const [testMsg, setTestMsg] = useState<Partial<Record<Target | SyncTarget, Note>>>({});
  const [preview, setPreview] = useState<{ date: string; label: string }[]>([]);
  const [fields, setFields] = useState<AsanaEnumField[]>([]);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof IntegrationConfig>(k: K, v: IntegrationConfig[K]) => setF((s) => ({ ...s, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  async function save(): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    const r = await api<{ config: { klaviyoConnected: boolean; klaviyoKeyHint: string | null; feedUrl: string | null } }>(`/api/admin/integrations/${workspaceId}`, { method: 'PATCH', body: f });
    setBusy(false);
    if (!r.ok) {
      setMsg({ kind: 'err', text: r.error });
      return false;
    }
    const next = { ...f, klaviyoKey: '', feed: 'keep' as const };
    setF(next);
    setSaved(next);
    setStatus((s) => ({ ...s, klaviyoConnected: r.data.config.klaviyoConnected, klaviyoHint: r.data.config.klaviyoKeyHint, feedUrl: r.data.config.feedUrl }));
    setMsg({ kind: 'ok', text: 'Saved.' });
    return true;
  }

  async function test(target: Target) {
    setBusy(true);
    setTestMsg((t) => ({ ...t, [target]: undefined }));
    const r = await api<{ message: string }>(`/api/admin/integrations/${workspaceId}/test`, { body: { target } });
    setBusy(false);
    setTestMsg((t) => ({ ...t, [target]: r.ok ? { kind: 'ok', text: r.data.message } : { kind: 'err', text: r.error } }));
  }

  async function sync(target: SyncTarget) {
    setBusy(true);
    setTestMsg((t) => ({ ...t, [target]: undefined }));
    const r = await api<{ message: string; preview?: { date: string; label: string }[]; fields?: AsanaEnumField[]; guess?: { fieldGid: string; map: StageMap } | null }>(`/api/admin/integrations/${workspaceId}/sync`, { body: { target } });
    setBusy(false);
    setTestMsg((t) => ({ ...t, [target]: r.ok ? { kind: 'ok', text: r.data.message } : { kind: 'err', text: r.error } }));
    if (target === 'asana_fields' && r.ok) {
      setFields(r.data.fields ?? []);
      // a first guess from the option names, for ECD to confirm; what is stored is the ids
      const g = r.data.guess;
      if (g && !f.asanaStageFieldGid) setF((cur) => ({ ...cur, asanaStageFieldGid: g.fieldGid, asanaStageMap: { ...(g.map as Record<string, string>), ...cur.asanaStageMap } }));
    }
    if (target === 'asana') setStatus((cur) => ({ ...cur, asanaPullError: r.ok ? null : r.error, asanaPulledOn: 'just now' }));
    if (target === 'sheet_tab') setStatus((cur) => ({ ...cur, sheetPushError: r.ok ? null : r.error, sheetPushedOn: 'just now' }));
    if (target === 'sheet') {
      setPreview(r.ok ? (r.data.preview ?? []) : []);
      setStatus((s) => ({ ...s, sheetError: r.ok ? null : r.error, sheetSyncedOn: 'just now' }));
    } else if (target === 'klaviyo') setStatus((s) => ({ ...s, klaviyoError: r.ok ? null : r.error, klaviyoSyncedOn: 'just now' }));
  }

  async function removeKlaviyo() {
    if (!window.confirm('Disconnect Klaviyo for this client? Results already synced stay in the history.')) return;
    setBusy(true);
    const r = await api(`/api/admin/integrations/${workspaceId}`, { method: 'PATCH', body: { ...saved, klaviyoKey: 'remove' } });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setStatus((s) => ({ ...s, klaviyoConnected: false, klaviyoHint: null, klaviyoError: null, klaviyoSyncedOn: null }));
    setMsg({ kind: 'ok', text: 'Klaviyo disconnected.' });
  }

  async function feed(action: 'create' | 'remove') {
    if (action === 'remove' && !window.confirm('Turn the feed off? Any sheet importing it stops updating.')) return;
    setBusy(true);
    const r = await api<{ config: { feedUrl: string | null } }>(`/api/admin/integrations/${workspaceId}`, { method: 'PATCH', body: { ...saved, klaviyoKey: '', feed: action } });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setStatus((cur) => ({ ...cur, feedUrl: r.data.config.feedUrl }));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ kind: 'ok', text: 'Copied.' });
    } catch {
      setMsg({ kind: 'err', text: 'Copy failed. Select the text and copy it by hand.' });
    }
  }

  // with a Stage field already saved, show names instead of ids without asking for a click
  useEffect(() => {
    if (!initial.asanaProjectGid || !initial.asanaStageFieldGid || !env.asanaToken) return;
    let gone = false;
    api<{ fields?: AsanaEnumField[] }>(`/api/admin/integrations/${workspaceId}/sync`, { body: { target: 'asana_fields' } }).then((r) => {
      if (!gone && r.ok) setFields((cur) => (cur.length ? cur : (r.data.fields ?? [])));
    });
    return () => {
      gone = true;
    };
  }, [workspaceId, initial.asanaProjectGid, initial.asanaStageFieldGid, env.asanaToken]);

  const stageField = fields.find((x) => x.gid === f.asanaStageFieldGid);
  const problems = events.filter((e) => e.type === 'sync_error' && e.status === 'failed');
  const deliveries = events.filter((e) => e.type !== 'sync_error');

  async function retry(id: string) {
    setBusy(true);
    const r = await api<{ event: EventRow & { sentAt: string } }>(`/api/admin/integrations/events/${id}`, { body: {} });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, status: r.data.event.status, error: r.data.event.error, result: r.data.event.result, attempts: r.data.event.attempts } : e)));
  }

  const Status = ({ on, label, warn }: { on: boolean; label: string; warn?: string }) => <span className={'status ' + (warn ? 'warn' : on ? 'ok' : 'off')}>{warn || (on ? label : 'Not connected')}</span>;
  const Result = ({ t }: { t: Target | SyncTarget }) => (testMsg[t] ? <span className={testMsg[t]!.kind === 'ok' ? 'ok' : 'err'}>{testMsg[t]!.text}</span> : null);

  return (
    <div className="conn">
      {msg && <div className={msg.kind}>{msg.text}</div>}

      <div className="panel" data-conn="slack">
        <div className="k">Slack</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Client channel</h3>
          <Status on={!!saved.slackWebhookUrl} label="Connected" />
        </div>
        <p className="small" style={{ margin: 0 }}>
          Every change request and pinned note from this client posts here with their words verbatim, the crop of the area, and a link. In Slack: Apps, Incoming Webhooks, Add to a channel, then paste the URL.
        </p>
        <div className="form">
          <label>
            <b>Incoming webhook URL</b>
            <input type="text" value={f.slackWebhookUrl} onChange={(e) => set('slackWebhookUrl', e.target.value)} placeholder="https://hooks.slack.com/services/T000/B000/xxxx" />
          </label>
          <label className="inline" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <input type="checkbox" checked={f.slackQuietUpdates} onChange={(e) => set('slackQuietUpdates', e.target.checked)} style={{ width: 'auto', flex: 'none' }} />
            <span>Only post what needs attention from ECD (skip approvals, holds, scheduling and uploads)</span>
          </label>
        </div>
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.slackWebhookUrl || dirty} onClick={() => test('slack')}>
            Send a test message
          </button>
          <Result t="slack" />
        </div>
      </div>

      <div className="panel" data-conn="asana">
        <div className="k">Asana</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Campaigns and feedback</h3>
          <Status on={!!saved.asanaProjectGid && env.asanaToken} label="Connected" warn={saved.asanaProjectGid && !env.asanaToken ? 'Token missing' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          Client decisions and notes go onto the campaign&apos;s own Asana task as a comment that reads &quot;Name via Campaign Bank&quot;, with their words verbatim, and Stage moves with the decision. A note pinned on the design becomes a subtask with the crop attached; marking it done completes the subtask. A campaign with no Asana task gets a new task in this project instead. The agency token is <code>ASANA_ACCESS_TOKEN</code> in the environment{env.asanaToken ? ' (set)' : ' (not set yet)'}. A dedicated bot user keeps the comments clearly attributed.
        </p>
        <div className="form">
          <div className="row2">
            <label>
              <b>Project GID</b>
              <input type="text" value={f.asanaProjectGid} onChange={(e) => set('asanaProjectGid', e.target.value)} placeholder="1201234567890123" />
            </label>
            <label>
              <b>Section GID, optional</b>
              <input type="text" value={f.asanaSectionGid} onChange={(e) => set('asanaSectionGid', e.target.value)} placeholder="1201234567890999" />
            </label>
          </div>
          <label>
            <b>Assign to, optional</b>
            <input type="email" value={f.asanaAssigneeEmail} onChange={(e) => set('asanaAssigneeEmail', e.target.value)} placeholder="designer@ecdigitalstrategy.com" />
          </label>
        </div>
        <div className="form" style={{ maxWidth: 'none' }}>
          <div className="small">
            <b>Campaigns come from Asana.</b> Each task in the section above becomes a campaign, keyed on the task id. The Bank reads the name, due date, Stage, and the Design: and Klaviyo: lines of the task notes every five minutes. Asana stays the place where work moves.
          </div>
          <div className="inline">
            <button className="btn sm" type="button" disabled={busy || !saved.asanaProjectGid || dirty} onClick={() => sync('asana_fields')} data-testid="asana-fields">
              Load the Stage fields
            </button>
            <Result t="asana_fields" />
          </div>
          {(fields.length > 0 || f.asanaStageFieldGid) && (
            <>
              <label>
                <b>Stage field in Asana</b>
                {fields.length > 0 ? (
                  <select value={f.asanaStageFieldGid} onChange={(e) => setF((cur) => ({ ...cur, asanaStageFieldGid: e.target.value, asanaStageMap: {} }))} data-testid="asana-stage-field">
                    <option value="">Pick the field</option>
                    {fields.map((x) => (
                      <option key={x.gid} value={x.gid}>
                        {x.name} (id {x.gid}, {x.options.length} options)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value="Loading the names from Asana" readOnly />
                )}
              </label>
              <div className="stagemap" data-testid="asana-stage-map">
                {STAGE_KEYS.map((k) => (
                  <label key={k}>
                    <b>{STAGE_LABELS[k].ask}</b>
                    {stageField ? (
                      <select value={f.asanaStageMap[k] ?? ''} onChange={(e) => setF((cur) => ({ ...cur, asanaStageMap: { ...cur.asanaStageMap, [k]: e.target.value } }))}>
                        <option value="">Not used</option>
                        {stageField.options.map((o) => (
                          <option key={o.gid} value={o.gid}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={f.asanaStageMap[k] ? 'Loading the names from Asana' : ''} readOnly placeholder="Click Load the Stage fields to choose" />
                    )}
                    <span>
                      {STAGE_LABELS[k].direction === 'in' ? 'Asana tells the Bank.' : 'The Bank writes this to Asana.'} Usual name: {STAGE_LABELS[k].label}.
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        {status.asanaPullError && <div className="err">{status.asanaPullError}</div>}
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.asanaProjectGid || dirty} onClick={() => test('asana')}>
            Check the connection
          </button>
          <button className="btn sm" type="button" disabled={busy || !saved.asanaProjectGid || dirty} onClick={() => sync('asana')} data-testid="asana-pull">
            Pull from Asana now
          </button>
          {status.asanaPulledOn && <span className="small">Last pull {status.asanaPulledOn}.</span>}
          <Result t="asana" />
        </div>
        {problems.length > 0 && (
          <div data-testid="sync-problems">
            <div className="small" style={{ marginBottom: 6 }}>
              <b>Needs a look in Asana.</b> The Bank left these alone instead of guessing. Each clears on its own once the task is fixed.
            </div>
            {problems.map((p) => (
              <div key={p.id} className="flag" style={{ marginBottom: 6 }}>
                {p.error}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" data-conn="figma">
        <div className="k">Figma</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Design file</h3>
          <Status on={!!saved.figmaFileKey && env.figmaToken} label="Connected" warn={saved.figmaFileKey && !env.figmaToken ? 'Token missing' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          With <code>FIGMA_ACCESS_TOKEN</code> set{env.figmaToken ? ' (it is)' : ' (not yet)'}, Import from Figma lists the frames of a file so you can bring them in as campaigns. The file key here is the default file for this client, the part of the URL after /design/.
        </p>
        <div className="form">
          <label>
            <b>File key</b>
            <input type="text" value={f.figmaFileKey} onChange={(e) => set('figmaFileKey', e.target.value)} placeholder="AbC123dEf456" />
          </label>
        </div>
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.figmaFileKey || dirty} onClick={() => test('figma')}>
            Check the file
          </button>
          <Result t="figma" />
        </div>
      </div>

      <div className="panel" data-conn="klaviyo">
        <div className="k">Klaviyo</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Results of sent emails</h3>
          <Status on={status.klaviyoConnected} label="Connected" warn={status.klaviyoConnected && status.klaviyoError ? 'Needs attention' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          Pulls every sent email campaign from this client&apos;s Klaviyo account with recipients, opens, clicks and revenue, and shows them in Sent history for ECD and the client. Refreshes every three hours. In Klaviyo: Settings, API keys, create a private key with read access to campaigns, metrics and reporting. The key is stored encrypted and never shown again.
        </p>
        <div className="form">
          <label>
            <b>{status.klaviyoConnected ? `Private API key (saved as ${status.klaviyoHint ?? 'pk_'}), paste a new one to replace it` : 'Private API key'}</b>
            {/* not a password field: browsers fill those with the saved sign in password, which then gets sent as the key */}
            <input type="text" name="klaviyo-private-key" value={f.klaviyoKey} onChange={(e) => set('klaviyoKey', e.target.value)} placeholder="pk_..." autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true" data-form-type="other" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }} data-testid="klaviyo-key" />
          </label>
        </div>
        {status.klaviyoError && <div className="err">{status.klaviyoError}</div>}
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !status.klaviyoConnected || dirty} onClick={() => sync('klaviyo')} data-testid="klaviyo-sync">
            Sync now
          </button>
          {status.klaviyoConnected && (
            <button className="btn sm danger" type="button" disabled={busy} onClick={removeKlaviyo}>
              Disconnect
            </button>
          )}
          {status.klaviyoSyncedOn && <span className="small">Last synced {status.klaviyoSyncedOn}.</span>}
          <Result t="klaviyo" />
        </div>
      </div>

      <div className="panel" data-conn="sheet">
        <div className="k">Content calendar</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Spreadsheet of planned sends</h3>
          <Status on={!!saved.sheetUrl} label={`${status.sheetCount} on the calendar`} warn={saved.sheetUrl && status.sheetError ? 'Needs attention' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          Paste the link to the Google Sheet where sends are planned. The bank reads it every 15 minutes, shows each planned send on the calendar, and keeps that day from being double booked. In Google Sheets set sharing to Anyone with the link can view. Excel works too: publish or export it as CSV and paste that link.
        </p>
        {sample && !f.sheetUrl && (
          <div className="sample">
            Sample mode is on.{' '}
            <button type="button" className="link" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => setF((s) => ({ ...s, sheetUrl: sample.sheetUrl, sheetFilterColumn: 'Client', sheetFilterValue: 'Blessed Botanicals' }))} data-testid="sheet-sample">
              Use the sample calendar
            </button>{' '}
            to see how it works.
          </div>
        )}
        <div className="form">
          <label>
            <b>Spreadsheet link</b>
            <input type="text" value={f.sheetUrl} onChange={(e) => set('sheetUrl', e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0" data-testid="sheet-url" />
          </label>
          <div className="row2">
            <label>
              <b>Date column, optional</b>
              <input type="text" value={f.sheetDateColumn} onChange={(e) => set('sheetDateColumn', e.target.value)} placeholder="Found on its own, for example Send Date" />
            </label>
            <label>
              <b>Campaign name column, optional</b>
              <input type="text" value={f.sheetNameColumn} onChange={(e) => set('sheetNameColumn', e.target.value)} placeholder="Found on its own, for example Campaign" />
            </label>
          </div>
          <div className="row2">
            <label>
              <b>Only rows where this column</b>
              <input type="text" value={f.sheetFilterColumn} onChange={(e) => set('sheetFilterColumn', e.target.value)} placeholder="Client" />
            </label>
            <label>
              <b>Contains</b>
              <input type="text" value={f.sheetFilterValue} onChange={(e) => set('sheetFilterValue', e.target.value)} placeholder="Blessed Botanicals" />
            </label>
          </div>
          <span className="small">Use the last two fields when one sheet holds every client. Leave them empty when the sheet is for this client only.</span>
        </div>
        {status.sheetError && <div className="err">{status.sheetError}</div>}
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.sheetUrl || dirty} onClick={() => sync('sheet')} data-testid="sheet-sync">
            Sync now
          </button>
          {status.sheetSyncedOn && <span className="small">Last read {status.sheetSyncedOn}.</span>}
          <Result t="sheet" />
        </div>
        {preview.length > 0 && (
          <table className="tbl" data-testid="sheet-preview">
            <tbody>
              {preview.map((p, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap', width: 90 }}>{p.date}</td>
                  <td>{p.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" data-conn="tab">
        <div className="k">Scheduler sheet</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>The Campaign Bank tab</h3>
          <Status on={!!status.feedUrl || (!!saved.googleSheetId && status.googleReady)} label="Connected" warn={status.sheetPushError ? 'Needs attention' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          The Bank keeps its own tab and never touches the calendar grid, so inserting a row in the grid cannot break anything. One row per campaign, keyed on the Asana task id: status, approved version and by whom, requested or scheduled date, offer window. The grid can look values up from it.
        </p>
        <div className="form" style={{ maxWidth: 'none' }}>
          <div className="small">
            <b>Without any Google account.</b> Create a feed link, add a tab named Campaign Bank to the sheet, and paste the formula in cell A1. Google refreshes it about once an hour.
          </div>
          {status.feedUrl ? (
            <>
              <code style={{ display: 'block', wordBreak: 'break-all' }} data-testid="feed-formula">{`=IMPORTDATA("${status.feedUrl}")`}</code>
              <div className="inline">
                <button className="btn sm" type="button" onClick={() => copy(`=IMPORTDATA("${status.feedUrl}")`)}>
                  Copy the formula
                </button>
                <a className="btn sm" href={status.feedUrl} target="_blank" rel="noreferrer">
                  Open the feed
                </a>
                <button className="btn sm danger" type="button" disabled={busy} onClick={() => feed('remove')}>
                  Turn the feed off
                </button>
              </div>
            </>
          ) : (
            <div className="inline">
              <button className="btn sm" type="button" disabled={busy || dirty} onClick={() => feed('create')} data-testid="feed-create">
                Create the feed link
              </button>
            </div>
          )}
          <div className="small" style={{ marginTop: 6 }}>
            <b>Within a minute of every change.</b> Share the sheet with a Google service account as an editor and put its key in <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>{status.googleReady ? ' (set)' : ' (not set yet)'}. The Bank then rewrites the whole tab after each change.
          </div>
          <div className="row2">
            <label>
              <b>Sheet id</b>
              <input type="text" value={f.googleSheetId} onChange={(e) => set('googleSheetId', e.target.value)} placeholder="the long part of the sheet URL after /d/" />
            </label>
            <label>
              <b>Tab name</b>
              <input type="text" value={f.googleSheetTab} onChange={(e) => set('googleSheetTab', e.target.value)} placeholder="Campaign Bank" />
            </label>
          </div>
        </div>
        {status.sheetPushError && <div className="err">{status.sheetPushError}</div>}
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.googleSheetId || !status.googleReady || dirty} onClick={() => sync('sheet_tab')}>
            Rewrite the tab now
          </button>
          {status.sheetPushedOn && <span className="small">Last written {status.sheetPushedOn}.</span>}
          <Result t="sheet_tab" />
        </div>
      </div>

      <div className="panel" data-conn="webhook">
        <div className="k">Webhook</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Anything else</h3>
          <Status on={!!saved.webhookUrl} label="Connected" />
        </div>
        <p className="small" style={{ margin: 0 }}>
          Every event is also posted as JSON to this URL, signed with the secret (header <code>X-Bank-Signature</code>). Point Zapier, Make or n8n at it to reach any other tool.
        </p>
        <div className="form">
          <div className="row2">
            <label>
              <b>URL</b>
              <input type="text" value={f.webhookUrl} onChange={(e) => set('webhookUrl', e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/..." />
            </label>
            <label>
              <b>Secret, optional</b>
              <input type="text" value={f.webhookSecret} onChange={(e) => set('webhookSecret', e.target.value)} placeholder="random string" />
            </label>
          </div>
        </div>
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.webhookUrl || dirty} onClick={() => test('webhook')}>
            Send a test delivery
          </button>
          <Result t="webhook" />
        </div>
      </div>

      <div className="sticky-bar">
        <button className="btn primary" type="button" disabled={busy || !dirty} onClick={save} data-testid="save-integrations">
          Save connections
        </button>
        {dirty && <span className="small">Unsaved changes. Save before testing or syncing.</span>}
      </div>

      <div className="panel">
        <div className="k">Deliveries</div>
        <h3>What went out</h3>
        {deliveries.length === 0 ? (
          <div className="small">Nothing yet. Deliveries appear here once a connection is saved and something happens in the bank.</div>
        ) : (
          <table className="tbl evlog">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>To</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {e.when}
                  </td>
                  <td>
                    {e.type.replace(/_/g, ' ')}
                    {e.campaign ? <span className="muted"> · {e.campaign}</span> : null}
                  </td>
                  <td>{e.target}</td>
                  <td>
                    <span className={'status ' + (e.status === 'sent' ? 'ok' : e.status === 'failed' || e.status === 'dead' ? 'warn' : 'off')}>{e.status === 'dead' ? 'gave up' : e.status}</span>
                    {e.error && (
                      <div className="err" style={{ marginTop: 4 }}>
                        {e.error}
                      </div>
                    )}
                  </td>
                  <td className="r">
                    {e.status !== 'sent' && (
                      <button className="btn sm" type="button" disabled={busy} onClick={() => retry(e.id)}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

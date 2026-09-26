'use client';

// Per workspace connections: Slack channel, Asana project, Figma file, generic webhook. Plus the delivery log.
import { useState } from 'react';
import { api } from '@/lib/client';

export interface IntegrationConfig {
  slackWebhookUrl: string;
  slackQuietUpdates: boolean;
  asanaProjectGid: string;
  asanaSectionGid: string;
  asanaAssigneeEmail: string;
  figmaFileKey: string;
  webhookUrl: string;
  webhookSecret: string;
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

export function IntegrationsPanel({ workspaceId, initial, env, events: initialEvents }: { workspaceId: string; initial: IntegrationConfig; env: { asanaToken: boolean; figmaToken: boolean; resend: boolean }; events: EventRow[] }) {
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [events, setEvents] = useState(initialEvents);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [testMsg, setTestMsg] = useState<Partial<Record<Target, { kind: 'ok' | 'err'; text: string }>>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof IntegrationConfig>(k: K, v: IntegrationConfig[K]) => setF((s) => ({ ...s, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await api<{ config: Record<string, unknown> }>(`/api/admin/integrations/${workspaceId}`, { method: 'PATCH', body: f });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setSaved(f);
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function test(target: Target) {
    setBusy(true);
    setTestMsg((t) => ({ ...t, [target]: undefined }));
    const r = await api<{ message: string }>(`/api/admin/integrations/${workspaceId}/test`, { body: { target } });
    setBusy(false);
    setTestMsg((t) => ({ ...t, [target]: r.ok ? { kind: 'ok', text: r.data.message } : { kind: 'err', text: r.error } }));
  }

  async function retry(id: string) {
    setBusy(true);
    const r = await api<{ event: EventRow & { sentAt: string } }>(`/api/admin/integrations/events/${id}`, { body: {} });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.error });
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, status: r.data.event.status, error: r.data.event.error, result: r.data.event.result, attempts: r.data.event.attempts } : e)));
  }

  const Status = ({ on, label, warn }: { on: boolean; label: string; warn?: string }) => <span className={'status ' + (on ? 'ok' : warn ? 'warn' : 'off')}>{on ? label : warn || 'Not connected'}</span>;

  return (
    <div className="conn">
      {msg && <div className={msg.kind}>{msg.text}</div>}

      <div className="panel">
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
            <input type="checkbox" checked={f.slackQuietUpdates} onChange={(e) => set('slackQuietUpdates', e.target.checked)} style={{ width: 'auto' }} />
            <span>Only post what needs attention from ECD (skip approvals, holds, scheduling and uploads)</span>
          </label>
        </div>
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.slackWebhookUrl || dirty} onClick={() => test('slack')}>
            Send a test message
          </button>
          {testMsg.slack && <span className={testMsg.slack.kind === 'ok' ? 'ok' : 'err'}>{testMsg.slack.text}</span>}
        </div>
      </div>

      <div className="panel">
        <div className="k">Asana</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Tasks for edits</h3>
          <Status on={!!saved.asanaProjectGid && env.asanaToken} label="Connected" warn={saved.asanaProjectGid && !env.asanaToken ? 'Token missing' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          A change request or a pinned note from the client becomes a task in this project, with the words of the client first, the crop attached, and a link back. Replies become task comments; marking a note done completes the task. The agency token is <code>ASANA_ACCESS_TOKEN</code> in the environment{env.asanaToken ? ' (set)' : ' (not set yet)'}.
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
        <div className="inline">
          <button className="btn sm" type="button" disabled={busy || !saved.asanaProjectGid || dirty} onClick={() => test('asana')}>
            Check the connection
          </button>
          {testMsg.asana && <span className={testMsg.asana.kind === 'ok' ? 'ok' : 'err'}>{testMsg.asana.text}</span>}
        </div>
      </div>

      <div className="panel">
        <div className="k">Figma</div>
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <h3>Design file</h3>
          <Status on={!!saved.figmaFileKey && env.figmaToken} label="Connected" warn={saved.figmaFileKey && !env.figmaToken ? 'Token missing' : undefined} />
        </div>
        <p className="small" style={{ margin: 0 }}>
          With <code>FIGMA_ACCESS_TOKEN</code> set{env.figmaToken ? ' (it is)' : ' (not yet)'}, a campaign can pull its frame straight from a Figma link as a new version. The file key here is the default file for this client, the part of the URL after /design/.
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
          {testMsg.figma && <span className={testMsg.figma.kind === 'ok' ? 'ok' : 'err'}>{testMsg.figma.text}</span>}
        </div>
      </div>

      <div className="panel">
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
          {testMsg.webhook && <span className={testMsg.webhook.kind === 'ok' ? 'ok' : 'err'}>{testMsg.webhook.text}</span>}
        </div>
      </div>

      <div className="inline">
        <button className="btn primary" type="button" disabled={busy || !dirty} onClick={save} data-testid="save-integrations">
          Save connections
        </button>
        {dirty && <span className="small">Unsaved changes.</span>}
      </div>

      <div className="panel">
        <div className="k">Deliveries</div>
        <h3>What went out</h3>
        {events.length === 0 ? (
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
              {events.map((e) => (
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
                    <span className={'status ' + (e.status === 'sent' ? 'ok' : e.status === 'failed' ? 'warn' : 'off')}>{e.status}</span>
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

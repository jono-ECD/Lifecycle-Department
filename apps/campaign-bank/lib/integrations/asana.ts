// Asana REST API over plain fetch. Token is agency level (ASANA_ACCESS_TOKEN, ideally a dedicated
// "ECD Campaign Bank" bot user so comments are clearly attributed). Project and Stage are per workspace.
// Stage is always bound by field id and option id, never by name.
import { env } from '@/lib/env';
import { contextLine, headline, type EventPayload } from './types';
import { parseFigmaUrl } from './figma';

const base = () => env('ASANA_API_BASE', 'https://app.asana.com/api/1.0').replace(/\/$/, '');

export interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  dueOn: string | null;
  completed: boolean;
  url: string | null;
  fields: { gid: string; name: string; optionGid: string | null; optionName: string | null }[];
}

export { STAGE_KEYS, STAGE_LABELS, guessStageMap, parseStageMap, type AsanaEnumField, type StageMap } from './asanaStage';
import type { AsanaEnumField, StageMap } from './asanaStage';

/** Task id from any Asana task link, old or new format. */
export function parseAsanaTaskUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return /^\d{8,}$/.test(url.trim()) ? url.trim() : null;
  }
  if (!/(^|\.)asana\.com$/.test(u.hostname)) return null;
  const direct = u.pathname.match(/\/task\/(\d{6,})/);
  if (direct) return direct[1];
  const legacy = u.pathname.match(/^\/0\/\d+\/(\d{6,})/);
  return legacy ? legacy[1] : null;
}

export interface ParsedNotes {
  figmaUrl: string | null;
  klaviyoCampaignId: string | null;
  /** For SMS tasks: the copy, from a "Copy:" or "SMS:" line and the lines that follow it. */
  smsText: string | null;
  problems: string[];
}

/** Reads the Design: and Klaviyo: lines of the task notes template. Says what it could not read. */
export function parseTaskNotes(notes: string): ParsedNotes {
  const problems: string[] = [];
  const line = (label: RegExp) => {
    const m = notes.split(/\r?\n/).find((l) => label.test(l));
    return m ? m.replace(label, '').trim() : null;
  };
  const design = line(/^\s*(design|figma)\s*:/i);
  const klaviyo = line(/^\s*klaviyo\s*:/i);

  let figmaUrl: string | null = null;
  if (design === null) problems.push('The task notes have no "Design:" line.');
  else {
    const url = design.match(/https?:\/\/\S+/)?.[0]?.replace(/[)>.,]+$/, '') ?? '';
    const ref = url ? parseFigmaUrl(url) : null;
    if (!url) problems.push('The "Design:" line has no link yet.');
    else if (!ref) problems.push('The "Design:" link is not a Figma link.');
    else if (!ref.nodeId) problems.push('The "Design:" link points to the file, not to a frame. Copy the link with the frame selected.');
    else figmaUrl = url;
  }

  let klaviyoCampaignId: string | null = null;
  if (klaviyo) {
    const fromUrl = klaviyo.match(/klaviyo\.com\/(?:campaign|campaigns)\/([A-Za-z0-9]+)/)?.[1];
    const bare = klaviyo.match(/^[A-Za-z0-9]{2,40}$/)?.[0];
    klaviyoCampaignId = fromUrl ?? bare ?? null;
    if (!klaviyoCampaignId && /\S/.test(klaviyo)) problems.push('The "Klaviyo:" line could not be read as a campaign link.');
  }
  // SMS copy runs from its label to the next template line or the end. The copy itself may hold a
  // colon ("Shop now: ..."), so only a known template label ends it.
  let smsText: string | null = null;
  const lines = notes.split(/\r?\n/);
  const at = lines.findIndex((l) => /^\s*(sms\s*copy|copy|sms|message)\s*:/i.test(l));
  if (at >= 0) {
    const out = [lines[at].replace(/^\s*(sms\s*copy|copy|sms|message)\s*:/i, '').trim()];
    for (const l of lines.slice(at + 1)) {
      if (/^\s*(brief|copy doc|design|figma|klaviyo|owner|notes?|links?|subject|preview|audience|segment|send date|due|status|offer|code|qa)\s*:/i.test(l)) break;
      out.push(l.trim());
    }
    smsText = out.join('\n').trim() || null;
  }
  return { figmaUrl, klaviyoCampaignId, smsText, problems };
}

/** Email or SMS, from a channel field when there is one, else from the task name. Null means skip the task. */
export function channelOf(task: AsanaTask): 'email' | 'sms' | null {
  const f = task.fields.find((x) => /^(channel|medium|type)$/i.test(x.name) && x.optionName);
  if (f?.optionName) {
    if (/sms|text/i.test(f.optionName)) return 'sms';
    if (/email|e-mail|campaign/i.test(f.optionName)) return 'email';
    return null;
  }
  return /\bsms\b|\btext message\b/i.test(task.name) ? 'sms' : 'email';
}

export class AsanaClient {
  constructor(
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async raw<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.fetchImpl(`${base()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify({ data: body }) : undefined,
    });
    if (!r.ok) {
      const text = (await r.text().catch(() => '')).slice(0, 300);
      const msg = r.status === 401 ? 'Asana rejected the token.' : r.status === 403 || r.status === 404 ? 'Asana could not find that, or the token cannot see it.' : r.status === 429 ? 'Asana asked us to slow down.' : `Asana ${r.status}: ${text}`;
      throw new Error(msg);
    }
    return (await r.json()) as T;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await this.raw<{ data: T }>(method, path, body)).data;
  }

  async createTask(input: { projectGid: string; sectionGid?: string | null; name: string; notes: string; assigneeEmail?: string | null }): Promise<{ gid: string; permalink_url?: string }> {
    const data: Record<string, unknown> = { name: input.name, notes: input.notes, projects: [input.projectGid] };
    if (input.sectionGid) data.memberships = [{ project: input.projectGid, section: input.sectionGid }];
    if (input.assigneeEmail) data.assignee = input.assigneeEmail;
    return this.call('POST', '/tasks', data);
  }

  /** A to do under the campaign's own task, so edits stay with the campaign. */
  async createSubtask(parentGid: string, input: { name: string; notes: string; assigneeEmail?: string | null }): Promise<{ gid: string }> {
    const data: Record<string, unknown> = { name: input.name, notes: input.notes };
    if (input.assigneeEmail) data.assignee = input.assigneeEmail;
    return this.call('POST', `/tasks/${parentGid}/subtasks`, data);
  }

  async addComment(taskGid: string, text: string): Promise<{ gid: string }> {
    return this.call('POST', `/tasks/${taskGid}/stories`, { text });
  }

  async setCompleted(taskGid: string, completed: boolean): Promise<{ gid: string }> {
    return this.call('PUT', `/tasks/${taskGid}`, { completed });
  }

  /** Writes Stage by field id and option id. */
  async setStage(taskGid: string, fieldGid: string, optionGid: string): Promise<{ gid: string }> {
    return this.call('PUT', `/tasks/${taskGid}`, { custom_fields: { [fieldGid]: optionGid } });
  }

  async attach(taskGid: string, file: Buffer, name: string, contentType: string): Promise<{ gid: string }> {
    const form = new FormData();
    form.set('parent', taskGid);
    form.set('file', new Blob([new Uint8Array(file)], { type: contentType }), name);
    const r = await this.fetchImpl(`${base()}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: form });
    if (!r.ok) throw new Error(`Asana attachment ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}`);
    return ((await r.json()) as { data: { gid: string } }).data;
  }

  async me(): Promise<{ gid: string; name: string }> {
    return this.call('GET', '/users/me');
  }

  async project(gid: string): Promise<{ gid: string; name: string }> {
    return this.call('GET', `/projects/${gid}`);
  }

  /** Dropdown fields of the project with their options. Two fields with one name show up as two entries. */
  async enumFields(projectGid: string): Promise<AsanaEnumField[]> {
    type Row = { custom_field: { gid: string; name: string; resource_subtype?: string; type?: string; enum_options?: { gid: string; name: string; enabled?: boolean }[] } };
    const rows = await this.call<Row[]>('GET', `/projects/${projectGid}/custom_field_settings?opt_fields=custom_field.gid,custom_field.name,custom_field.resource_subtype,custom_field.enum_options.gid,custom_field.enum_options.name,custom_field.enum_options.enabled&limit=100`);
    return rows
      .map((r) => r.custom_field)
      .filter((f) => (f.resource_subtype ?? f.type) === 'enum' && f.enum_options)
      .map((f) => ({ gid: f.gid, name: f.name, options: (f.enum_options ?? []).filter((o) => o.enabled !== false).map((o) => ({ gid: o.gid, name: o.name })) }));
  }

  /** Tasks of the campaign section (or project) changed since the last pull. Follows pages. */
  async tasks(input: { projectGid: string; sectionGid?: string | null; modifiedSince?: Date | null; maxPages?: number }): Promise<AsanaTask[]> {
    type Row = { gid: string; name: string; notes?: string; due_on?: string | null; completed?: boolean; permalink_url?: string; custom_fields?: { gid: string; name: string; enum_value?: { gid: string; name: string } | null }[] };
    const fields = 'name,notes,due_on,completed,permalink_url,custom_fields.gid,custom_fields.name,custom_fields.enum_value.gid,custom_fields.enum_value.name';
    const scope = input.sectionGid ? `section=${input.sectionGid}` : `project=${input.projectGid}`;
    const since = input.modifiedSince ? `&modified_since=${encodeURIComponent(input.modifiedSince.toISOString())}` : '&completed_since=now';
    const out: AsanaTask[] = [];
    let offset: string | null = null;
    for (let page = 0; page < (input.maxPages ?? 10); page++) {
      const res: { data: Row[]; next_page?: { offset?: string } | null } = await this.raw('GET', `/tasks?${scope}${since}&opt_fields=${fields}&limit=100${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`);
      for (const t of res.data) {
        out.push({
          gid: t.gid,
          name: t.name,
          notes: t.notes ?? '',
          dueOn: t.due_on ?? null,
          completed: !!t.completed,
          url: t.permalink_url ?? null,
          fields: (t.custom_fields ?? []).map((f) => ({ gid: f.gid, name: f.name, optionGid: f.enum_value?.gid ?? null, optionName: f.enum_value?.name ?? null })),
        });
      }
      offset = res.next_page?.offset ?? null;
      if (!offset) break;
    }
    return out;
  }
}

function contextLines(p: EventPayload): string[] {
  const lines: string[] = [];
  lines.push(`Campaign: ${p.campaign.name}${p.campaign.subtitle ? `, ${p.campaign.subtitle}` : ''}`);
  lines.push(`Client: ${p.workspace.name}`);
  if (p.em) lines.push(`Email: EM${p.em.index} of ${p.em.count}${p.campaign.version ? `, version ${p.campaign.version}` : ''}`);
  else if (p.campaign.version) lines.push(`Version: ${p.campaign.version}`);
  if (p.pin) lines.push(`Where: ${p.pin.position} of the design, note ${p.pin.number}`);
  lines.push(`Status now: ${p.campaign.status}`);
  lines.push('');
  lines.push(`Open in the bank: ${p.links.admin}`);
  if (p.pin?.cropUrl) lines.push(`Crop of the area: ${p.pin.cropUrl}`);
  return lines;
}

/** Task name and notes. The client's words come first and verbatim; context follows in plain lines. */
export function buildAsanaTask(p: EventPayload): { name: string; notes: string } {
  const kind = p.type === 'change_request' ? 'Change request' : p.type === 'pin_created' ? `Note ${p.pin?.number ?? ''}`.trim() : 'Note';
  const em = p.em && p.em.count > 1 ? ` (EM${p.em.index})` : '';
  const name = `${kind}: ${p.campaign.name}${em} · ${p.workspace.name}`;
  return { name, notes: [`${p.actor.name} wrote:`, `"${(p.text ?? '').trim()}"`, '', ...contextLines(p)].join('\n') };
}

export function buildAsanaReply(p: EventPayload): string {
  return `${headline(p)}\n"${(p.text ?? '').trim()}"\n${contextLine(p)}\n${p.links.admin}`;
}

/** Comment on the campaign's own task: "Name via Campaign Bank: …". */
export function buildAsanaComment(p: EventPayload): string {
  const who = `${p.actor.name} via Campaign Bank`;
  const v = p.campaign.version ? ` v${p.campaign.version}` : '';
  let first: string;
  switch (p.type) {
    case 'approved':
      first = `Approved${v} by ${p.actor.name}, via Campaign Bank.`;
      break;
    case 'change_request':
      first = `${who}: requested changes on${v ? ` version ${p.campaign.version}` : ' the design'}.`;
      break;
    case 'hold':
      first = `${who}: put this on hold.`;
      break;
    case 'date_requested':
      first = `${who}: client requests ${p.date ?? 'a date'} as the send date.`;
      break;
    case 'unscheduled':
      first = `${who}: the requested date was withdrawn.`;
      break;
    case 'back_to_review':
      first = `${who}: moved this back to review.`;
      break;
    case 'pin_created':
      first = `${who}: left note ${p.pin?.number ?? ''} on the design.`;
      break;
    default:
      first = `${who}: ${headline(p)}.`;
  }
  const quote = p.text ? [`"${p.text.trim()}"`] : [];
  return [first, ...quote, '', contextLine(p), p.links.admin].join('\n');
}

/** Which Stage the Bank sets for a client decision. Undefined means leave Stage alone. */
export function stageFor(p: EventPayload, map: StageMap): string | undefined {
  if (p.type === 'change_request') return map.changes;
  if (p.type === 'approved') return map.approved;
  if (p.type === 'hold') return map.hold;
  return undefined;
}

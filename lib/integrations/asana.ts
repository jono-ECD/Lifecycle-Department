// Asana REST API over plain fetch. Token is agency level (ASANA_ACCESS_TOKEN); project is per workspace.
import { contextLine, headline, type EventPayload } from './types';

const API = 'https://app.asana.com/api/1.0';

export class AsanaClient {
  constructor(
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify({ data: body }) : undefined,
    });
    if (!r.ok) throw new Error(`Asana ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}`);
    return ((await r.json()) as { data: T }).data;
  }

  async createTask(input: { projectGid: string; sectionGid?: string | null; name: string; notes: string; assigneeEmail?: string | null }): Promise<{ gid: string; permalink_url?: string }> {
    const data: Record<string, unknown> = { name: input.name, notes: input.notes, projects: [input.projectGid] };
    if (input.sectionGid) data.memberships = [{ project: input.projectGid, section: input.sectionGid }];
    if (input.assigneeEmail) data.assignee = input.assigneeEmail;
    return this.call('POST', '/tasks', data);
  }

  async addComment(taskGid: string, text: string): Promise<{ gid: string }> {
    return this.call('POST', `/tasks/${taskGid}/stories`, { text });
  }

  async setCompleted(taskGid: string, completed: boolean): Promise<{ gid: string }> {
    return this.call('PUT', `/tasks/${taskGid}`, { completed });
  }

  async attach(taskGid: string, file: Buffer, name: string, contentType: string): Promise<{ gid: string }> {
    const form = new FormData();
    form.set('parent', taskGid);
    form.set('file', new Blob([new Uint8Array(file)], { type: contentType }), name);
    const r = await this.fetchImpl(`${API}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: form });
    if (!r.ok) throw new Error(`Asana attachment ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}`);
    return ((await r.json()) as { data: { gid: string } }).data;
  }

  async me(): Promise<{ gid: string; name: string }> {
    return this.call('GET', '/users/me');
  }

  async project(gid: string): Promise<{ gid: string; name: string }> {
    return this.call('GET', `/projects/${gid}`);
  }
}

/** Task name and notes. The client's words come first and verbatim; context follows in plain lines. */
export function buildAsanaTask(p: EventPayload): { name: string; notes: string } {
  const kind = p.type === 'change_request' ? 'Change request' : p.type === 'pin_created' ? `Note ${p.pin?.number ?? ''}`.trim() : 'Note';
  const em = p.em && p.em.count > 1 ? ` (EM${p.em.index})` : '';
  const name = `${kind}: ${p.campaign.name}${em} · ${p.workspace.name}`;
  const lines = [`${p.actor.name} wrote:`, `"${(p.text ?? '').trim()}"`, ''];
  lines.push(`Campaign: ${p.campaign.name}${p.campaign.subtitle ? `, ${p.campaign.subtitle}` : ''}`);
  lines.push(`Client: ${p.workspace.name}`);
  if (p.em) lines.push(`Email: EM${p.em.index} of ${p.em.count}${p.campaign.version ? `, version ${p.campaign.version}` : ''}`);
  else if (p.campaign.version) lines.push(`Version: ${p.campaign.version}`);
  if (p.pin) lines.push(`Where: ${p.pin.position} of the design, note ${p.pin.number}`);
  lines.push(`Status now: ${p.campaign.status}`);
  lines.push('');
  lines.push(`Open in the bank: ${p.links.admin}`);
  if (p.pin?.cropUrl) lines.push(`Crop of the area: ${p.pin.cropUrl}`);
  return { name, notes: lines.join('\n') };
}

export function buildAsanaReply(p: EventPayload): string {
  return `${headline(p)}\n"${(p.text ?? '').trim()}"\n${contextLine(p)}\n${p.links.admin}`;
}

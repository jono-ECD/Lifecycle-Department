// Slack incoming webhook. One webhook per client workspace, set in the admin Integrations page.
import { ACTIONABLE, contextLine, headline, type EventPayload } from './types';

type Block = Record<string, unknown>;

export interface SlackMessage {
  text: string;
  blocks: Block[];
}

const quote = (s: string) =>
  s
    .trim()
    .split(/\r?\n/)
    .map((l) => `>${l}`)
    .join('\n');

/** Builds the message. Actionable events get the client's words verbatim, context and the crop. */
export function buildSlackMessage(p: EventPayload): SlackMessage {
  const title = headline(p);
  const blocks: Block[] = [];
  if (ACTIONABLE.includes(p.type)) {
    blocks.push({ type: 'header', text: { type: 'plain_text', text: title, emoji: false } });
    if (p.text) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: quote(p.text) } });
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: contextLine(p) }] });
    if (p.pin?.cropUrl && p.pin.cropUrl.startsWith('https://')) {
      blocks.push({ type: 'image', image_url: p.pin.cropUrl, alt_text: `Note ${p.pin.number}, ${p.pin.position}` });
    }
  } else {
    const extra = p.text ? `\n${quote(p.text)}` : '';
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `${title} · ${p.workspace.name}${extra}` } });
  }
  blocks.push({
    type: 'actions',
    elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in the bank', emoji: false }, url: p.links.admin }],
  });
  return { text: `${title}${p.text ? `: ${p.text}` : ''}`, blocks };
}

export async function postSlack(webhookUrl: string, message: SlackMessage, fetchImpl: typeof fetch = fetch): Promise<void> {
  const r = await fetchImpl(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
  if (!r.ok) throw new Error(`Slack ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

export function isSlackWebhook(url: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+$/.test(url.trim());
}

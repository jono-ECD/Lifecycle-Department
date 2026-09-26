// Generic signed webhook per workspace, for Zapier, Make, n8n or anything else.
import { createHmac } from 'node:crypto';
import type { EventPayload } from './types';

export function signBody(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export async function postWebhook(url: string, secret: string | null, eventId: string, payload: EventPayload, fetchImpl: typeof fetch = fetch): Promise<void> {
  const body = JSON.stringify({ id: eventId, ...payload });
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Bank-Event': payload.type, 'X-Bank-Delivery': eventId };
  if (secret) headers['X-Bank-Signature'] = signBody(secret, body);
  const r = await fetchImpl(url, { method: 'POST', headers, body });
  if (!r.ok) throw new Error(`Webhook ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

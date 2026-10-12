import type { Mail, Transport } from './index';

/** Resend over plain fetch. No SDK needed. */
export class ResendTransport implements Transport {
  name = 'resend';
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async send(mail: Mail & { from: string }): Promise<{ id: string | null }> {
    const r = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: mail.from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Resend failed: ${r.status} ${body.slice(0, 200)}`);
    }
    const j = (await r.json().catch(() => ({}))) as { id?: string };
    return { id: j.id ?? null };
  }
}

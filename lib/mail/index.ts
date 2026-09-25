// Mail transport behind one interface. Resend when RESEND_API_KEY is set, otherwise the console.
// Every send writes NotificationLog rows, one per recipient, so the app is debuggable without a mailbox.
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { ConsoleTransport } from './console';
import { ResendTransport } from './resend';

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface Transport {
  name: string;
  send(mail: Mail & { from: string }): Promise<{ id: string | null }>;
}

export interface LogMeta {
  type: string;
  workspaceId?: string | null;
  campaignId?: string | null;
  /** Per recipient dedup key prefix. The recipient is appended. Existing keys skip the send. */
  dedupKey?: string;
}

let transport: Transport | null = null;

export function getTransport(): Transport {
  if (transport) return transport;
  const key = env('RESEND_API_KEY');
  transport = key ? new ResendTransport(key) : new ConsoleTransport();
  return transport;
}

/** For tests. */
export function setTransport(t: Transport | null) {
  transport = t;
}

export async function sendMail(mail: Mail, meta: LogMeta): Promise<{ sent: number; skipped: number }> {
  const from = env('MAIL_FROM', 'bank@ecdigitalstrategy.com');
  const recipients: string[] = [];
  let skipped = 0;
  for (const to of Array.from(new Set(mail.to.map((t) => t.trim().toLowerCase()).filter(Boolean)))) {
    if (meta.dedupKey) {
      const key = `${meta.dedupKey}:${to}`;
      const exists = await db.notificationLog.findUnique({ where: { dedupKey: key } });
      if (exists) {
        skipped++;
        continue;
      }
    }
    recipients.push(to);
  }
  if (recipients.length === 0) return { sent: 0, skipped };
  const res = await getTransport().send({ ...mail, to: recipients, from });
  for (const to of recipients) {
    await db.notificationLog.create({
      data: {
        type: meta.type,
        recipient: to,
        workspaceId: meta.workspaceId ?? null,
        campaignId: meta.campaignId ?? null,
        subject: mail.subject,
        providerId: res.id,
        dedupKey: meta.dedupKey ? `${meta.dedupKey}:${to}` : null,
      },
    });
  }
  return { sent: recipients.length, skipped };
}

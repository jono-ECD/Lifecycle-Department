import type { Mail, Transport } from './index';

/** Prints the rendered email to the console. Used when RESEND_API_KEY is missing. */
export class ConsoleTransport implements Transport {
  name = 'console';
  async send(mail: Mail & { from: string }): Promise<{ id: string | null }> {
    const line = '-'.repeat(60);
    console.log(`\n${line}\n[mail] From: ${mail.from}\n[mail] To: ${mail.to.join(', ')}\n[mail] Subject: ${mail.subject}\n${line}\n${mail.text}\n${line}\n`);
    return { id: null };
  }
}

import QRCode from 'qrcode';
import { z } from 'zod';
import { handler, json, parseBody, requireAdminActor } from '@/lib/api';

const Body = z.object({ text: z.string().min(1).max(2000) });

// QR code for a reviewer link, so the client can open it on a phone.
export const POST = handler(async (req) => {
  await requireAdminActor();
  const { text } = await parseBody(req, Body);
  const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 264, color: { dark: '#1b1a17', light: '#ffffff' } });
  return json({ dataUrl });
});

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { hashToken, newToken } from '@/lib/tokens';
import { reviewerLink } from '@/lib/reviewers';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('revoke') }),
  z.object({ op: z.literal('regenerate') }),
  z.object({ op: z.literal('set_pin'), pin: z.string().regex(/^\d{4}$/, 'The PIN is 4 digits.') }),
  z.object({ op: z.literal('clear_pin') }),
]);

// Revoke a link, issue a new one, or manage the optional PIN.
export const POST = handler(async (req, ctx: Ctx) => {
  await requireAdminActor();
  const { id } = await ctx.params;
  const body = await parseBody(req, Body);
  const r = await db.reviewer.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, 'Reviewer not found.');
  switch (body.op) {
    case 'revoke':
      await db.reviewer.update({ where: { id }, data: { revokedAt: new Date() } });
      return json({ ok: true });
    case 'regenerate': {
      const token = newToken();
      await db.reviewer.update({ where: { id }, data: { tokenHash: hashToken(token), revokedAt: null } });
      return json({ link: reviewerLink(token) });
    }
    case 'set_pin':
      await db.reviewer.update({ where: { id }, data: { pinHash: await bcrypt.hash(body.pin, 10) } });
      return json({ ok: true });
    case 'clear_pin':
      await db.reviewer.update({ where: { id }, data: { pinHash: null } });
      return json({ ok: true });
  }
});

import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { hashToken, newToken } from '@/lib/tokens';
import { reviewerLink } from '@/lib/reviewers';

const Body = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, 'Add the reviewer name.').max(120),
  email: z.string().trim().email('Add a valid email.').max(200),
  canApprove: z.boolean().default(true),
});

// Create a reviewer and return their personal link. The link is shown once; only its hash is stored.
export const POST = handler(async (req) => {
  await requireAdminActor();
  const input = await parseBody(req, Body);
  const ws = await db.workspace.findUnique({ where: { id: input.workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const token = newToken();
  const r = await db.reviewer.create({ data: { workspaceId: ws.id, name: input.name, email: input.email.toLowerCase(), tokenHash: hashToken(token), canApprove: input.canApprove } });
  return json({ id: r.id, link: reviewerLink(token) });
});

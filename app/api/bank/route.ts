import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseWith, requireActor } from '@/lib/api';
import { actorCanAccess } from '@/lib/auth';
import { loadBank } from '@/lib/bank';

const Query = z.object({ workspace: z.string().min(1).max(64).optional() });

// Bank payload for polling. Reviewers get their own workspace; admins pass ?workspace=<id>.
export const GET = handler(async (req) => {
  const actor = await requireActor();
  const q = parseWith(Query, Object.fromEntries(new URL(req.url).searchParams));
  const workspaceId = actor.role === 'reviewer' ? actor.reviewer.workspaceId : q.workspace;
  if (!workspaceId) throw new ApiError(400, 'workspace is required.');
  if (!actorCanAccess(actor, workspaceId)) throw new ApiError(403, 'Not your workspace.');
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  return json(await loadBank(ws, actor));
});

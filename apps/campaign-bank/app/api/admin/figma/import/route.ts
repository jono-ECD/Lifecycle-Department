import { z } from 'zod';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { importFrames } from '@/lib/figmaImport';
import { applyAdminStatus } from '@/lib/admin';
import { TYPE_KEYS } from '@/lib/status';

const Body = z.object({
  workspaceId: z.string().min(1),
  fileKey: z.string().regex(/^[A-Za-z0-9]{10,}$/),
  status: z.enum(['draft', 'review']).default('draft'),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Give every campaign a name.').max(200),
        subtitle: z.string().trim().max(300).optional(),
        type: z.enum(TYPE_KEYS as [string, ...string[]]).default('promo'),
        nodeIds: z.array(z.string().regex(/^[0-9A-Za-z:;-]+$/)).min(1).max(12),
      }),
    )
    .min(1, 'Pick at least one frame.')
    .max(20, 'Import up to 20 campaigns at a time.'),
});

// Imports the picked frames as campaigns. Each gets its design as version 1.
export const POST = handler(async (req) => {
  const actor = await requireAdminActor();
  const input = await parseBody(req, Body);
  try {
    const created = await importFrames(input.workspaceId, input.fileKey, input.items, actor);
    if (input.status === 'review') for (const c of created) await applyAdminStatus(c.id, actor, 'review', undefined);
    return json({ created });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, (err as Error).message);
  }
});

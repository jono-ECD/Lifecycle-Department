import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { env } from '@/lib/env';
import { FigmaClient, fileKeyFrom } from '@/lib/integrations/figma';

const Body = z.object({ workspaceId: z.string().min(1), file: z.string().trim().max(500).default('') });

// Lists the pages and frames of a Figma file with thumbnails, for the import picker.
export const POST = handler(async (req) => {
  await requireAdminActor();
  const { workspaceId, file } = await parseBody(req, Body);
  const token = env('FIGMA_ACCESS_TOKEN');
  if (!token) throw new ApiError(400, 'Add FIGMA_ACCESS_TOKEN to the environment to browse Figma files.');
  const cfg = await db.workspaceIntegration.findUnique({ where: { workspaceId } });
  const fileKey = file ? fileKeyFrom(file) : cfg?.figmaFileKey;
  if (!fileKey) throw new ApiError(400, file ? 'That does not look like a Figma link.' : 'Paste a Figma file link.');
  try {
    const res = await new FigmaClient(token).pages(fileKey);
    const imported = await db.campaign.findMany({ where: { workspaceId, figmaFileKey: fileKey }, select: { id: true, name: true, figmaNodeIds: true } });
    const taken = new Map<string, string>();
    for (const c of imported) for (const n of (c.figmaNodeIds ?? '').split(',').filter(Boolean)) taken.set(n, c.name);
    return json({ fileKey, fileName: res.name, pages: res.pages.map((p) => ({ ...p, frames: p.frames.map((f) => ({ ...f, importedAs: taken.get(f.id) ?? null })) })) });
  } catch (err) {
    throw new ApiError(400, (err as Error).message);
  }
});

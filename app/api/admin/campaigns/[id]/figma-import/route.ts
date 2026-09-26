import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { env } from '@/lib/env';
import { addVersion } from '@/lib/admin';
import { FigmaClient, parseFigmaUrl } from '@/lib/integrations/figma';

const Body = z.object({ url: z.string().trim().min(1, 'Paste the Figma link to the frame.').max(500) });

// Pulls a frame from Figma as PNG and stores it as the next version. Needs FIGMA_ACCESS_TOKEN.
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireAdminActor();
  const { id } = await ctx.params;
  const { url } = await parseBody(req, Body);
  const token = env('FIGMA_ACCESS_TOKEN');
  if (!token) throw new ApiError(400, 'Add FIGMA_ACCESS_TOKEN to the environment to pull frames from Figma.');
  const ref = parseFigmaUrl(url);
  if (!ref) throw new ApiError(400, 'That does not look like a Figma link.');
  if (!ref.nodeId) throw new ApiError(400, 'Select the frame in Figma and copy its link, so the link includes node-id.');
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  const png = await new FigmaClient(token).nodeImage(ref.fileKey, ref.nodeId);
  const { version } = await addVersion(id, [{ name: `figma-${ref.nodeId.replace(':', '-')}.png`, type: 'image/png', buffer: png }], actor);
  await db.campaign.update({ where: { id }, data: { figmaUrl: url, figmaNodeId: ref.nodeId } });
  return json({ version });
});

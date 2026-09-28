import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handler, json, parseBody, requireAdminActor } from '@/lib/api';
import { parseFigmaUrl } from '@/lib/integrations/figma';
import { refreshFromFigma } from '@/lib/figmaImport';

const Body = z.object({ url: z.string().trim().max(500).default('') });

// Pulls the campaign's Figma frames as the next version. A link in the body replaces the stored frame.
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireAdminActor();
  const { id } = await ctx.params;
  const { url } = await parseBody(req, Body);
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  if (url && url !== c.figmaUrl) {
    const ref = parseFigmaUrl(url);
    if (!ref) throw new ApiError(400, 'That does not look like a Figma link.');
    if (!ref.nodeId) throw new ApiError(400, 'Select the frame in Figma and copy its link, so the link includes node-id.');
    await db.campaign.update({ where: { id }, data: { figmaUrl: url, figmaFileKey: ref.fileKey, figmaNodeId: ref.nodeId, figmaNodeIds: ref.nodeId } });
  } else if (!c.figmaFileKey && c.figmaUrl) {
    const ref = parseFigmaUrl(c.figmaUrl);
    if (ref?.nodeId) await db.campaign.update({ where: { id }, data: { figmaFileKey: ref.fileKey, figmaNodeId: ref.nodeId, figmaNodeIds: ref.nodeId } });
  }
  try {
    return json(await refreshFromFigma(id, actor));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, (err as Error).message);
  }
});

// Turns Figma frames into campaigns and versions. Shared by the import screen and "Pull from Figma".
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { env } from '@/lib/env';
import type { Actor } from '@/lib/auth';
import { addVersion } from '@/lib/admin';
import { todayYmd, ymdToDate } from '@/lib/dates';
import { FigmaClient, frameUrl } from '@/lib/integrations/figma';
import type { IncomingFile } from '@/lib/uploads';

function client(): FigmaClient {
  const token = env('FIGMA_ACCESS_TOKEN');
  if (!token) throw new ApiError(400, 'Add FIGMA_ACCESS_TOKEN to the environment to pull frames from Figma.');
  return new FigmaClient(token);
}

/** Downloads frames at 2x, in the order given. */
export async function renderFrames(fileKey: string, nodeIds: string[]): Promise<IncomingFile[]> {
  const figma = client();
  const urls = await figma.imageUrls(fileKey, nodeIds, 2);
  const files: IncomingFile[] = [];
  for (let i = 0; i < nodeIds.length; i++) {
    const url = urls[nodeIds[i]];
    if (!url) throw new ApiError(400, 'Figma did not return an image for one of the frames. It may be empty or hidden.');
    files.push({ name: `figma-${nodeIds[i].replace(/[:;]/g, '-')}.png`, type: 'image/png', buffer: await figma.download(url) });
  }
  return files;
}

export interface ImportItem {
  name: string;
  subtitle?: string;
  type: string;
  nodeIds: string[];
}

/** Creates one campaign per item. Several frames in one item become EM1, EM2 and so on. */
export async function importFrames(workspaceId: string, fileKey: string, items: ImportItem[], actor: Actor): Promise<{ id: string; name: string }[]> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new ApiError(404, 'Workspace not found.');
  const created: { id: string; name: string }[] = [];
  const last = await db.campaign.aggregate({ where: { workspaceId }, _max: { position: true } });
  let position = (last._max.position ?? 0) + 1;
  for (const item of items) {
    const files = await renderFrames(fileKey, item.nodeIds);
    const c = await db.campaign.create({
      data: {
        workspaceId,
        name: item.name,
        subtitle: item.subtitle ?? '',
        type: item.type,
        status: 'draft',
        builtDate: ymdToDate(todayYmd(ws.timezone)),
        position: position++,
        createdBy: actor.name,
        figmaFileKey: fileKey,
        figmaNodeIds: item.nodeIds.join(','),
        figmaNodeId: item.nodeIds[0],
        figmaUrl: frameUrl(fileKey, item.nodeIds[0]),
      },
    });
    await addVersion(c.id, files, actor);
    created.push({ id: c.id, name: c.name });
  }
  return created;
}

/** Pulls the campaign's frames again as the next version. */
export async function refreshFromFigma(campaignId: string, actor: Actor): Promise<{ version: number }> {
  const c = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!c) throw new ApiError(404, 'That campaign is not here.');
  const nodeIds = (c.figmaNodeIds ?? c.figmaNodeId ?? '').split(',').filter(Boolean);
  if (!c.figmaFileKey || nodeIds.length === 0) throw new ApiError(400, 'This campaign has no Figma frames yet. Add the Figma link first.');
  const files = await renderFrames(c.figmaFileKey, nodeIds);
  const { version } = await addVersion(c.id, files, actor);
  return { version };
}

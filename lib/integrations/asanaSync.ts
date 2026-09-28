// Asana inbound. Asana owns that a campaign exists, its name, its planned date and its production
// stage. The Bank reads them on a schedule and never writes them, except Stage for a client decision.
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { todayYmd, ymdToDate, isYmd } from '@/lib/dates';
import { hashOf } from '@/lib/uploads';
import { addVersion, applyAdminStatus } from '@/lib/admin';
import { AsanaClient, channelOf, parseStageMap, parseTaskNotes, type AsanaTask } from './asana';
import { parseFigmaUrl } from './figma';
import { systemActor } from './payload';
import { renderFrames } from '@/lib/figmaImport';

export const ASANA_EVERY_MS = 5 * 60 * 1000;

export interface PullResult {
  seen: number;
  created: number;
  updated: number;
  moved: number;
  problems: number;
}

/** Problems are shown to ECD in Connections. One row per distinct problem, never repeated. */
async function problem(workspaceId: string, campaignId: string | null, key: string, message: string) {
  const dedupKey = `sync:${workspaceId}:${hashOf(key).slice(0, 24)}`;
  const existing = await db.integrationEvent.findFirst({ where: { dedupKey } });
  if (existing) {
    if (existing.status !== 'failed') await db.integrationEvent.update({ where: { id: existing.id }, data: { status: 'failed', error: message, sentAt: new Date() } });
    return;
  }
  await db.integrationEvent.create({ data: { workspaceId, campaignId, type: 'sync_error', target: 'asana', status: 'failed', payload: '{}', error: message, dedupKey, sentAt: new Date() } });
}

async function clearProblems(workspaceId: string, campaignId: string) {
  await db.integrationEvent.updateMany({ where: { workspaceId, campaignId, type: 'sync_error', status: 'failed' }, data: { status: 'sent', result: 'fixed' } });
}

export async function pullAsana(workspaceId: string, fetchImpl: typeof fetch = fetch): Promise<PullResult> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { integration: true } });
  const cfg = ws?.integration;
  const token = env('ASANA_ACCESS_TOKEN');
  if (!ws || !cfg?.asanaProjectGid) throw new Error('Save the Asana project first.');
  if (!token) throw new Error('ASANA_ACCESS_TOKEN is not set in the environment.');
  const asana = new AsanaClient(token, fetchImpl);
  const map = parseStageMap(cfg.asanaStageMap);
  const started = new Date();
  const result: PullResult = { seen: 0, created: 0, updated: 0, moved: 0, problems: 0 };
  const actor = systemActor('Asana');

  try {
    const tasks = await asana.tasks({ projectGid: cfg.asanaProjectGid, sectionGid: cfg.asanaSectionGid, modifiedSince: cfg.asanaPullSince });
    for (const task of tasks) {
      const channel = channelOf(task);
      if (!channel) continue;
      result.seen++;
      const parsed = parseTaskNotes(task.notes);
      const stage = cfg.asanaStageFieldGid ? task.fields.find((f) => f.gid === cfg.asanaStageFieldGid) : undefined;
      const figma = parsed.figmaUrl ? parseFigmaUrl(parsed.figmaUrl) : null;
      const owned = {
        name: task.name,
        channel,
        asanaUrl: task.url,
        plannedDate: task.dueOn && isYmd(task.dueOn) ? ymdToDate(task.dueOn) : null,
        asanaStageGid: stage?.optionGid ?? null,
        asanaStageName: stage?.optionName ?? null,
        ...(parsed.figmaUrl && figma?.nodeId ? { figmaUrl: parsed.figmaUrl, figmaFileKey: figma.fileKey, figmaNodeId: figma.nodeId } : {}),
        ...(parsed.klaviyoCampaignId ? { klaviyoCampaignId: parsed.klaviyoCampaignId } : {}),
      };

      let c = await db.campaign.findFirst({ where: { workspaceId, asanaTaskGid: task.gid } });
      if (!c) {
        const last = await db.campaign.aggregate({ where: { workspaceId }, _max: { position: true } });
        c = await db.campaign.create({
          data: { workspaceId, asanaTaskGid: task.gid, status: 'draft', builtDate: ymdToDate(todayYmd(ws.timezone)), position: (last._max.position ?? 0) + 1, createdBy: 'Asana', ...owned, ...(figma?.nodeId ? { figmaNodeIds: figma.nodeId } : {}) },
        });
        result.created++;
      } else {
        // a frame link that changed in the task replaces the stored frames
        const frameChanged = figma?.nodeId && c.figmaNodeId !== figma.nodeId;
        c = await db.campaign.update({ where: { id: c.id }, data: { ...owned, ...(frameChanged ? { figmaNodeIds: figma!.nodeId } : {}) } });
        result.updated++;
      }

      await clearProblems(workspaceId, c.id);
      // SMS has no frame, so a missing Design line is not a problem there
      for (const msg of parsed.problems) {
        if (channel === 'sms' && /Design/.test(msg)) continue;
        await problem(workspaceId, c.id, `${task.gid}:${msg}`, `${task.name}: ${msg}`);
        result.problems++;
      }

      const option = stage?.optionGid ?? null;
      if (cfg.asanaStageFieldGid && !stage) {
        await problem(workspaceId, c.id, `${task.gid}:nostage`, `${task.name}: the task does not have the Stage field the Bank is bound to.`);
        result.problems++;
        continue;
      }
      if (!option) continue;
      // The Bank wrote this value itself. Seeing it again is an echo, not a decision by ECD.
      if (option === c.asanaStageWrote) continue;
      if (c.asanaStageWrote) c = await db.campaign.update({ where: { id: c.id }, data: { asanaStageWrote: null } });

      const known = Object.values(map).includes(option);
      if (!known && Object.keys(map).length > 0 && stage?.optionName && /review|scheduled|done|sent/i.test(stage.optionName)) {
        await problem(workspaceId, c.id, `${task.gid}:unmapped:${option}`, `${task.name}: Stage "${stage.optionName}" is not mapped. The Bank left the status alone instead of guessing.`);
        result.problems++;
      }

      if (option === map.review && ['draft', 'changes'].includes(c.status)) {
        if (channel === 'email' && c.figmaFileKey && c.figmaNodeIds && env('FIGMA_ACCESS_TOKEN')) {
          try {
            const files = await renderFrames(c.figmaFileKey, c.figmaNodeIds.split(',').filter(Boolean));
            await addVersion(c.id, { files }, actor, { skipUnchanged: true, source: 'Figma' });
          } catch (err) {
            await problem(workspaceId, c.id, `${task.gid}:figma`, `${task.name}: the Figma frame could not be rendered. ${(err as Error).message}`);
            result.problems++;
          }
        }
        if (channel === 'sms') {
          if (parsed.smsText) await addVersion(c.id, { smsText: parsed.smsText }, actor, { skipUnchanged: true, source: 'Asana' });
          else {
            await problem(workspaceId, c.id, `${task.gid}:nocopy`, `${task.name}: it is an SMS in Client Review but the task notes have no "Copy:" line.`);
            result.problems++;
          }
        }
        const fresh = await db.campaign.findUniqueOrThrow({ where: { id: c.id } });
        if (fresh.currentVersion === 0) {
          await problem(workspaceId, c.id, `${task.gid}:nodesign`, `${task.name}: it is in Client Review in Asana but has no design in the Bank yet.`);
          result.problems++;
        } else if (fresh.status !== 'review') {
          await applyAdminStatus(c.id, actor, 'review', undefined);
          result.moved++;
        }
      } else if (option === map.scheduled && ['approved', 'requested'].includes(c.status)) {
        const date = c.scheduledDate ?? c.plannedDate;
        if (!date) {
          await problem(workspaceId, c.id, `${task.gid}:nodate`, `${task.name}: it is Scheduled in Asana but has no date. Add a due date to the task.`);
          result.problems++;
        } else {
          await db.$transaction([
            db.campaign.update({ where: { id: c.id }, data: { status: 'scheduled', scheduledDate: date, lastActivityAt: new Date() } }),
            db.comment.create({ data: { campaignId: c.id, authorKind: 'admin', authorName: 'Asana', kind: 'status', fromStatus: c.status, toStatus: 'scheduled', body: 'Scheduled in Klaviyo.' } }),
          ]);
          result.moved++;
        }
      } else if (option === map.sent && !['sent', 'draft'].includes(c.status)) {
        await db.$transaction([
          db.campaign.update({ where: { id: c.id }, data: { status: 'sent', sentDate: new Date(), lastActivityAt: new Date() } }),
          db.comment.create({ data: { campaignId: c.id, authorKind: 'admin', authorName: 'Asana', kind: 'status', fromStatus: c.status, toStatus: 'sent', body: 'Sent.' } }),
        ]);
        result.moved++;
      }
    }
    // Polling heals itself: the cursor only moves after a full, successful pass.
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { asanaPulledAt: started, asanaPullSince: new Date(started.getTime() - 60_000), asanaPullError: null } });
    return result;
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await db.workspaceIntegration.update({ where: { workspaceId }, data: { asanaPulledAt: started, asanaPullError: message } });
    throw new Error(message);
  }
}

export type { AsanaTask };

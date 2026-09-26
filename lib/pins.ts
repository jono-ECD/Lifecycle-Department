// Pinned notes on a design. Create, reply, resolve, delete, plus the crop that travels to Slack, Asana and email.
import sharp from 'sharp';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { actorCanAccess, type Actor } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { assetUrl } from '@/lib/uploads';
import { env } from '@/lib/env';
import { cropBox, describePosition } from '@/lib/integrations/describe';
import { emit } from '@/lib/integrations/dispatch';
import { payloadFor } from '@/lib/integrations/payload';
import { notifyPin } from '@/lib/notify/events';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface PinInput {
  assetId: string;
  x: number;
  y: number;
  w?: number | null;
  h?: number | null;
  body: string;
}

async function loadCampaign(campaignId: string, actor: Actor) {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, include: { workspace: true, assets: true } });
  if (!c || !actorCanAccess(actor, c.workspaceId)) throw new ApiError(404, 'That campaign is not here.');
  return c;
}

function emOf(assets: { id: string; version: number; orderIndex: number }[], assetId: string, version: number) {
  const current = assets.filter((a) => a.version === version).sort((a, b) => a.orderIndex - b.orderIndex);
  const idx = current.findIndex((a) => a.id === assetId);
  return { index: idx + 1, count: current.length };
}

function absolute(path: string | null): string | null {
  const u = assetUrl(path);
  if (!u) return null;
  return u.startsWith('http') ? u : `${env('APP_URL', 'http://localhost:3000').replace(/\/$/, '')}${u}`;
}

/** Crops the marked area (or a window around the pin) and draws the marker on it. */
async function makeCrop(assetPath: string, threadId: string, campaignId: string, number: number, x: number, y: number, w: number | null, h: number | null): Promise<string | null> {
  try {
    const src = await getStorage().getObject(assetPath);
    if (!src) return null;
    const img = sharp(src, { failOn: 'none' });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    const aspect = meta.width / meta.height;
    const box = cropBox(x, y, w, h, aspect);
    const left = Math.round(box.x * meta.width);
    const top = Math.round(box.y * meta.height);
    const width = Math.max(8, Math.round(box.w * meta.width));
    const height = Math.max(8, Math.round(box.h * meta.height));
    // marker drawn in crop coordinates
    const px = (x - box.x) / box.w;
    const py = (y - box.y) / box.h;
    const r = Math.max(12, Math.round(width * 0.04));
    const marker =
      w && h
        ? `<rect x="${((x - box.x) / box.w) * 1000}" y="${((y - box.y) / box.h) * 1000}" width="${(w / box.w) * 1000}" height="${(h / box.h) * 1000}" fill="none" stroke="#5b4fe9" stroke-width="10" rx="8"/>`
        : `<circle cx="${px * 1000}" cy="${py * 1000}" r="${(r / width) * 1000}" fill="#5b4fe9" stroke="#ffffff" stroke-width="6"/><text x="${px * 1000}" y="${py * 1000 + (r / width) * 400}" font-size="${(r / width) * 1100}" text-anchor="middle" fill="#ffffff" font-family="Helvetica,Arial,sans-serif" font-weight="700">${number}</text>`;
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" width="${width}" height="${height}">${marker}</svg>`);
    const out = await sharp(src, { failOn: 'none' })
      .extract({ left, top, width: Math.min(width, meta.width - left), height: Math.min(height, meta.height - top) })
      .composite([{ input: await sharp(svg).resize(Math.min(width, meta.width - left), Math.min(height, meta.height - top), { fit: 'fill' }).png().toBuffer() }])
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const key = `campaigns/${campaignId}/pins/${threadId}.jpg`;
    await getStorage().putObject(key, out, 'image/jpeg');
    return key;
  } catch (err) {
    console.warn('[pins] crop failed:', (err as Error).message);
    return null;
  }
}

export async function createPin(campaignId: string, actor: Actor, input: PinInput) {
  const c = await loadCampaign(campaignId, actor);
  const asset = c.assets.find((a) => a.id === input.assetId);
  if (!asset || asset.kind !== 'image') throw new ApiError(400, 'Notes can be pinned on images only.');
  const body = input.body.trim();
  if (!body) throw new ApiError(400, 'Write the note first.');
  const x = clamp01(input.x);
  const y = clamp01(input.y);
  const hasArea = input.w != null && input.h != null && input.w > 0.01 && input.h > 0.01;
  const w = hasArea ? clamp01(Math.min(input.w!, 1 - x)) : null;
  const h = hasArea ? clamp01(Math.min(input.h!, 1 - y)) : null;
  const last = await db.pinThread.aggregate({ where: { campaignId }, _max: { number: true } });
  const number = (last._max.number ?? 0) + 1;
  const thread = await db.pinThread.create({
    data: { campaignId, assetId: asset.id, version: asset.version, number, x, y, w, h, authorKind: actor.role, authorName: actor.name, authorId: actor.id, comments: { create: { authorKind: actor.role, authorName: actor.name, authorId: actor.id, body } } },
  });
  const cropPath = await makeCrop(asset.path, thread.id, campaignId, number, x, y, w, h);
  if (cropPath) await db.pinThread.update({ where: { id: thread.id }, data: { cropPath } });
  const em = emOf(c.assets, asset.id, asset.version);
  await db.$transaction([
    db.comment.create({ data: { campaignId, authorKind: actor.role, authorName: actor.name, authorId: actor.id, body, kind: 'pin', pinNumber: number } }),
    db.campaign.update({ where: { id: campaignId }, data: { lastActivityAt: new Date() } }),
  ]);
  const position = describePosition(x, y, w, h);
  const pin = { threadId: thread.id, number, position, cropUrl: absolute(cropPath), x, y, w, h };
  const payload = await payloadFor(campaignId, actor, 'pin_created', { text: body, pin, em });
  if (payload) {
    await emit(payload);
    if (actor.role === 'reviewer') await notifyPin(payload);
  }
  return thread;
}

export async function replyPin(threadId: string, actor: Actor, body: string) {
  const t = await db.pinThread.findUnique({ where: { id: threadId }, include: { campaign: { include: { assets: true } } } });
  if (!t || !actorCanAccess(actor, t.campaign.workspaceId)) throw new ApiError(404, 'That note is not here.');
  const text = body.trim();
  if (!text) throw new ApiError(400, 'Write the reply first.');
  await db.pinComment.create({ data: { threadId, authorKind: actor.role, authorName: actor.name, authorId: actor.id, body: text } });
  await db.campaign.update({ where: { id: t.campaignId }, data: { lastActivityAt: new Date() } });
  const pin = { threadId: t.id, number: t.number, position: describePosition(t.x, t.y, t.w, t.h), cropUrl: absolute(t.cropPath), x: t.x, y: t.y, w: t.w, h: t.h };
  const payload = await payloadFor(t.campaignId, actor, 'pin_reply', { text, pin, em: emOf(t.campaign.assets, t.assetId, t.version) });
  if (payload) {
    await emit(payload);
    if (actor.role === 'reviewer') await notifyPin(payload);
  }
  return { campaignId: t.campaignId };
}

/** ECD only. Marks a note done or reopens it. */
export async function resolvePin(threadId: string, actor: Actor, resolved: boolean) {
  if (actor.role !== 'admin') throw new ApiError(403, 'Only ECD can mark a note as done.');
  const t = await db.pinThread.findUnique({ where: { id: threadId }, include: { campaign: { include: { assets: true } } } });
  if (!t) throw new ApiError(404, 'That note is not here.');
  await db.pinThread.update({ where: { id: threadId }, data: { status: resolved ? 'resolved' : 'open', resolvedBy: resolved ? actor.name : null, resolvedAt: resolved ? new Date() : null } });
  await db.comment.create({
    data: { campaignId: t.campaignId, authorKind: actor.role, authorName: actor.name, authorId: actor.id, body: resolved ? `Note ${t.number} is done.` : `Note ${t.number} reopened.`, kind: 'system', pinNumber: t.number },
  });
  const pin = { threadId: t.id, number: t.number, position: describePosition(t.x, t.y, t.w, t.h), cropUrl: absolute(t.cropPath), x: t.x, y: t.y, w: t.w, h: t.h };
  const payload = await payloadFor(t.campaignId, actor, resolved ? 'pin_resolved' : 'pin_reopened', { pin, em: emOf(t.campaign.assets, t.assetId, t.version) });
  if (payload) await emit(payload);
  return { campaignId: t.campaignId };
}

/** Admins can delete any note. The author can delete their own while nobody has replied. */
export async function deletePin(threadId: string, actor: Actor) {
  const t = await db.pinThread.findUnique({ where: { id: threadId }, include: { comments: true, campaign: true } });
  if (!t || !actorCanAccess(actor, t.campaign.workspaceId)) throw new ApiError(404, 'That note is not here.');
  const own = t.authorKind === actor.role && t.authorId === actor.id;
  if (actor.role !== 'admin' && !(own && t.comments.length <= 1)) throw new ApiError(403, 'This note has replies. Ask ECD to remove it.');
  if (t.cropPath) await getStorage().delete(t.cropPath).catch(() => {});
  await db.pinThread.delete({ where: { id: threadId } });
  return { campaignId: t.campaignId };
}

export async function movePin(threadId: string, actor: Actor, x: number, y: number) {
  const t = await db.pinThread.findUnique({ where: { id: threadId }, include: { campaign: true } });
  if (!t || !actorCanAccess(actor, t.campaign.workspaceId)) throw new ApiError(404, 'That note is not here.');
  const own = t.authorKind === actor.role && t.authorId === actor.id;
  if (actor.role !== 'admin' && !own) throw new ApiError(403, 'Only the author or ECD can move a note.');
  await db.pinThread.update({ where: { id: threadId }, data: { x: clamp01(x), y: clamp01(y) } });
  return { campaignId: t.campaignId };
}

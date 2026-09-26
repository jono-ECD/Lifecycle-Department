// Builds an EventPayload from database rows. Used by actions, pins and uploads.
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import type { Actor } from '@/lib/auth';
import { fmtShort } from '@/lib/dates';
import type { EventPayload, IntegrationEventType } from './types';

const base = () => env('APP_URL', 'http://localhost:3000').replace(/\/$/, '');

export async function payloadFor(
  campaignId: string,
  actor: Actor,
  type: IntegrationEventType,
  extra: Partial<Pick<EventPayload, 'text' | 'pin' | 'commentId' | 'date' | 'em'>> = {},
): Promise<EventPayload | null> {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, include: { workspace: true } });
  if (!c) return null;
  const query = `?c=${c.id}${extra.pin ? `&pin=${extra.pin.number}` : ''}`;
  return {
    type,
    workspace: { id: c.workspaceId, name: c.workspace.name, slug: c.workspace.slug },
    campaign: { id: c.id, name: c.name, subtitle: c.subtitle, status: c.status, version: c.currentVersion },
    actor: { role: actor.role, name: actor.name },
    text: extra.text,
    em: extra.em,
    pin: extra.pin,
    commentId: extra.commentId,
    date: extra.date ? fmtShort(extra.date) : undefined,
    links: { admin: `${base()}/admin/w/${c.workspace.slug}${query}`, reviewer: `${base()}/bank${query}` },
    at: new Date().toISOString(),
  };
}

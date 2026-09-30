// Extension point for the send step. Marking a campaign as sent is manual today: ECD sends from
// Klaviyo and confirms here. A Klaviyo provider would implement this interface and be selected with
// SEND_PROVIDER=klaviyo. Nothing in the app depends on the provider doing anything.
import { env } from '@/lib/env';

export interface SendContext {
  campaignId: string;
  workspaceId: string;
  name: string;
  scheduledDate: string | null;
  actorName: string;
}

export interface SendProvider {
  name: string;
  /** Called when a campaign is marked as sent. Return an external id when there is one. */
  onMarkedSent(ctx: SendContext): Promise<{ externalId: string | null }>;
}

export const manualSendProvider: SendProvider = {
  name: 'manual',
  async onMarkedSent() {
    return { externalId: null };
  },
};

export function getSendProvider(): SendProvider {
  const which = env('SEND_PROVIDER', 'manual');
  if (which !== 'manual') console.warn(`[sendProvider] "${which}" is not implemented, using manual.`);
  return manualSendProvider;
}

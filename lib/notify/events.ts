import type { StatusChangeEvent } from './index';

// Placeholder until the notifications milestone. Logs only.
export async function notifyStatusChangeImpl(ev: StatusChangeEvent): Promise<void> {
  console.log(`[notify] ${ev.actor.role} ${ev.action}: ${ev.from} -> ${ev.to} on ${ev.campaignId}`);
}

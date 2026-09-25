// Notification entry points. Filled in at the notifications milestone; the shape is fixed here so actions can call it.
import type { Actor } from '@/lib/auth';
import type { Action } from '@/lib/transitions';
import type { Status } from '@/lib/status';

export interface StatusChangeEvent {
  campaignId: string;
  workspaceId: string;
  actor: Actor;
  action: Action;
  from: Status;
  to: Status;
  note: string;
  date?: string;
}

export async function notifyStatusChange(ev: StatusChangeEvent): Promise<void> {
  const { notifyStatusChangeImpl } = await import('./events');
  await notifyStatusChangeImpl(ev);
}

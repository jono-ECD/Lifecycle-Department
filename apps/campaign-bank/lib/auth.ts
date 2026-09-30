import { redirect } from 'next/navigation';
import type { AdminUser, Reviewer, Workspace } from '@prisma/client';
import { db } from '@/lib/db';
import { getAdminSession, getReviewerSession } from '@/lib/session';

export type Actor =
  | { role: 'admin'; admin: AdminUser; name: string; id: string }
  | { role: 'reviewer'; reviewer: Reviewer & { workspace: Workspace }; name: string; id: string };

export async function currentAdmin(): Promise<AdminUser | null> {
  const s = await getAdminSession();
  if (!s.adminId) return null;
  return db.adminUser.findUnique({ where: { id: s.adminId } });
}

export async function currentReviewer(): Promise<(Reviewer & { workspace: Workspace }) | null> {
  const s = await getReviewerSession();
  if (!s.reviewerId) return null;
  const r = await db.reviewer.findUnique({ where: { id: s.reviewerId }, include: { workspace: true } });
  if (!r || r.revokedAt) return null;
  return r;
}

/** Admin first, then reviewer. Used by the API routes and the shared bank page. */
export async function currentActor(): Promise<Actor | null> {
  const admin = await currentAdmin();
  if (admin) return { role: 'admin', admin, name: admin.name, id: admin.id };
  const reviewer = await currentReviewer();
  if (reviewer) return { role: 'reviewer', reviewer, name: reviewer.name, id: reviewer.id };
  return null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

/** Team, connections and workspace settings are for full admins. Editors work on campaigns. */
export async function requireFullAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== 'admin') redirect('/admin?denied=1');
  return admin;
}

/** Can this actor act on this workspace. Admins can on every workspace, reviewers only on their own. */
export function actorCanAccess(actor: Actor, workspaceId: string): boolean {
  return actor.role === 'admin' || actor.reviewer.workspaceId === workspaceId;
}

/** Approval rights are per person. ECD always can; a client only when marked as an approver. */
export function canDecide(actor: Actor): boolean {
  return actor.role === 'admin' || actor.reviewer.canApprove;
}

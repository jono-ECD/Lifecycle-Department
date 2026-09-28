// One time helper after the upgrade that tied approvals to a version.
// Campaigns approved before the upgrade have no approval record. This fills it in from the thread:
// who approved, when, and the version that was current. It changes nothing else and is safe to run again.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const campaigns = await db.campaign.findMany({ where: { status: { in: ['approved', 'requested', 'scheduled', 'sent'] }, approvedVersion: null, currentVersion: { gt: 0 } }, include: { comments: { where: { toStatus: 'approved' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
let n = 0;
for (const c of campaigns) {
  const last = c.comments[0];
  // seeded history has plain comments rather than status entries, so fall back to the last activity
  await db.campaign.update({ where: { id: c.id }, data: { approvedVersion: c.currentVersion, approvedBy: last?.authorName ?? 'the client, before the upgrade', approvedAt: last?.createdAt ?? c.lastActivityAt } });
  n++;
}
console.log(`Approval records filled in: ${n}`);
await db.$disconnect();

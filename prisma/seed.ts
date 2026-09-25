// Seeds the Blessed Botanicals workspace from the prototype, the admin from env, one reviewer,
// and two scheduled campaigns so the send window is not empty. Safe to run again: it replaces the
// BB workspace and keeps the admin.
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { loadEnv, env } from '../lib/env';
loadEnv();

import { db } from '../lib/db';
import { getStorage } from '../lib/storage';
import { storeVersion } from '../lib/uploads';
import { hashToken, newToken } from '../lib/tokens';
import { addDays, todayYmd, ymdToDate } from '../lib/dates';

const REF = path.resolve(process.cwd(), 'reference');
const d = (s: string) => ymdToDate(s);
// Timestamps at 10:00 Chicago (15:00 UTC) so they show the intended day in the workspace timezone.
const t = (s: string) => new Date(ymdToDate(s).getTime() + 15 * 3600 * 1000);

type Seed = {
  name: string;
  sub: string;
  type: string;
  status: string;
  img: string | null;
  since: string;
  built: string;
  thread: [string, string, string][];
  scheduled?: string;
};

async function main() {
  const adminEmail = env('ADMIN_EMAIL', 'mauricio@ecdigitalstrategy.com').toLowerCase();
  const adminPassword = env('ADMIN_PASSWORD', 'campaign-bank');
  const adminName = env('ADMIN_NAME', 'Mauricio');
  const appUrl = env('APP_URL', 'http://localhost:3000').replace(/\/$/, '');

  await db.adminUser.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash: await bcrypt.hash(adminPassword, 10) },
    create: { email: adminEmail, name: adminName, passwordHash: await bcrypt.hash(adminPassword, 10) },
  });

  // Replace the BB workspace so the seed is repeatable.
  await db.workspace.deleteMany({ where: { slug: 'blessed-botanicals' } });
  await db.notificationLog.deleteMany({});

  const storage = getStorage();
  const markKey = 'workspaces/blessed-botanicals/mark.png';
  await storage.putObject(markKey, fs.readFileSync(path.join(REF, 'bb_mark.png')), 'image/png');

  const ws = await db.workspace.create({
    data: { name: 'Blessed Botanicals', slug: 'blessed-botanicals', logoPath: markKey, timezone: 'America/Chicago', windowDays: 14, maxPerDay: 1 },
  });

  const tz = ws.timezone;
  const today = todayYmd(tz);

  // The ten campaigns from the prototype, dates in 2026, plus two scheduled ones.
  const items: Seed[] = [
    { name: 'Not Sure Where to Begin?', sub: 'Four best sellers, one easy routine', type: 'ever', status: 'review', img: 'begin', since: '2026-09-19', built: '2026-09-18', thread: [['ECD', '2026-09-19', 'Ready for your look. Evergreen, no offer, so it can drop into any open slot.']] },
    { name: 'Born For Us, Made For You', sub: 'Founder story with the everyday staples', type: 'ever', status: 'approved', img: 'founder', since: '2026-09-16', built: '2026-09-15', thread: [['ECD', '2026-09-15', 'Founder story refresh, new photo.'], ['You', '2026-09-16', 'Love the photo. Approved.']] },
    { name: 'Before Life Gets Busy, Stock Up On The Faves', sub: 'Back to school, the daily lineup', type: 'spot', status: 'hold', img: 'faves', since: '2026-09-08', built: '2026-08-27', thread: [['You', '2026-09-08', 'Hold this one while the promo runs. We will use it.']] },
    { name: 'Last Chance: Buy Any 2, Save 15%', sub: 'Skin and body care, offer through Aug 2', type: 'promo', status: 'sent', img: 'skin', since: '2026-08-01', built: '2026-07-29', thread: [] },
    { name: 'Labor Day Reset, EM1 to EM4', sub: 'Four emails, parked when the promo was extended', type: 'promo', status: 'hold', img: null, since: '2026-09-07', built: '2026-08-28', thread: [['You', '2026-09-07', 'Promo got extended. Park these for now, we will use them.']] },
    { name: 'Turkey Tail, EM1 and EM2', sub: 'Product Spotlight pair', type: 'spot', status: 'hold', img: null, since: '2026-09-07', built: '2026-09-03', thread: [['You', '2026-09-07', 'Spotlights paused for now. Keep them.']] },
    { name: 'Sun Lotion', sub: 'Product Spotlight, originally Sep 17', type: 'spot', status: 'review', img: null, since: '2026-09-12', built: '2026-09-11', thread: [['ECD', '2026-09-12', 'Built for Sep 17. If the season has passed, we can hold it for spring.']] },
    { name: 'Wellness Quiz', sub: 'Education, originally Sep 21', type: 'edu', status: 'draft', img: null, since: '2026-09-20', built: '2026-09-19', thread: [['ECD', '2026-09-20', 'Ready to personalize results once the quiz is reconnected to Klaviyo.']] },
    { name: 'Liver + Candida Cleanse 20% Off, EM2 (Plain Text)', sub: 'Sent Sep 19', type: 'promo', status: 'sent', img: null, since: '2026-09-19', built: '2026-09-16', thread: [] },
    { name: '64% of You Come Back. We Asked Why.', sub: 'Sent Sep 12', type: 'edu', status: 'sent', img: null, since: '2026-09-12', built: '2026-09-09', thread: [] },
    { name: 'Fall Immune Support, EM1', sub: 'Product Spotlight for the first cool week', type: 'spot', status: 'scheduled', img: null, since: '2026-09-23', built: '2026-09-21', scheduled: addDays(today, 3), thread: [['ECD', '2026-09-22', 'Ready for the first cool week.'], ['You', '2026-09-23', 'Approved.']] },
    { name: 'Autumn Restock Reminder', sub: 'Evergreen, the daily staples', type: 'ever', status: 'scheduled', img: null, since: '2026-09-24', built: '2026-09-20', scheduled: addDays(today, 8), thread: [['You', '2026-09-24', 'Approved.']] },
  ];

  const reviewerName = 'Brittany';
  let pos = 0;
  for (const it of items) {
    const c = await db.campaign.create({
      data: {
        workspaceId: ws.id,
        name: it.name,
        subtitle: it.sub,
        type: it.type,
        status: it.status,
        builtDate: d(it.built),
        lastActivityAt: t(it.since),
        scheduledDate: it.scheduled ? d(it.scheduled) : null,
        sentDate: it.status === 'sent' ? t(it.since) : null,
        position: pos++,
        createdBy: 'ECD',
        currentVersion: it.img ? 1 : 0,
        reviewEnteredAt: it.status === 'review' ? t(it.since) : null,
        reviewNotifiedAt: it.status === 'review' ? t(it.since) : null,
        createdAt: d(it.built),
      },
    });
    for (const [who, when, body] of it.thread) {
      await db.comment.create({
        data: {
          campaignId: c.id,
          authorKind: who === 'You' ? 'reviewer' : 'admin',
          authorName: who === 'You' ? reviewerName : 'ECD',
          body,
          kind: 'comment',
          createdAt: t(when),
        },
      });
    }
    if (it.img) {
      const file = path.join(REF, `${it.img}_full.jpg`);
      await storeVersion(c.id, 1, [{ name: `${it.img}.jpg`, type: 'image/jpeg', buffer: fs.readFileSync(file) }], 'ECD');
    }
  }

  const token = env('SEED_REVIEWER_TOKEN') || newToken();
  await db.reviewer.create({
    data: { workspaceId: ws.id, name: reviewerName, email: 'brittany@example.com', tokenHash: hashToken(token) },
  });

  const link = `${appUrl}/r/${token}`;
  console.log('');
  console.log('Seeded Blessed Botanicals with', items.length, 'campaigns.');
  console.log(`Admin sign in:   ${appUrl}/admin  (${adminEmail} / ${adminPassword})`);
  console.log(`Reviewer link:   ${link}`);
  console.log('');
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

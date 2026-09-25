# Campaign Bank

A small web app where ECD uploads finished email campaign designs and a client reviews them from a phone or laptop: approve, request changes, put on hold, or drop an approved campaign into an open send slot. Approved and held campaigns form the bank.

The look, copy and interaction model come from `reference/bank_src.html`. That file is the visual and behavioral spec; the app matches it.

## Run it

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000. The seed prints the admin sign in and the reviewer link:

- Admin: http://localhost:3000/admin with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` (defaults: `mauricio@ecdigitalstrategy.com` / `campaign-bank`).
- Reviewer: http://localhost:3000/r/bb-dev-reviewer-token-8f3a1c9d2e7b4a6f (fixed by `SEED_REVIEWER_TOKEN` in `.env` for local use).

`npm run seed` creates `.env` from `.env.example` when it is missing, pushes the SQLite schema (the file is `prisma/dev.db`, Prisma resolves the path relative to the schema), seeds the Blessed Botanicals workspace with the prototype's campaigns and images, one reviewer (Brittany), and two scheduled campaigns. Run it again any time to reset that workspace; the admin account is kept.

Requirements: Node 20 or newer. Playwright's Chromium is installed inside `node_modules` by `npm run e2e:install` (already done on this machine).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` and `npm start` | Production build and server |
| `npm run seed` | Push schema and seed the BB workspace |
| `npm run db:push` | Push the schema only |
| `npm run lint`, `npm run typecheck`, `npm test` | ESLint, `tsc`, Vitest |
| `npm run e2e` | Playwright end to end tests on their own database and port 3100, screenshots into `e2e/screenshots` |
| `npm run e2e:install` | Install Chromium for Playwright into `node_modules` |
| `npm run check` | lint, typecheck, unit tests, e2e. Must be green. |

## Environment

Copy `.env.example` to `.env` (the scripts do this for you). Everything has a working default for local use.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` for SQLite. A Postgres URL with `prisma/schema.postgres.prisma`, see DEPLOY.md |
| `SESSION_SECRET` | Cookie encryption and email link signing. At least 32 random characters in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | The first admin, created or updated by the seed |
| `APP_URL` | Public URL, used in reviewer links and emails |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `STORAGE_DIR` | Folder for the local driver, default `./storage` |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | S3 compatible storage (AWS, R2, MinIO) |
| `RESEND_API_KEY` | When set, emails go through Resend. When missing, they print to the console and are still logged |
| `MAIL_FROM` | From address, default `bank@ecdigitalstrategy.com` |
| `CRON_SECRET` | Protects `/api/cron/reminders` |
| `RUN_SCHEDULER` | `1` runs the reminder job inside the app every 15 minutes |
| `REVIEW_BATCH_MS` | How long to wait before emailing reviewers about new items in review, default 10 minutes |
| `SEED_REVIEWER_TOKEN` | Fixed reviewer token for local development. Remove in production |

## Roles

**ECD admin.** Signs in with email and password at `/admin`. Can create workspaces, upload campaigns and new versions, edit metadata, change any status, schedule, mark as sent, comment, block days, invite reviewers, revoke and regenerate links, add other admins.

**Client reviewer.** Never creates an account. Opens a personal link, sees one workspace, and can approve, request changes with a note, put on hold, bring back to review, schedule into an open slot, unschedule, and comment. Cannot upload, delete or edit metadata.

## How a reviewer link works

1. An admin creates the reviewer in `/admin/w/<slug>/settings` (name and email). The app generates 32 random bytes, stores only their SHA-256, and shows the link `/r/<token>` once, with a QR code for the phone.
2. Opening the link checks the hash, sets a 90 day session cookie, and shows the bank at `/bank`. The reviewer can bookmark either URL.
3. Revoke stops the link at once. New link issues a fresh token and reactivates the reviewer. An optional 4 digit PIN can be set per reviewer; the link then asks for it before opening.
4. Emails to reviewers carry a signed link (`/e/<signature>`) that expires after 45 days and is checked against the reviewer row, so a revoked reviewer cannot use an old email.

## Adding a workspace

1. `/admin`, then New workspace. Name, slug, timezone, send window length, max campaigns per day.
2. In the workspace settings upload the mark shown in the header, and create the reviewer link.
3. Add campaigns from the workspace bank. Move a campaign to review when it is ready; the reviewer gets one email per batch.

## Status model

Six statuses, the same transitions and copy as the prototype. Reviewers see the prototype's buttons; admins get a few more.

| From | Reviewer | Admin additionally |
|---|---|---|
| draft, review | Approve, Request changes (note required), Put on hold | Move to review (draft only), Edit, Delete |
| approved | Schedule, Put on hold | Mark as sent |
| hold | Back to review, Approve as is | Mark as sent |
| scheduled | Unschedule | Move date, Mark as sent |
| sent | nothing | Reopen to hold |

The bank filter is approved plus hold. Every status change is written to the campaign thread, so the thread is the full history.

## Scheduling

A rolling window from today in the workspace timezone, 14 days by default. Blocked days (`/admin/w/<slug>/settings`) and full days are skipped. Past days are never offered. Today is offered only to admins. When a scheduled date passes and the campaign is still scheduled, admins see a flag on the card and in the drawer. Nothing is marked as sent automatically; ECD sends from Klaviyo and confirms here.

## Notifications

- Admin moves campaigns to review: reviewers get one email per batch (10 minute window) with the count of everything in review, names, subtitles, thumbnails and a link. The flag lives on the campaign row, so a restart never double sends.
- Reviewer approves, requests changes, holds, schedules or unschedules: admins get an email with the note.
- Reminders: campaigns in review for 3 days or more, one email per workspace per day at or after 9:00 workspace time. `GET /api/cron/reminders?secret=<CRON_SECRET>` runs it (also flushes pending digests). `RUN_SCHEDULER=1` does the same in process every 15 minutes.
- Nothing is sent for comments alone.

Every send writes a `NotificationLog` row. Without `RESEND_API_KEY` the rendered email prints to the server console.

## Sending

Marking as sent is manual. The extension point is `lib/sendProvider.ts`: `getSendProvider()` returns the provider used when a campaign is marked as sent. The default `manual` provider does nothing. A Klaviyo provider would implement the same interface and be selected by `SEND_PROVIDER=klaviyo`.

## Layout of the code

```
app/                 Next.js App Router pages and route handlers
  bank/              reviewer bank
  r/[token]/         reviewer link, sets the session
  e/[sig]/           signed email link
  admin/             admin pages
  api/               JSON route handlers, all validated with zod
  files/[...key]/    serves local storage with cache headers
components/          Bank (the prototype port), editor, admin panels
lib/                 db, auth, sessions, transitions, slots, dates, storage, images, uploads, mail, notify
prisma/              schema.prisma (SQLite), schema.postgres.prisma, seed.ts
tests/               Vitest unit tests
e2e/                 Playwright tests and screenshots
scripts/             helpers used by npm scripts
reference/           the prototype and the design images
```

## Tests

Unit tests cover status transitions, slot availability, token hashing and signing, digest batching, reminder rules, the S3 adapter against a mock, the Resend transport against a fake fetch, and the image pipeline. End to end tests run the real app with a fresh database: reviewer approves, request changes without a note is refused, scheduling into a slot, blocked days, admin uploads two PNGs and a second version, notification log entries, revoked links. Screenshots at 390 and 1280 land in `e2e/screenshots`.

## Small things worth knowing

- In the drawer, Escape closes and the arrow keys move to the previous or next campaign in the current list.
- In workspace settings, Copy link gives an existing reviewer a 45 day signed link and a QR code without changing their personal link. New link rotates the personal token and shows it once.
- The admin workspace page ends with the last 8 thread entries; the Activity page has the last 50.
- A workspace with no campaigns shows an empty state instead of an empty grid.

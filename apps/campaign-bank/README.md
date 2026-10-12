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
| `STORAGE_DRIVER` | `local` (default), `s3`, or `netlify` (default on Netlify) |
| `STORAGE_DIR` | Folder for the local driver, default `./storage` |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | S3 compatible storage (AWS, R2, MinIO) |
| `RESEND_API_KEY` | When set, emails go through Resend. When missing, they print to the console and are still logged |
| `MAIL_FROM` | From address, default `bank@ecdigitalstrategy.com` |
| `CRON_SECRET` | Protects `/api/cron/reminders` |
| `RUN_SCHEDULER` | `1` runs the reminder job inside the app every 15 minutes |
| `REVIEW_BATCH_MS` | How long to wait before emailing reviewers about new items in review, default 10 minutes |
| `SEED_REVIEWER_TOKEN` | Fixed reviewer token for local development. Remove in production |
| `ASANA_ACCESS_TOKEN` | Agency Asana personal access token. Per client projects are set in Connections |
| `FIGMA_ACCESS_TOKEN` | Agency Figma personal access token, file read scope |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional. Service account key for writing the Campaign Bank tab through the Sheets API |

## The one rule

Each field has exactly one writer. The Bank owns client decisions. Asana owns that a campaign exists, its name, its planned date and its production stage. Figma owns the pixels. Klaviyo owns what actually sends. When two systems disagree, the owner wins. `COMPARISON.md` maps the architecture plan to this code, row by row.

## Roles

**ECD admin.** Signs in with email and password at `/admin`. Can do everything: workspaces, team, connections, campaigns, versions, statuses, dates, reviewers, blocked days.

**ECD editor.** Same sign in. Works on campaigns, reviewers and the calendar. Cannot manage the team, connections or workspaces, and cannot delete a campaign.

**Client approver.** Never creates an account. Opens a personal link, sees one workspace, and can approve, request changes with a note, put on hold, bring back to review, request a send date, withdraw it, comment, and pin notes on the design. The client never schedules or sends.

**Client commenter.** Sees everything the approver sees and can leave notes and pins, but decides nothing. Approval rights are per person, set in Reviewers and calendar.

Clients see In review onward plus On hold. Drafts are hidden from clients unless the workspace setting allows them.

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

The six statuses of the prototype, plus two that keep the record honest.

| Status | Entered when |
|---|---|
| Draft | ECD is still working. Hidden from the client by default. |
| In review | ECD moves it, or Asana Stage reaches Client Review and a design exists. Approvers get an email. |
| Changes requested | A client approver asks for changes. A note is required. |
| Approved | A client approver approves. The approval stores the version, the person and the time. |
| On hold | The client parks it. |
| Date requested | The client picks a day for approved work. It holds the day. |
| Scheduled | ECD confirms the date, or Asana Stage or Klaviyo say it is scheduled. |
| Sent | ECD marks it, or Asana Stage or Klaviyo say it went out. |

| From | Client approver | ECD |
|---|---|---|
| draft | (hidden) | Approve, Request changes, Put on hold, Move to review |
| review | Approve, Request changes (note required), Put on hold | same |
| changes | Approve as is, Put on hold | Move to review, Approve as is, Put on hold |
| approved | Request a send date, Put on hold | Schedule, Put on hold, Mark as sent |
| requested | Pick another date, Withdraw the date | Confirm the date, Schedule another day, Back to the bank, Mark as sent |
| hold | Back to review, Approve as is | same, plus Mark as sent |
| scheduled | nothing | Move date, Unschedule, Mark as sent |
| sent | nothing | Reopen to hold |

`lib/actions.ts` is the only way a status changes. It checks the role and the allowed move, writes the campaign and the thread entry together, then queues the side effects. The bank filter is approved plus hold.

**An approval covers one design version.** When a new version arrives for a campaign that was approved, had a date requested, or had changes requested, the campaign goes back to In review, the approval is cleared, and the thread says why. The editor warns ECD before saving. An unchanged Figma render is recognised by its hash and creates no version.

## Scheduling

A rolling window from today in the workspace timezone, 14 days by default. A day is taken by a scheduled campaign, a requested date, or an item planned in the content calendar. Blocked days and full days are skipped, past days are never offered, and today is offered only to ECD.

- **Offer window.** A campaign can carry an offer start and end. The slot picker only offers days inside it, so an approved promo cannot be booked after its code expires. Evergreen work has no window.
- **Send days.** By default every day is open unless blocked. A workspace can switch to listed send days, where the client can only ask for the days ECD opened, by weekday cadence or one by one.
- **Late.** When a scheduled date passes and the campaign is still scheduled, ECD sees a flag on the card and in the drawer.

## SMS

A campaign has a channel, email or SMS. SMS has no frame, so the copy itself is the version: it shows as a text preview with its character and message count, and editing the copy creates the next version.

## Notifications

- Admin moves campaigns to review: reviewers get one email per batch (10 minute window) with the count of everything in review, names, subtitles, thumbnails and a link. The flag lives on the campaign row, so a restart never double sends.
- Reviewer approves, requests changes, holds, requests a date or withdraws it: admins get an email with the note.
- Reminders: campaigns in review for 3 days or more, one email per workspace per day at or after 9:00 workspace time. `GET /api/cron/reminders?secret=<CRON_SECRET>` runs it (also flushes pending digests). `RUN_SCHEDULER=1` does the same in process every 15 minutes.
- Nothing is sent for comments alone.

Every send writes a `NotificationLog` row. Without `RESEND_API_KEY` the rendered email prints to the server console.

## Pinned notes on the design

Clients can point at exactly what should change, the way they do in Figma. In the drawer, "Leave a note on the design" turns on note mode: tap the design to drop a numbered pin, or drag to mark an area. A small card opens next to the pin to write the note (Enter posts). Pins open a thread with replies. The side panel lists every note with author, date and email number; done notes hide behind a toggle. Only ECD can mark a note done or reopen it. Notes are attached to a specific version, so a new upload starts clean and earlier notes stay listed with a crop of their area.

When a note is created the server crops the marked area, draws the marker on it, and sends that crop with the note to the admin email, Slack and Asana. Deep links `?c=<campaign>&pin=<number>` open the drawer on that note.

## Connections

Each workspace has a Connections page in the admin. Agency tokens live in env, per client targets in the database.

| Connection | Set where | What happens |
|---|---|---|
| Asana, inbound | `ASANA_ACCESS_TOKEN` in env, project and section per workspace | Every five minutes the Bank reads the tasks of the campaign section changed since the last pull. Each email or SMS task becomes a campaign keyed on the task id, with its name, due date, Stage, and the `Design:` and `Klaviyo:` links from the task notes. Stage "Client Review" moves it to In review once a design exists; "Scheduled in Klaviyo" and "Done" move it to Scheduled and Sent. |
| Asana, outbound | same | A client decision becomes a comment on that same task ("Name via Campaign Bank: ..."), with their words verbatim, and sets Stage. A note pinned on the design becomes a subtask with the crop attached. Without a linked task, a new task is created in the project. |
| Stage binding | Connections, "Load the Stage fields" | Stage is bound by field id and option id, never by name. When two fields share a name the screen says so and lists both with their ids. The Bank remembers the Stage it wrote, so the next pull ignores its own write. |
| Figma | `FIGMA_ACCESS_TOKEN` in env | Frames render at 2x and are copied into our storage. A changed file is noticed on the next sync and re-rendered; unchanged frames are skipped. |
| Klaviyo | Private key per workspace, encrypted | Results per sent email. With the campaign id on the campaign, Scheduled and Sent follow Klaviyo. The Bank never writes to Klaviyo. |
| Content calendar | Sheet link per workspace | Read only. Planned sends show on the calendar and take the day. Reads a list with a date column, or a calendar drawn as a month grid. |
| Campaign Bank tab | Feed link, or sheet id plus `GOOGLE_SERVICE_ACCOUNT_JSON` | The Bank's own tab in the Scheduler sheet, one row per campaign keyed on the Asana task id. The calendar grid is never written. |
| Slack | Incoming webhook URL per workspace | Change requests and pinned notes post with the words of the client verbatim, the crop and a button. |
| Webhook | URL and secret per workspace | Every event as signed JSON, for Zapier, Make or n8n. |

**Sync problems.** A task the Bank cannot read is never guessed at. It is listed in Connections with the reason ("the Design: line has no link yet", "Stage is not mapped") and clears on its own once the task is fixed.

**The outbox.** A client click never waits on another tool. The decision is saved first; every side effect is a row in `IntegrationEvent` with a unique key, retried with backoff, and parked as "gave up" after five attempts where ECD can see it and retry.

**The Campaign Bank tab without credentials.** In Connections create the feed link, add a tab named Campaign Bank to the sheet, and paste `=IMPORTDATA("<feed link>")` in cell A1. Google refreshes it about once an hour. With a service account the Bank rewrites the tab after every change instead.

## Revision insights

The admin workspace page shows how reviews are going, from the thread: typical time to approve, rounds per campaign, how often work is put on hold, and what is waiting.

## Import from Figma

Admin, Import from Figma. Paste a Figma file link, press Show frames, and every top level frame on every page appears as a thumbnail. Tick the ones that are ready; the order you tick is the order in the campaign. Frames named with EM1, EM2 and so on are combined into one campaign (switch that off to keep them separate). Name each campaign, pick its type, and import as drafts or straight to review. Frames are rendered at 2x and stored as version 1. Frames already in the bank are marked.

Each imported campaign remembers its file and frames, so "Pull the latest from Figma" in the editor creates the next version in one click. Needs `FIGMA_ACCESS_TOKEN` in the environment; one token covers every file that account can open.

## Content calendar from a spreadsheet

Connections, Content calendar. Paste the link to the Google Sheet where sends are planned and set its sharing to "Anyone with the link can view". No API key is needed. The bank reads the sheet every 15 minutes (and on "Sync now"), finds the header row, the date column and the campaign name column on its own, and accepts dates the way people type them: `10/3/2026`, `10/3`, `Oct 3`, `Tue, Oct 6`, `2026-10-03`. If one sheet holds every client, name the client column and the value to keep. Rows marked cancelled are skipped. Excel works through any link that returns CSV.

Planned sends show on the calendar strip as outlined chips, next to the filled chips for campaigns scheduled in the bank. A planned day counts as taken, so neither the client nor ECD can book another send there. When a campaign in the bank has the same name as a planned line, they count as one send, and that campaign can take its own day.

## Klaviyo results and sent history

Connections, Klaviyo. Paste the private API key of the client's Klaviyo account (read access to campaigns, metrics and reporting). Keys are per client, stored encrypted, and never shown again. The bank pulls every email campaign with recipients, opens, clicks, unsubscribes and revenue attributed to Placed Order, and refreshes every three hours; Klaviyo limits reporting calls, so it cannot be constant.

Sent history (a link on the bank page for the client, and in the admin nav) lists every email marked sent in the bank plus everything Klaviyo reports as sent, with a summary of the last 90 days. Klaviyo campaigns are matched to bank campaigns by name; ECD can link the rest by hand in the history, and manual links survive syncs. The drawer of a sent campaign shows its results. Both ECD and the client see results.

## Sample mode

To try these three features without any account, set in `.env`:

```
ENABLE_DEV_MOCKS="1"
FIGMA_ACCESS_TOKEN="sample"
FIGMA_API_BASE="http://localhost:3000/api/dev/mock/figma"
KLAVIYO_API_BASE="http://localhost:3000/api/dev/mock/klaviyo"
```

Import from Figma then shows four stand in frames for any link. In Connections, "Use the sample calendar" fills in a sample sheet, and any key that starts with `pk_` connects the stand in Klaviyo. Remove the four lines before going live. The stand in endpoints answer 404 unless `ENABLE_DEV_MOCKS` is `1`.

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

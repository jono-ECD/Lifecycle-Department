# Campaign Bank, handoff for Claude Code

Owner: Mauricio Arias, ECD Digital Strategy (mauricio@ecdigitalstrategy.com)
Date: September 25, 2026
Status of this doc: complete enough to build without asking questions. Where a choice was not specified, a default is given. Take the default.

## 1. What this is

A small web app where ECD uploads finished email campaign designs and a client reviews them from their phone or laptop: approve, request changes, put on hold, or drop an approved campaign into an open send slot. Approved and held campaigns form the "bank": ready work that can go out any day the calendar has room.

It replaces the current process (PDFs over email, approvals lost in threads) that is visibly costing revenue. In September 2026 Blessed Botanicals sent 2 campaigns instead of the usual 8 to 10 because approvals stalled, while ECD had 10 finished campaigns waiting.

First client: Blessed Botanicals (BB). Reviewer: Brittany. The app must support more clients from day one (ECD also runs HigherDOSE and Chubbies) but only BB gets seeded.

A clickable prototype exists and is the visual and behavioral reference: `reference/BB_Campaign_Bank.html` (open in a browser, fully self-contained) and `reference/bank_src.html` (same thing with image placeholders, easier to read). Match its look, copy, and interaction model. Do not redesign it.

## 2. Users and roles

Two roles only.

ECD admin (Mauricio and teammates). Can do everything: create workspaces, upload campaigns and revisions, edit metadata, change any status, schedule, mark as sent, comment, manage the send calendar, invite reviewers.

Client reviewer (Brittany and whoever she adds). Scoped to one workspace. Can view all campaigns, approve, request changes with a note, put on hold, bring back to review, schedule an approved campaign into an open slot, unschedule, comment. Cannot upload, delete, or edit metadata.

Auth model, decided:
- Admins sign in with email and password. One admin account is seeded from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Admins can create more admins.
- Reviewers never create accounts. Each reviewer gets a personal signed link (`/r/<token>`) tied to their workspace and email. Opening it sets a long-lived session cookie (90 days). Admin can revoke and regenerate a link. Optional 4-digit PIN per reviewer, off by default. This is the right trade for a client who reviews from a phone; magic links via email can come later.

## 3. Core objects

Workspace: id, name ("Blessed Botanicals"), slug, logo, brand color (optional), timezone (America/Chicago for BB), send window length in days (default 14), max campaigns per day (default 1), created at.

Campaign: id, workspace id, name, subtitle (one line, what it is), type (promo, spotlight, education, evergreen), status (draft, review, approved, hold, scheduled, sent), built date, last update, scheduled date (nullable), sent date (nullable), sort position, created by.

CampaignAsset: id, campaign id, version number, kind (image or pdf), file path, width, height, order index (EM1, EM2... within one campaign are separate assets, ordered), uploaded at, uploaded by. A campaign has 0..n assets. Zero assets shows the placeholder card from the prototype ("Preview attaches here when the design is uploaded").

Comment: id, campaign id, author (user or reviewer), body, created at, kind (comment, status change, system). Status changes are written to the thread as system entries so the thread is the full history, like the prototype's `thread` array.

CalendarBlock: id, workspace id, date, label ("Klaviyo: flow test", "Client blackout"), created by. Lets ECD mark days that are unavailable for reasons outside the app.

Reviewer: id, workspace id, name, email, token hash, pin hash (nullable), last seen, revoked at.

AdminUser: id, name, email, password hash.

Notification log: id, type, recipient, campaign id, sent at, provider id. For dedup and debugging.

## 4. Status model

Same six statuses and the same transitions as the prototype. Copy them exactly, including button labels and their small captions, and the toast messages.

| From | Reviewer can | Admin additionally can |
|---|---|---|
| draft | Approve, Request changes (note required), Put on hold | Move to review, edit, delete |
| review | Approve, Request changes (note required), Put on hold | same as draft |
| approved | Schedule (pick open slot), Put on hold | Mark as sent |
| hold | Back to review, Approve as is | Mark as sent |
| scheduled | Unschedule (back to approved, slot reopens) | Mark as sent, move date |
| sent | nothing | Reopen to hold (rare) |

"Bank" filter = approved + hold. Headline on the page: "N campaigns ready for your review. A approved in the bank, H on hold." with the empty state "Nothing to review right now. ..." exactly as in the prototype.

Request changes must refuse without a note (prototype toast: "Add a short note so ECD knows what to change.").

## 5. Send window and scheduling

Rolling window starting today in the workspace timezone, length from workspace settings (14). Each day shows: date, weekday, chip when a campaign is scheduled, blocked state when a CalendarBlock exists. Clicking a scheduled day opens that campaign.

Scheduling an approved campaign: picker shows every day in the window that is neither full nor blocked. Max campaigns per day from workspace settings. Past days never offered. Today is offered only to admins.

When the window rolls past a scheduled date and the campaign is still "scheduled", flag it in the admin view ("Scheduled date passed, mark as sent or move"). Do not auto-mark as sent; ECD sends from Klaviyo and confirms here.

Footer copy under the window: "Any open day can take an approved campaign. Pick the slot, we handle the rest."

## 6. Screens

Reviewer app (mobile first, this is what Brittany uses on her phone):
1. Bank page (`/r/<token>`): header with workspace mark and name, headline, send window strip, filter chips (view toggle gallery/list, All, Bank, then each status with counts), gallery (masonry cards showing the full design image, hover/tap pill with status) or list rows. Exactly the prototype.
2. Campaign drawer: full-height side panel on desktop, bottom sheet on mobile. Preview (all assets stacked, pinch/zoom on mobile, click to open full size), title, status pill, meta (Type, Built, Last update, Send date when scheduled), action buttons for the current status, slot picker, note textarea, thread. Exactly the prototype.
3. Everything the reviewer does writes to the thread and triggers a notification to ECD.

Admin app (`/admin`, desktop first):
1. Sign in.
2. Workspace list with counts per status and "oldest item in review" age.
3. Workspace bank: same bank page as the reviewer, plus an "Add campaign" button, an edit pencil on each card, "Mark as sent" where allowed, calendar blocks management, and a reviewer link panel (create reviewer, copy link, revoke).
4. Campaign editor: name, subtitle, type, built date, status, ordered asset uploader (drag to reorder, multi-file, PNG/JPG/WEBP up to 15 MB each, PDF up to 25 MB), version history (re-uploading replaces the visible set and increments version; old versions stay viewable in the thread).
5. Activity view: last 50 thread entries across the workspace.

## 7. Notifications

Email via Resend (`RESEND_API_KEY`). If the key is missing, use a console transport that logs the rendered email and still writes the notification log, so the app runs without credentials. From address from env (`MAIL_FROM`), default `bank@ecdigitalstrategy.com`.

Events and recipients:
- Campaign moved to review by admin: reviewer(s). Subject: "1 campaign ready for your review" (count of everything currently in review). Body has the campaign name, subtitle, a thumbnail, and the link. Batch: if several campaigns move to review within 10 minutes, send one email. Implement with a short delayed job (setTimeout queue in process is fine, persisted flag on the campaign so a restart does not double send).
- Reviewer approved, requested changes, held, scheduled, unscheduled: admin(s) of the workspace. Include the note.
- Reminder: campaigns in review older than 3 days, one email per day at 9:00 workspace time to reviewers, max one per day per workspace, listing them. Cron endpoint `/api/cron/reminders` protected by `CRON_SECRET`, plus an in-process daily scheduler when `RUN_SCHEDULER=1`.

Never email on comments alone. Too noisy for a client.

Email templates: plain, brand-light, the same type and colors as the app. No marketing style.

## 8. Stack and architecture, decided

- Next.js 15, App Router, TypeScript, React Server Components where natural, route handlers for the API.
- Prisma. SQLite in development and by default (`DATABASE_URL="file:./dev.db"`). Schema must run on Postgres without changes (avoid SQLite-only types, use `DateTime`, `String`, `Int`, `Boolean`, `Json` only where needed). A `DATABASE_PROVIDER` switch is fine if needed via two schema files; document it.
- File storage behind one interface (`putObject`, `getUrl`, `delete`). Local disk adapter (`./storage`, served through a route handler with cache headers) by default. S3-compatible adapter (`S3_*` env) implemented and unit tested against a mock, not against a live bucket.
- Image handling: on upload, read dimensions with `sharp`, generate a 480px wide thumbnail for the gallery, keep the original for the drawer. For PDFs store as is and render with the browser's viewer in the drawer; also try to rasterize page 1 to a PNG thumbnail with `pdfjs-dist` or `pdf-to-img`, and fall back to a generic PDF card if that fails.
- Styling: Tailwind is fine, but port the prototype's CSS tokens verbatim (the oklch variables, radii, Newsreader for headings, Helvetica/Arial for body). The prototype's CSS is the source of truth for look and motion. Do not introduce a component library.
- Auth: `iron-session` or a signed cookie of your own for both sessions. Password hashing with `argon2` or `bcryptjs`. Reviewer tokens: 32 random bytes, store only the SHA-256.
- Validation with `zod` on every route handler.
- Tests: Vitest for units (status transitions, slot availability, token hashing, notification batching). Playwright for end-to-end on the real app: reviewer approves, requests changes without note is refused, schedules into a slot, admin uploads and the reviewer sees it, notification log entries exist. Playwright must run headless in CI and produce screenshots into `./e2e/screenshots`.
- Lint and typecheck must pass. `npm run check` runs lint, typecheck, unit tests, e2e.
- Seed script: creates the BB workspace, the admin from env, one reviewer (Brittany, email placeholder `brittany@example.com`), and the 10 campaigns from the prototype with their statuses, dates, threads, and the four designs that have images (`reference/*_full.jpg`, thumbnails `reference/*_thumb.jpg`). Also seeds two scheduled slots so the window strip is not empty.

Deployment is out of scope for this run (no credentials available). Write `DEPLOY.md` covering: Railway or Fly with a persistent volume for SQLite plus local storage as the simplest path; Postgres plus S3 env for the proper path; the env var list; how to run the seed; how to set the cron.

## 9. Non-goals for this build

- No Klaviyo API integration. "Mark as sent" is manual. Leave a clear extension point (a `sendProvider` stub) and a note in the README.
- No real-time collaboration. Polling every 30 seconds on the bank page is enough.
- No comments on specific regions of the image.
- No billing, no multi-tenant SSO.
- No public pages.

## 10. Definition of done

1. `npm install && npm run seed && npm run dev` gives a working app at `localhost:3000` with the BB bank populated, the admin able to sign in, and a printed reviewer link that opens the reviewer bank.
2. All six statuses and every transition in section 4 work from both roles with the same labels and toasts as the prototype.
3. Upload works end to end: an admin adds a campaign with two PNGs, they appear in the gallery and the drawer in order, a second upload creates version 2 and the thread records it.
4. Scheduling respects blocked days, the per-day limit, and the window; unscheduling reopens the slot.
5. Notifications render and log through the console transport; with a Resend key they send.
6. Mobile layout of the reviewer bank and drawer is usable at 390px wide (iPhone). Verified with Playwright screenshots at 390 and 1280.
7. `npm run check` is green.
8. README covers setup, env, roles, how a reviewer link works, and how to add a workspace. DECISIONS.md lists every choice made that was not in this doc. PROGRESS.md is the running log.

## 11. Copy and tone rules

Client-facing text (everything the reviewer sees, every email) follows ECD's rules: plain sentences, no dashes or em dashes, no exclamation marks, never make the client feel guilty about delays, never mention lead times. Reuse the prototype's copy wherever it exists. When new copy is needed, keep it to one short sentence.

## 12. Reference files in this folder

- `reference/BB_Campaign_Bank.html`: the prototype with images, open in a browser.
- `reference/bank_src.html`: the prototype source with image placeholders; the JS at the bottom is the behavior spec.
- `reference/*_full.jpg`, `reference/*_thumb.jpg`: the four campaign designs (begin, founder, faves, skin).
- `reference/bb_mark.png`, `reference/bb_logo.png`: BB leaf mark (header) and full logo.
- `reference/prototype_gallery.jpg`, `reference/prototype_drawer.jpg`: screenshots of the gallery and the drawer, for quick visual comparison.

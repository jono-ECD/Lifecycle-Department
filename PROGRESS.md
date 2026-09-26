# Progress log

Running log for the Campaign Bank build. Newest entries at the bottom of each section.

## Done

- 2026-09-25: Read HANDOFF.md, PROMPT.md, the prototype source and the two reference screenshots.
- 2026-09-25: Found the folder with `package.json` and `node_modules` already installed from a previous attempt but no commits and no source. Kept the dependencies and continued.
- 2026-09-25: Scaffold and tooling. Next 15 App Router, TypeScript 5.9 (was 6.0, pinned down for Next and typescript-eslint support), ESLint 9 flat config, Vitest, Playwright with Chromium installed inside `node_modules` so nothing outside the folder is written. Prototype CSS ported verbatim into `app/globals.css`. Commit `d321fff`.
- 2026-09-25: Database schema (SQLite, with a Postgres twin), date helpers, status constants, storage adapters (local disk, S3 against a mock), image pipeline with sharp and a pdf-to-img attempt with a generic fallback, seed with the prototype's ten campaigns, the four designs, Brittany, and two scheduled campaigns. Commits `8f531fc`, `d5e8d44`.
- 2026-09-25: Auth. Admin email and password with iron-session, reviewer signed links with hashed tokens, optional PIN, 90 day cookie, revoke and regenerate. Commit `db2896f`.
- 2026-09-25: Status transitions and slot availability as pure functions, unit tested. Commit `58c5b5a`.
- 2026-09-25: Reviewer bank page and drawer as a React port of the prototype's render functions. Gallery, list, send window strip, filters, every transition with the prototype's labels and toasts, slot picker, note, thread, polling. Screenshots at 390 and 1280 compared against the reference images; fixed a one day date shift caused by UTC midnight timestamps. Commit `10cfd26`.
- 2026-09-25: Admin screens. Workspace list with counts and oldest-in-review age, new workspace, campaign editor with ordered multi file uploads (drag or arrows), versions with history, delete, reviewer links with QR code, PIN, revoke and regenerate, calendar blocks, workspace settings with logo upload, activity view, team page. Commit `1e840a7`.
- 2026-09-25: Notifications. Resend and console transports, plain brand light templates, reviewer actions to admins, batched review digest with a persisted flag, daily reminders, cron endpoint with secret, in process scheduler, signed email links. Verified through the console transport: approval email to admin, one digest for two campaigns, one reminder, second run deduplicated. Commit `3bc2c15`.
- 2026-09-25: Tests. 47 unit tests and 15 Playwright tests on a fresh database each run, screenshots at 390 and 1280 in `e2e/screenshots`. Commit `e8514b2`.
- 2026-09-25: README.md, DEPLOY.md, DECISIONS.md, `sendProvider` extension point. Commit `0f067a0`.
- 2026-09-25: `npm run check` green and `next build` succeeds for every route. Polish commit `ce4a8ce`.
- 2026-09-25: Extra 1, empty state illustration for a workspace with no campaigns, with a test and screenshot. Commit `3b71b2d`.
- 2026-09-25: Extra 2, keyboard navigation in the drawer: Escape closes, arrow keys move between campaigns in the current list, ignored while typing a note. Commit `2253264`.
- 2026-09-25: Extra 3, Copy link with a QR code for existing reviewers, as a signed 45 day link that keeps their personal link valid. Commit `d1d873b`.
- 2026-09-25: Extra 4, recent activity feed on the admin workspace page. Commit `61c5a22`.
- 2026-09-25: Final `npm run check` green with 19 end to end tests, screenshots refreshed, dev database reseeded to the clean state. Fixed the e2e reset: Prisma resolves `file:./e2e.db` under `prisma/`, so the old reset deleted nothing and state leaked between runs.

## Next

- Nothing outstanding from HANDOFF.md section 10 or PROMPT.md item 8. Ideas that were out of scope: magic links by email for reviewers, Klaviyo send provider, comments on image regions.

## Problems and fixes

- TypeScript 6.0 was installed by the previous attempt. Next 15.5 and typescript-eslint do not support it yet, so pinned to 5.9.
- Long shell heredocs failed in this environment, so source files were written with the editor tool instead. No effect on the result.
- `.gitignore` had `storage/`, which also ignored `lib/storage`. The adapters were missing from the first commits. Changed to `/storage/` and committed them.
- Seeded dates rendered one day early: `lastActivityAt` was stored at UTC midnight and formatted in Chicago time. Seed now stores 10:00 Chicago, and sent dates format in the workspace timezone.
- `instrumentation.ts` imported the mailer, which pulled sharp and pdf.js into Next's edge compile and made every page return 500 on the e2e server. The scheduler now calls the cron endpoint over HTTP.
- Two `next dev` servers (dev on 3000 and e2e on 3100) would share `.next`. The e2e server builds into `.next-e2e` through `NEXT_DIST_DIR`.
- Playwright ran the admin spec before the reviewer spec (alphabetical), so seeded counts did not match. Specs are numbered to run in order, and the one assertion that depends on earlier state accepts both outcomes. The reviewer helper resets the seeded token because a later test revokes it.
- Route files exported helper symbols (`WorkspaceFields`, `reviewerLink`), which `next build` rejects. Moved to `lib/workspaces.ts` and `lib/reviewers.ts`.
- ESLint picked up the `.next-e2e` and `.next-build` folders and reported thousands of problems. Added them to the ignore list.
- `next build` rewrites the `include` list in `tsconfig.json` for its `distDir`. All three type folders are listed so the file stops changing.

## Summary for Mauricio

**What works.** Everything in HANDOFF.md section 10. Reviewer bank and drawer match the prototype at 1280 and 390 (compare `e2e/screenshots/reviewer-gallery-1280.png` and `reviewer-drawer-1280.png` with `reference/prototype_gallery.jpg` and `prototype_drawer.jpg`). All six statuses and every transition from both roles with the prototype's labels, captions and toasts. Request changes refuses without a note. Scheduling respects blocked days, the per day limit, the window, past days, and today for admins only; unscheduling reopens the slot. Uploads: ordered multi file PNG, JPG, WEBP and PDF, thumbnails, versions with history in the thread. Notifications: reviewer actions to admins, batched review digest, daily reminders, all logged, console transport without a key and Resend with one. Admin screens for workspaces, campaigns, reviewers, blocked days, activity and team. 47 unit tests, 19 end to end tests, lint and typecheck: `npm run check` is green, and `npm run build` succeeds.

**How to start it.**

```
npm install
npm run seed
npm run dev
```

Admin: http://localhost:3000/admin with `mauricio@ecdigitalstrategy.com` and `campaign-bank` (from `.env`, change it there).

**Seeded reviewer link.** http://localhost:3000/r/bb-dev-reviewer-token-8f3a1c9d2e7b4a6f (fixed for local use through `SEED_REVIEWER_TOKEN` in `.env`; DEPLOY.md says to unset it in production so the seed makes a random one).

**What I decided on my own.** DECISIONS.md has all 43, one line each. The ones you may care about: plain CSS instead of Tailwind; the seed adds two scheduled campaigns (12 in total) instead of changing the prototype's statuses; PDFs open in the browser viewer in a new tab from a card in the drawer rather than an inline frame; emails carry signed 45 day links because personal tokens are stored only as hashes; the review digest timer is in process with the flag on the campaign row; reminders are deduplicated per workspace per day so an hourly cron is safe; admins can set any status from the editor; the "Copy link" button issues a signed link so an existing phone bookmark keeps working.

**What to look at first.**

1. Open the reviewer link on your phone or at 390px and walk through approve, request changes without a note, request changes with a note, hold, schedule, unschedule. Watch the toasts.
2. `/admin/w/blessed-botanicals`: Add campaign with two images, then open it and Move to review. With no `RESEND_API_KEY` the email prints in the terminal running `npm run dev`. `GET /api/cron/reminders?secret=change-me&force=1` flushes the digest immediately instead of waiting 10 minutes.
3. `/admin/w/blessed-botanicals/settings`: Copy link shows the QR. New link rotates the token. Block a day and see the slot picker skip it.
4. `e2e/screenshots/` for every screen at both widths, and DEPLOY.md when you are ready to put it on Railway or Fly.

## Second session, 2026-09-25: connections and pinned notes

- Asked three questions first. Answers: Slack per client channel only; Asana tasks for change requests and pinned notes with the words of the client verbatim and full context; only ECD marks notes done.
- Schema: `WorkspaceIntegration` (Slack webhook, Asana project and section, Figma file key, generic webhook), `IntegrationEvent` outbox, `PinThread` and `PinComment`, Figma fields on campaigns. Additive `prisma db push`, no data lost.
- Connectors in `lib/integrations/`: Slack Block Kit messages, Asana tasks with attachments, comments and completion, Figma link parsing, frame rendering and comment listing, signed webhooks. All over plain fetch, all unit tested against fakes.
- Outbox with immediate delivery, retry with backoff from the cron endpoint, and a delivery log with Retry on the new Connections page.
- Pinned notes on designs, Figma style: tap to pin, drag to mark an area, numbered pins, popover threads, list in the side panel, done state (ECD only), notes on earlier versions with crops, deep links, keyboard Escape steps, mobile bottom card. Crops with the marker drawn are generated on the server and travel to Slack, Asana and email.
- Editor: Figma link field and "Pull frame from Figma" when the token is set.
- Tests: 65 unit tests, 24 end to end tests including pins at 1280 and 390 and the Connections page.

### What to look at first, second session

1. Reviewer link, open "Born For Us, Made For You", click "Leave a note on the design", tap the design, type, Enter. Then drag a box on the design for an area note. Watch the note list, the thread entry with the pin number, and the badge on the card.
2. Admin, same campaign: reply on the note, Mark done, then "Show 1 done note". Notes from older versions keep their crop under "Notes on earlier versions" after a new upload.
3. Admin, Connections: paste a Slack incoming webhook URL, Save, "Send a test message". Then leave a note as the reviewer and watch the channel: the words verbatim, campaign, EM number, version, position, crop and button. Asana needs `ASANA_ACCESS_TOKEN` in `.env` and a project GID; Figma needs `FIGMA_ACCESS_TOKEN` and the frame link in the editor.
4. Deliveries at the bottom of Connections show every Slack, Asana and webhook send with status and a Retry.

### Problems and fixes in this session

- Prisma refuses to regenerate the client while the dev server holds the engine file on Windows. Stop the dev server before `prisma generate`.
- Next forbids extra exports from route files; the env status helper moved to `lib/integrations/env.ts`.
- Designs are very tall, so end to end drags near the middle of the image were outside the viewport. Tests now drag near the top.
- 2026-09-25: Email previews were shrunk to 400px and looked wrong to clients. The drawer now shows designs at their real width with zoom controls (minus, plus, Fit, percentage) and a wider preview column. Verified at 1280 and 390 with screenshots.

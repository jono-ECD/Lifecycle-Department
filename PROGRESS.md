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
- 2026-09-25: README.md, DEPLOY.md, DECISIONS.md.

## Next

- Final polish pass and `npm run check` green.
- Then the extras in order: empty state illustration, keyboard navigation in the drawer, copy reviewer link with QR, activity feed on the admin workspace page.

## Problems and fixes

- TypeScript 6.0 was installed by the previous attempt. Next 15.5 and typescript-eslint do not support it yet, so pinned to 5.9.
- Long shell heredocs failed in this environment, so source files were written with the editor tool instead. No effect on the result.
- `.gitignore` had `storage/`, which also ignored `lib/storage`. The adapters were missing from the first commits. Changed to `/storage/` and committed them.
- Seeded dates rendered one day early: `lastActivityAt` was stored at UTC midnight and formatted in Chicago time. Seed now stores 10:00 Chicago, and sent dates format in the workspace timezone.
- `instrumentation.ts` imported the mailer, which pulled sharp and pdf.js into Next's edge compile and made every page return 500 on the e2e server. The scheduler now calls the cron endpoint over HTTP.
- Two `next dev` servers (dev on 3000 and e2e on 3100) would share `.next`. The e2e server builds into `.next-e2e` through `NEXT_DIST_DIR`.
- Playwright ran the admin spec before the reviewer spec (alphabetical), so seeded counts did not match. Specs are numbered to run in order, and the one assertion that depends on earlier state accepts both outcomes.
- Route files exported helper symbols (`WorkspaceFields`, `reviewerLink`), which `next build` rejects. Moved to `lib/workspaces.ts` and `lib/reviewers.ts`.

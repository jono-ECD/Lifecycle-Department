# Decisions

Choices that HANDOFF.md did not make. One line of reasoning each.

## Tooling

1. Plain CSS instead of Tailwind. The prototype CSS is ported verbatim and is the source of truth, so a utility framework would only add a second way to say the same thing.
2. Playwright browsers install into `node_modules/playwright-core/.local-browsers` (`PLAYWRIGHT_BROWSERS_PATH=0`, set by `scripts/pw.mjs`). Keeps every write inside this folder.
3. npm cache lives in `./.npm-cache` (already set in `.npmrc` by the previous attempt). Same reason.
4. TypeScript pinned to 5.9. Next 15.5 and typescript-eslint do not support 6.0 yet.
5. `npm run seed` and `npm run dev` copy `.env.example` to `.env` when `.env` is missing, so a fresh clone runs with zero setup.
6. Tiny `.env` loader in `lib/env.ts` for scripts that run outside Next (seed, cron, Playwright). No dotenv dependency.
7. End to end tests run on port 3100 with their own database (`e2e.db`), storage folder and `.next-e2e` build folder, so `npm run check` never touches `dev.db` or a running dev server.
8. Test files are numbered (`01-reviewer`, `02-admin`) because they share one seeded database and run in order.
9. `prisma/schema.postgres.prisma` is a copy of the SQLite schema with only the provider changed. Prisma cannot read the provider from env, and two files are simpler than a generator step.

## Data and dates

10. Calendar dates are `YYYY-MM-DD` strings in the workspace timezone, stored as `DateTime` at UTC midnight. Timestamps are real instants and are formatted in the workspace timezone. No date library.
11. Status, type and comment kinds are plain strings validated with zod, not Prisma enums, so the schema is identical on SQLite and Postgres.
12. Every status change writes one thread entry with `fromStatus` and `toStatus`. The body is the reviewer's note when there is one, otherwise a fixed line such as "Approved." This matches the prototype, which pushes the note or "Approved.", while keeping the full history.
13. Request changes sends the campaign to draft, exactly as the prototype does.
14. New versions are stored next to old ones under `campaigns/<id>/v<n>/`. The thread entry for each upload links to that version's files once a newer version exists.
15. The seed adds two scheduled campaigns (12 in total) rather than changing the statuses of the prototype's ten, so the headline still reads "2 campaigns ready for your review. 1 approved in the bank, 3 on hold." and the window strip is not empty.
16. The seed replaces the Blessed Botanicals workspace on every run and keeps the admin, so it is a reset button.
17. Seeded timestamps are set to 10:00 Chicago time so they show the intended day in the workspace timezone.

## Auth

18. Opening `/r/<token>` sets the cookie and redirects to `/bank`. The reviewer can bookmark either. `/bank` without a session shows the "link is not active" page.
19. Admin sessions last 30 days, reviewer sessions 90 days as specified. Both are iron-session cookies encrypted with `SESSION_SECRET`.
20. Emails to reviewers use stateless signed links `/e/<reviewerId>.<expiry>.<hmac>` valid 45 days, because personal tokens are stored only as hashes and cannot be put in an email. Revocation still applies because the reviewer row is checked on every open.
21. A fixed development reviewer token (`SEED_REVIEWER_TOKEN` in `.env.example`) keeps the link in PROGRESS.md working across reseeds. DEPLOY.md says to unset it in production.
22. Admin passwords use bcryptjs (pure JS, no native build).

## Bank page and drawer

23. Gallery cards use the 480px thumbnail; the drawer shows the original at full size and each image opens full size in a new tab.
24. PDFs show as a card in the drawer (with a page 1 thumbnail when rasterizing worked) that opens the browser's viewer in a new tab, instead of an inline iframe. Inline PDF frames on iOS Safari show one page and trap scrolling, and the drawer is mobile first.
25. On phones the drawer is a bottom sheet at 92% height: the preview on top (pinch to zoom), then the same side panel as desktop. The prototype hid the preview on small screens; HANDOFF asks for it.
26. Gallery cards are `div role="button"` rather than `button` so the admin edit pencil can be a real link inside them.
27. The list view shows "Sends Oct 3" for scheduled campaigns and "Date passed" for late ones; the prototype had no scheduled items to define this.
28. Late scheduled campaigns (date passed, still scheduled) are flagged for admins only: a stripe on the card, a line in the drawer, and the list column. Reviewers see nothing different.
29. Polling every 30 seconds on the bank page, paused while the tab is hidden or an action is in flight. The response of every action returns the fresh bank payload so the page never shows stale state after a click.
30. A "Send note only" button appears under the note box when it has text, for comments without a status change. Comments never trigger emails.
31. Admin sees "Note to the reviewer" instead of "Note to ECD" and "ECD admin <name>" instead of "Reviewing as".
32. Admins can set any status from the campaign editor; scheduling from there still respects blocked days and the per day limit, and today is allowed.
33. "Move to review" is offered to admins on drafts only. Admin captions are short and internal, so they do not follow the client copy rules, but they follow them anyway.
34. The workspace mark is resized to 160px tall PNG on upload. Without a mark the header shows the workspace initial.

## Notifications

35. Resend is called over plain `fetch`, no SDK, tested against a fake fetch.
36. The review digest timer is in process and keyed per workspace; the persisted flag is `Campaign.reviewNotifiedAt`. The cron endpoint and the scheduler flush any pending digest whose window has passed, so a restart delays an email at most until the next cron tick.
37. Reminders are due at or after 9:00 workspace time and deduplicated per workspace per day through `NotificationLog.dedupKey`, so an hourly cron is enough and never double sends.
38. The in-process scheduler calls the cron endpoint over HTTP instead of importing the mailer, because `instrumentation.ts` is compiled for every runtime and pulling sharp and pdf.js into it broke the edge compile.
39. Reminder copy: "N campaigns are ready when you are". No guilt, no lead times.
40. The `sendProvider` extension point is `lib/sendProvider.ts`; mark as sent calls it and the default provider does nothing.

## Extras

41. Arrow keys in the drawer move through the currently filtered and sorted list, not the whole bank, so the order matches what the reviewer sees. Keys are ignored while typing in the note box.
42. "Copy link" for an existing reviewer issues a signed 45 day link (`/e/<sig>`) with a QR code instead of rotating the personal token, so a link already saved on the phone keeps working.
43. The admin workspace page shows the last 8 thread entries under the bank; the full list stays on the Activity page.
44. SQLite files live in `prisma/` because Prisma resolves `file:./dev.db` relative to the schema, not the project root. The e2e server deletes `prisma/e2e.db` before each run so every run starts clean. `prisma db push --force-reset` was not used because Prisma refuses it from AI agent sessions without explicit consent.

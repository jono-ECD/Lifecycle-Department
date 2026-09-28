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

## Connections and pinned notes (second session, 2026-09-25)

45. Slack is one channel per client workspace through an incoming webhook, as chosen. A "quiet" toggle keeps only change requests and notes; by default everything posts, one line per status change.
46. Asana gets a task for every change request, plain note and pinned note from the client, with the words of the client first and verbatim, then campaign, email number, version, position, status and links. The crop of the marked area is attached. Replies become task comments and marking a note done completes the task. ECD's own actions never create tasks.
47. Agency tokens (Asana, Figma) live in env, per client targets live in the database. One token, many clients.
48. Every outbound delivery is a row in `IntegrationEvent` (an outbox). Delivery is attempted at once, failures retry with backoff from the cron endpoint, and the Connections page shows the log with a Retry button. Nothing is sent unless a target is saved, so the log stays empty for unconnected clients.
49. A generic signed webhook per workspace (HMAC SHA-256 in `X-Bank-Signature`) covers Zapier, Make, n8n and anything not built yet.
50. Pinned notes follow Figma's model: a comment mode, click to place a numbered pin, a composer right next to it, threads with replies, a list in the side panel, resolved notes hidden behind a toggle, numbers that never change. Two differences on purpose: drag to mark an area (clients think in areas), and "Done" instead of "Resolve" with only ECD allowed to mark it, as chosen.
51. Pins are stored as fractions of the image and belong to one asset and version, so they stay put at any size and never float over a newer version. Notes from earlier versions are listed with their crop so they are not lost.
52. A crop of the marked area with the marker drawn on it is generated on the server when a note is created. It travels to Slack, Asana and email so ECD can do the edit without opening the app. On localhost the Slack image block is skipped (Slack cannot fetch it) and the URL is still in the text.
53. Deep links `?c=<campaign>&pin=<number>` open the drawer on the exact note. Emails, Slack buttons and Asana notes use them.
54. On phones the note composer and thread are a fixed card at the bottom of the screen instead of a popover next to the pin, so they never end up clipped inside the scrolling preview.
55. Figma groundwork: campaigns keep a Figma link, admins can pull the frame as a new version once `FIGMA_ACCESS_TOKEN` is set, and the client can list a file's frames and comments. Importing Figma comments as pins is possible later because the API gives node offsets.
56. Pinned notes from the client email admins like other reviewer actions. Replies from ECD do not email the client (HANDOFF rule on comments) but show on the next open and in polling.
57. The drawer shows an email at its real width (100%) by default, with zoom from 50% to 200% and a Fit toggle, like Figma. The drawer grew to 1140px so a 600 to 640px email fits next to the side panel. Exports wider than 900px are treated as 2x and halved, so a 1200px Figma export still reads as a 600px email. Pins are fractions, so zoom never moves them.

## Figma import, content calendar, Klaviyo (third session, 2026-09-28)

58. Figma import is a picker, as chosen: paste a file link, tick frames, import. Frames named with EM1, EM2 are combined into one campaign by default, because that is how ECD already names multi email campaigns. The tick order is the email order.
59. Imported campaigns store the file key and frame ids, so "Pull the latest from Figma" makes the next version without re-picking. Frames render at 2x; the drawer halves anything wider than 900px, so a 600px frame shows as a 600px email.
60. The scheduler is a spreadsheet, as chosen. It is read through the sheet's CSV export with link sharing, so no Google account or API key is involved. Any CSV URL works, which covers Excel.
61. The reader finds the header row and the date and name columns on its own and accepts the date formats people type, with US month first order for slashes. When the sheet gives no year it picks the year closest to today. ECD can name the columns when the guess is wrong.
62. One shared agency sheet is supported through a filter column and value per client, since a sheet per client is unlikely.
63. Planned days count as taken, as chosen. A planned line and a bank campaign with the same name count as one send, and that campaign may take its own planned day. Names match when equal after removing punctuation, or when one contains the other and the shorter is at least 8 characters.
64. The sheet is read every 15 minutes by the cron endpoint or the in process scheduler, plus "Sync now". Each read replaces the stored items, so deleting a row in the sheet removes it from the calendar.
65. Klaviyo keys are per client, entered in Connections, encrypted with AES-256-GCM using a key derived from `SESSION_SECRET`, and never returned to the browser. Only a hint like `pk_••••6789` is shown.
66. Klaviyo results refresh every three hours. The reporting endpoint allows 2 calls a minute and 225 a day, and one call returns the last 12 months for every campaign.
67. Revenue is attributed to the Placed Order metric, preferring the store integration (Shopify and similar). When an account has no such metric, revenue is left empty instead of showing a wrong number.
68. Open and click rates are computed from unique opens and clicks over delivered, and the 90 day summary weights rates by recipients so a small send cannot skew it.
69. Sent history is the union of campaigns marked sent in the bank and campaigns Klaviyo reports as sent. A Klaviyo send never marks a bank campaign as sent on its own; ECD still confirms, as HANDOFF requires.
70. Results are visible to the client, as chosen. The link control for unmatched Klaviyo emails is ECD only.
71. Sample mode (`ENABLE_DEV_MOCKS=1`) serves stand ins for Figma, Klaviyo and a calendar sheet from the app itself, so the features can be tried and tested end to end with no accounts. It is on in the local `.env` and in the e2e server, commented out in `.env.example`, and answers 404 when off.
72. `prisma db push` without `--force-reset` was used for the new tables. It is additive and keeps existing data.

## Aligning with the architecture plan (fourth session, 2026-09-28)

73. The plan's rule "each field has exactly one writer" is adopted as the integration design. `COMPARISON.md` maps every row of its field ownership table to code.
74. Two statuses were added to the prototype's six: "Changes requested" and "Date requested". A change request used to fall back to Draft, which would now hide the campaign from the client who commented on it. A client picking a date used to read "Scheduled" before anyone had scheduled anything.
75. A client picking a date is a request. It holds the day so two requests cannot collide, and only ECD, Asana Stage or Klaviyo turn it into Scheduled. This replaces the earlier behaviour where the client scheduled directly. Clients can no longer unschedule, because Scheduled now means it is really in Klaviyo.
76. An approval stores the version, the person and the time. A new version voids it for campaigns that were approved, had a date requested, or had changes requested, and sends them back to review. Scheduled and sent campaigns are left alone, because ECD already acted on them.
77. The editor warns before a new version voids an approval, so ECD never does it by accident.
78. Clients do not see drafts, the plan's default for D6. A per workspace switch turns it on. The prototype showed drafts; the plan's reasoning (unfinished work should not reach the client) wins.
79. Approver or commenter is per reviewer, the plan's D4. Commenters can still leave notes and pin notes on the design.
80. ECD has two roles, admin and editor, from the plan's data model. Editors cannot manage team, connections or workspaces, and cannot delete campaigns.
81. Asana is the source of campaigns when a project is connected. Campaigns are keyed on the task id. Campaigns can still be created by hand or from the Figma picker, for clients whose work is not in Asana.
82. When a campaign has its Asana task, feedback is a comment on that task and Stage moves with the decision, as the plan says. Notes pinned on the design become subtasks of that task, which keeps the earlier choice of one to do per note. Without a linked task, a new task is created as before.
83. Stage is bound by field id and option id. The Connections screen loads the project's dropdown fields, warns when two share a name (the plan's hygiene flag), guesses the mapping from option names, and stores ids once ECD confirms.
84. The Bank remembers the Stage value it wrote on the campaign. A pull that sees that same value treats it as its own echo and changes nothing.
85. An unknown or unmapped Stage option never changes a status. It is listed as a sync problem instead of being guessed.
86. Tasks the Bank cannot read are listed in Connections with the reason, one row per distinct problem, and clear on their own after the next pull that reads the task cleanly.
87. SMS copy comes from a "Copy:" line in the task notes and runs until the next template label. Only known template labels end it, because SMS copy itself often contains a colon.
88. Polling, not webhooks, as the plan argues: a missed run is caught by the next, and no public endpoint is needed. Asana every five minutes; the cursor only moves after a full successful pass.
89. Figma changes are noticed by asking each file for its last modified time, one cheap call per file, and re-rendering only when it changed. A content hash then skips frames that did not change.
90. The Campaign Bank tab is offered two ways. The feed link needs no Google account and refreshes about hourly through IMPORTDATA. The Sheets API path rewrites the tab after every change and needs a service account. Both write the same rows.
91. The calendar grid is never written, the plan's D2. It is only read, to show planned days.
92. The content calendar reader now also reads a calendar drawn as a month grid, because the plan says the Scheduler sheet is one. Day numbers of the month before and after are dated correctly. The real sheet has not been seen, so this is a best reading of the description.
93. Klaviyo moves a status only when the link is sure: the campaign id from the Asana task, or a link made by hand. A match by name attaches results but never moves a status.
94. The outbox has a unique key per job, checked in code rather than by a database constraint. Adding the constraint made `prisma db push` ask to accept data loss, which would have blocked `npm run seed` for everyone.
95. Jobs that fail five times are parked as "gave up" and stay visible with a Retry button.
96. Offer windows are optional fields on the campaign. The slot picker and the server both enforce them.
97. Listed send days are a per workspace setting, off by default. The plan has ECD supply the slots; the prototype treats every day as open. Both are available.
98. Revision analytics were built now although the plan lists them as backlog, because the thread already held everything needed.
99. The stack stays Next.js and Prisma instead of Supabase with Vite. The behaviour the plan asks for is present and tested, and rebuilding on another stack would cost the tests and the time already spent. Supabase can still be the database and the storage. The one thing not matched is row level security; isolation is enforced in the application and proven with a second tenant test.
100. Existing data was kept. The schema change was additive, and `scripts/backfill-approvals.mjs` gave earlier approvals their record from the thread instead of reseeding.

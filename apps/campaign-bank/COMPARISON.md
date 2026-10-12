# Architecture plan compared with what is built

Source: "Campaign Bank Architecture", MVP architecture draft, Sep 28, 2026, marked "Not built".
Compared against this repository on the same day.

Short version: the plan describes a six slice build. Slices 1 to 5 exist and are tested. Slice 6 (the parallel run and retiring the reviewer sheet) is a process step, not code. Several items the plan puts after the MVP are also built. The stack differs from the one the plan recommends, and that is the one real decision left.

## The one rule: each field has exactly one writer

Adopted as written. The table below is the plan's field ownership table with where each row lives in the code.

| Field | Owner | How it is enforced |
|---|---|---|
| Campaign exists, name, planned date, channel | Asana task | `lib/integrations/asanaSync.ts` reads them on every pull and overwrites the Bank's copy. The Bank never writes them to Asana. |
| Production stage | Asana Stage | Read on pull, shown in the admin drawer. Bound by field id and option id. |
| Design pixels | Figma frame | Rendered at 2x and copied into our storage. Figma URLs are never stored as the image. |
| Client decision: approve, changes, hold | Bank | `lib/actions.ts` is the only way a status changes. Asana gets Stage and a comment through the outbox. |
| Client notes and thread | Bank | Thread entries, written to Asana as comments. |
| Requested send date | Bank | Status "Date requested". Asana gets a comment, the sheet tab gets the date. |
| Scheduled and sent | Asana Stage, Klaviyo | Inbound only. Asana Stage or a Klaviyo campaign linked by id moves the Bank. A client can never set them. |
| Promo calendar, offers, codes | Scheduler sheet | Never written. Read only, to show planned days. |

Echo suppression: when the Bank writes a Stage value it records it on the campaign, and the next pull that sees that same value ignores it.

## Design principles

| Principle in the plan | Status | Notes |
|---|---|---|
| Each field has one writer | Built | See above. |
| The Bank owns decisions, other systems own work | Built | |
| An approval covers one design version | Built | New in this pass. The approval stores version, person and time. A new version voids it and reopens review, with the reason written in the thread. |
| A client click never waits on a third party API | Built | The decision is saved first. Slack, Asana, the webhook and the sheet tab go through an outbox with retries and a unique key per job. |
| Picking a date is a request | Built | New in this pass. The client's pick becomes "Date requested" and holds the day. Only ECD, Asana Stage or Klaviyo make it "Scheduled". |
| Multi tenant from day one | Built | Every query is scoped to a workspace. A second tenant test runs in the suite. |

## Statuses

| Plan | Built | Notes |
|---|---|---|
| Draft | Yes | Hidden from clients by default (decision D6), switchable per workspace. |
| In review | Yes | Entered by ECD, or by Asana Stage "Client Review" once a design exists. |
| Changes requested | Yes | New in this pass. Before, a change request fell back to Draft. |
| Approved | Yes | Tied to a version. |
| On hold | Yes | |
| Date requested | Yes | New in this pass. |
| Scheduled | Yes | Inbound from ECD, Asana or Klaviyo. |
| Sent | Yes | Inbound from ECD, Asana or Klaviyo. |

## Build order in the plan

| Slice | Plan | Status |
|---|---|---|
| 0 | Decisions and credentials | Decisions defaulted as the plan says. Credentials still to be created: Asana bot user, Figma token, Google service account (optional). |
| 1 | Core bank: schema, access rules, transition, login, UI, manual upload | Built and tested. |
| 2 | Asana inbound: pull, create or update campaigns, map Stage | Built and tested against a stand in for Asana. Not yet run against the real workspace. |
| 3 | Figma import: render, store, version, void approval on change | Built and tested against a stand in. Unchanged frames are skipped by content hash. |
| 4 | Asana outbound: queue worker, Stage updates, comments | Built and tested. A test proves one comment and one Stage write per decision. |
| 5 | Sheet tab | Built two ways: a feed the sheet imports with no credentials, and the Sheets API with a service account. |
| 6 | Parallel run with the reviewer sheet, then retire it | Process, not code. Ready to start once credentials exist. |

## Open decisions in the plan

| # | Decision | What was done |
|---|---|---|
| D1 | Does the Bank replace the reviewer sheet? | Default taken: yes, after a parallel run. |
| D2 | Dedicated tab, or write into the calendar grid? | Default taken: a dedicated "Campaign Bank" tab. The grid is never written. |
| D3 | Stage mapping | Default mapping, editable per client in Connections. The Bank never touches Final Approval. |
| D4 | Who approves, who comments? | Per person. Each reviewer is an approver or a commenter. |
| D5 | Which of the two Stage fields is real? | The Connections screen lists both with their ids, warns that two share a name, and binds to the one ECD picks, by id. |
| D6 | Do clients see Draft? | Default taken: no. A per workspace switch exists. |
| D7 | Where does the code live? | Its own repository, as the plan suggests. |

## Risks in the plan

| Risk | Mitigation in the plan | Status |
|---|---|---|
| What is approved in Figma differs from what is built in Klaviyo | Tie approval to a version now, Klaviyo proof later | Version tie built. Klaviyo proof render not built. |
| The notes template drifts and links stop parsing | Parse failures show in app | Built. Each unreadable task is listed in Connections with the reason, and clears once fixed. |
| An Asana field or option is renamed or duplicated | Bind by id, unknown option raises an error | Built. An unmapped option leaves the status alone and is listed. |
| A client picks a date ECD cannot honour | ECD supplies slots, offer window filter, date is a request | Built. Listed send days are optional per workspace. |
| One client sees another client's data | Rules on every table, tested with a second tenant | Tested with a second tenant. Enforced in the application, not by database rules. See the stack section. |
| Scope creep delays the sheet retirement | Wait until slice 6 | Nothing here blocks slice 6. |

## Built beyond the plan

These are not in the plan, or are listed there as after the MVP.

| Feature | Plan says |
|---|---|
| Notes pinned on the design, like Figma comments, with threads and crops | Not in the plan |
| Slack channel per client, with the client's words verbatim and the crop | Not in the plan |
| Klaviyo reads: results per sent email, sent history for ECD and the client | Phase 2 |
| Scheduled and sent taken from Klaviyo when the campaign id is known | Phase 2 |
| Revision analytics: time to approve, rounds per campaign, hold rate | Backlog |
| Figma picker: browse a file, tick frames, import several at once | Plan imports one frame per task link |
| Reading the promo calendar to show planned days, as rows or as a month grid | Plan does not sync the calendar |
| Signed generic webhook for Zapier, Make, n8n | Not in the plan |
| Reminder emails for reviews older than three days | Not in the plan |
| Editor and admin roles for ECD | In the plan's data model |

## Not built

| Item | Why |
|---|---|
| Asana and Figma webhooks | The plan itself puts polling first. Polling is built. |
| Klaviyo proof render of the built template | Phase 2 in the plan. |
| Turning recurring client notes into QA checklist items | Backlog in the plan. |
| Flows and PostPilot pieces | Backlog in the plan. |
| Client requests that create Asana tasks | Backlog in the plan. |
| Magic link sent by email on demand | Clients get a personal link and signed links inside every email, which covers the same need. |

## Where the build differs from the plan

### Stack

| Layer | Plan | Built |
|---|---|---|
| Database | Supabase Postgres | Prisma. SQLite for local use, a Postgres schema ready. Supabase Postgres works as the database with no code change. |
| Tenant isolation | Row level security | Application level checks on every query, plus the second tenant test. |
| State machine | Postgres function `transition()` | One TypeScript function, `performAction`, unit tested. |
| Auth | Supabase Auth, magic links | Signed cookies. Email and password for ECD, personal links for clients. |
| Storage | Supabase Storage | Local disk or any S3 compatible store. Supabase Storage is S3 compatible. |
| Jobs | pg_cron and functions | One cron endpoint plus an in process scheduler. |
| Frontend | React, Vite, Tailwind, static host | Next.js with the prototype's CSS ported as is. |
| Email | Resend | Resend. |

What this means in practice: the behaviour the plan asks for is there, and the rules live in one reviewed codebase, which is the plan's own argument against Lovable and Zapier. The trade is row level security. The plan gets isolation from the database itself; the build gets it from the application and proves it with a test. Moving the checks into Postgres policies is possible later if the database becomes Supabase.

### Asana task per note, or comment on the campaign task

The plan writes feedback as a comment on the campaign's task. An earlier choice here was one task per change request. Both now hold: when the campaign has its Asana task, decisions and notes are comments on it and notes pinned on the design are its subtasks. When a campaign has no Asana task, a new task is created as before.

### Slots

The plan has ECD supply the send days. The build defaults to every day being open unless blocked, which is what the prototype does, and offers "only the days ECD opens" as a per workspace setting.

## Verified and not verified

Verified by automated tests, against stand ins for Asana, Figma and Klaviyo: every row marked Built above.

Not verified, because no credentials exist yet: the real Asana workspace, real Figma files, a real Klaviyo account, the real Scheduler sheet, and the Google Sheets API. The plan says the same of its own integration calls. Expect small fixes on first contact with each.

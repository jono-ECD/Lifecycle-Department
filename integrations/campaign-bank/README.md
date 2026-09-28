# Campaign Bank — MVP architecture

> **Status: not built.** This is the build outline for the first version. The UI
> prototype exists (`BB_Campaign_Bank_5.html`, held outside this repo). Nothing
> below has been implemented. None of the Figma, Asana, or Sheets API calls it
> names have been exercised yet. Treat each one as pending until it has been run,
> the same rule `../mcp/tool-map.md` applies.

The Campaign Bank is where a client approves campaigns, sends feedback, holds
work for later, and sees what is scheduled. Approved work sits "in the bank" and
can go into any open send slot where its timing fits.

It is **account-agnostic**: one app, many tenants. Blessed Botanicals is the
first tenant. Its config lives in
[`accounts/blessed-botanicals/platform/campaign-bank.md`](../../accounts/blessed-botanicals/platform/campaign-bank.md),
not here.

---

## 1. The problem it solves

Today one campaign's state is spread across four places, and nothing keeps them
in agreement:

| Where | What it holds | Who edits |
|---|---|---|
| Asana task (one per campaign) | Production stage, links to brief / copy / Figma / Klaviyo | ECD |
| Figma frame | The design | ECD design |
| Mockups Reviewer sheet | Approval status + client notes, free text | Client + ECD |
| Scheduler sheet | Promo calendar, offers, codes | ECD strategy |

The failure this causes is on record: **an email went live without client
sign-off** (see the account's `messaging-constraints.md`). Approval is a free-text
cell with no version, no author, and no timestamp. It can't show *which design*
was approved or *who* approved it.

The Bank gives the approval decision **one home**, ties it to a specific design
version, and pushes the result out to the tools the team already uses. It does not
replace Asana, Figma, or the sheet.

## 2. User journeys (MVP)

**Client approver** (e.g. founder)
1. Gets an email saying something is ready for review. A magic link opens the Bank.
2. Opens a campaign and sees the design at full size.
3. **Approves**, **requests changes** (a note is required), or **puts it on hold**.
4. For an approved campaign, **picks a send date** from the open slots.
5. Later sees it move to *Scheduled*, then *Sent*. The client never does either
   step themselves.

**Client commenter** (e.g. ops lead): can see everything and leave notes, but
can't approve. Approval rights are per person, not per company.

**ECD strategist / designer**
1. Moves the Asana task to *Client Review*. The Bank picks it up and renders the
   Figma frame.
2. Gets client feedback as an Asana comment on that task, with the Stage field
   already updated.
3. Schedules in Klaviyo as today, then sets Asana to *Scheduled in Klaviyo*. The
   Bank shows it as scheduled.

**The team does nothing new.** Asana is still where work moves. The only new
habit is on the client side, and it replaces the reviewer sheet.

## 3. Design principles

1. **Each field has exactly one writer.** Two-way sync is only safe when no field
   is written from both sides. See §5. That rule is the whole integration design.
2. **The Bank owns decisions. Other systems own work.** Approval, feedback, hold,
   and requested date belong to the Bank. Production stage belongs to Asana. Pixels
   belong to Figma. The truth about what's actually scheduled or sent belongs to
   Klaviyo.
3. **An approval applies to one design version.** If a new Figma render arrives
   after approval, the approval is voided and the campaign goes back to review.
   This is the same rule as "copy approved and unchanged between approval and
   build" in `workflows/creative-production.md`.
4. **A client action never waits on a third-party API.** The decision commits
   locally. Side effects go into a queue (outbox) and retry. If Asana is down, the
   approval still counts.
5. **Picking a date is a request, not an action.** Scheduling and sending are
   human-only, per instance (`../mcp/access-policy.md`). When a client picks a
   date, ECD is asked to schedule it. *Scheduled* appears only once ECD has
   actually scheduled it.
6. **Multi-tenant from day one.** Every row carries `account_id`. Row-level
   security enforces isolation. Onboarding account #2 should mean adding config,
   not writing code.

## 4. System architecture

```
                         ┌──────────────────────────────────────────┐
  Client ──magic link──▶ │  Web app (React, ported from prototype)  │ ◀── ECD staff
                         └──────────────┬───────────────────────────┘
                                        │ supabase-js (RLS enforced)
                         ┌──────────────▼───────────────────────────┐
                         │  Supabase                                │
                         │  ├─ Postgres: campaigns, versions,       │
                         │  │  events (audit log), slots, outbox    │
                         │  ├─ transition() — the state machine,    │
                         │  │  one SQL function, writes event +     │
                         │  │  outbox rows in the same transaction  │
                         │  ├─ Storage: rendered design PNGs        │
                         │  ├─ Auth: magic link, roles per account  │
                         │  └─ Edge Functions + pg_cron (workers)   │
                         └───┬──────────────┬───────────────┬───────┘
              inbound pull   │              │ outbound push │ outbound push
              (every ~5 min) │              │ (outbox)      │ (outbox)
                   ┌─────────▼───┐   ┌──────▼──────┐  ┌─────▼─────────┐
                   │   Asana     │   │   Asana     │  │ Google Sheets │
                   │ tasks+Stage │   │ Stage +     │  │ "Campaign     │
                   └─────┬───────┘   │ comments    │  │  Bank" tab    │
                         │ Figma URL └─────────────┘  └───────────────┘
                   ┌─────▼───────┐
                   │ Figma API   │ render frame → PNG → Storage
                   └─────────────┘
```

### Components

| Component | Responsibility | Runs |
|---|---|---|
| **Web app** | Gallery/list, drawer, slot picker, notes. Port of the prototype | Static host (Vercel/Netlify) |
| **`transition()`** | The only way status changes. Checks role + allowed move, writes `events` + `outbox` rows atomically | Postgres function |
| **`asana-pull`** | Lists tasks changed since the last run in the account's campaign section. Upserts campaigns. Reads Stage. Pulls the Figma link | Edge function, pg_cron every 5 min |
| **`figma-import`** | Renders a frame to PNG, copies it to Storage, creates a `design_version` | Edge function, triggered by `asana-pull` or an ECD button |
| **`outbox-worker`** | Delivers queued side effects to Asana/Sheets. Idempotent, with backoff and a dead-letter state | Edge function, pg_cron every 1 min |
| **`notify`** | "Ready for review" email to client approvers | Edge function via outbox (Resend or similar) |

**Why polling instead of webhooks for the MVP.** Polling heals itself: a missed
run is caught by the next one. It also needs no public handshake endpoint and is
easy to reason about. At five-minute latency, nobody on the client side will
notice. Asana webhooks and Figma webhooks are a Phase 2 optimisation, not a
requirement.

**Why an outbox instead of calling Asana from the click handler.** A direct call
couples the client's approval to Asana being up. It also leaves you guessing
after a timeout: did the comment post? The outbox makes the approval durable
first. Delivery happens after, and each job carries an idempotency key, so
retrying can't post a comment twice.

## 5. Field ownership and sync directions

The single most important table in this doc.

| Field | Owner (sole writer) | Flows to | Mechanism |
|---|---|---|---|
| Campaign exists, name, planned date, channel | **Asana** task | Bank | `asana-pull` |
| Production stage | **Asana** Stage field | Bank (read-only display) | `asana-pull` |
| Design pixels | **Figma** frame | Bank `design_versions` | `figma-import` |
| Client decision (approve / changes / hold) | **Bank** | Asana Stage + comment, Sheet tab | outbox |
| Client notes / thread | **Bank** `events` | Asana comment | outbox |
| Requested send date | **Bank** | Asana comment, Sheet tab | outbox |
| Scheduled / sent | **Asana** Stage (MVP) → **Klaviyo** (Phase 2) | Bank | `asana-pull` / Klaviyo read |
| Promo calendar, offers, codes | **Scheduler sheet** (humans) | — | not synced in MVP |

**Conflict rule:** if Asana and the Bank disagree, the owner in this table wins.
**Echo suppression:** when the outbox sets an Asana Stage, it records the option
it wrote. If the next `asana-pull` sees that same value, it treats it as a no-op
rather than a new inbound change.

### Asana Stage ↔ Bank status mapping (default, needs team confirmation)

| Bank status | Entered when | Outbound effect on Asana |
|---|---|---|
| `draft` | Task exists; Stage is Copy … PR & MR | — (not shown to client, see decision D6) |
| `in_review` | Stage → *Client Review* **and** a design version exists | — (inbound) · client notified |
| `changes_requested` | Client, note required | Stage → *Edits In Progress* + comment |
| `approved` | Client approver, pinned to version *n* | Stage → *Build in Klaviyo* + comment "Approved v*n* by *name*" |
| `on_hold` | Client | Stage → *On Hold \| Canceled* + comment |
| `date_requested` | Client picks a slot on an approved campaign | Comment "Client requests *date*" |
| `scheduled` | Inbound: Stage = *Scheduled in Klaviyo* | — |
| `sent` | Inbound: Stage = *Done* (Phase 2: Klaviyo campaign status) | — |

A new design version on an `approved`, `date_requested`, or `changes_requested`
campaign moves it to `in_review`. This is where principle 3 is enforced.

### Sheet write target

The Scheduler's *Promo Calendar* tab is a month grid (days across, weeks down),
not a table. Writing status into a grid means working out cell coordinates from
dates. That breaks the first time someone inserts a row. **Default: the Bank owns
a separate `Campaign Bank` tab** and rewrites the whole tab each sync. Columns:
Asana task, campaign, channel, send date, status, approved by, approved at,
design version, Bank link.

A full rewrite is idempotent and never merges with human edits, because humans
never edit that tab. The calendar tab can pull from it with `XLOOKUP` if the team
wants status visible in the grid.

## 6. Data model

Postgres. Every table has `account_id`, and RLS restricts rows to members of that
account.

```sql
accounts (
  id uuid pk, slug text unique,          -- = accounts/registry.yml slug
  name text, timezone text,
  config jsonb                           -- asana project/section/field gids,
)                                        -- stage option map, sheet id — see tenant doc

members (
  account_id fk, user_id fk → auth.users,
  role enum('client_approver','client_commenter','ecd_editor','ecd_admin'),
  pk (account_id, user_id)
)

campaigns (
  id uuid pk, account_id fk,
  asana_task_gid text unique,            -- the campaign's identity across systems
  name text, subtitle text,
  channel enum('email','sms'),
  type enum('promo','spotlight','education','evergreen'),
  status enum('draft','in_review','changes_requested','approved',
              'on_hold','date_requested','scheduled','sent'),
  asana_stage text,                      -- last seen, display only
  current_version_id fk → design_versions,
  approved_version_id fk → design_versions null,
  planned_date date null,                -- from Asana due date / name
  requested_date date null,              -- client's pick
  valid_from date null, valid_until date null,  -- offer window; null = evergreen
  klaviyo_campaign_id text null,         -- parsed from task, used in Phase 2
  created_at, updated_at
)

design_versions (
  id uuid pk, campaign_id fk, version_no int,
  source enum('figma','upload','sms_text'),
  figma_file_key text, figma_node_id text, figma_last_modified timestamptz,
  image_path text, thumb_path text,      -- Storage paths, never Figma URLs
  sms_body text null,
  content_hash text,                     -- skip re-import if unchanged
  imported_by, imported_at
)

events (                                 -- append-only: the audit log AND the thread
  id bigserial pk, account_id, campaign_id,
  actor_user_id null,                    -- null = system (sync)
  kind enum('status_changed','comment','version_imported','date_requested','sync_error'),
  from_status, to_status, design_version_id null,
  body text, created_at
)

slots (
  account_id, date, capacity int default 1,
  pk (account_id, date)                  -- ECD-defined send days; filled = count of
)                                        -- campaigns with requested/scheduled date

outbox (
  id bigserial pk, account_id, target enum('asana','sheet','email'),
  idempotency_key text unique, payload jsonb,
  status enum('pending','done','dead'), attempts int, next_attempt_at, last_error
)

sync_cursors (account_id, source text, cursor text, updated_at)
```

Two choices worth understanding:

- **`events` is both the audit trail and the comment thread.** The prototype's
  `thread` array is a view over it. One table means the history the client sees is
  exactly the history an auditor would see.
- **Slots are explicit rows, not "every empty day".** The prototype treats every
  day as open. In reality send capacity is limited by cadence (~15/month) and
  deliverability. ECD controls the supply. The picker also filters by the offer
  window, so a promo can't be dropped after its code expires. Evergreen work
  (`valid_until` null) fits any open slot. That rule is what makes a bank of
  approved work useful.

## 7. Integrations in detail

All credentials are Supabase secrets, never in any repo.

### Figma — import designs
- **Auth:** a Figma access token from an ECD account that can view the client's
  design files (OAuth app later).
- **Input:** the `figma.com/design/<file_key>/…?node-id=<id>` link, already in
  each Asana task's notes under `Design:`.
- **Calls (unverified here):** `GET /v1/files/:key/nodes?ids=` for
  `lastModified`, then `GET /v1/images/:key?ids=&format=png&scale=2` to render.
- **Copy the PNG into Storage.** Figma's export URLs expire, per Figma's docs. So
  the Bank must never store or show a Figma URL.
- **Change detection:** if `lastModified` or the image hash differs from the
  current version, create version *n+1*. Principle 3 then applies.
- **SMS has no frame.** `source = 'sms_text'` takes the copy from the task and
  renders a phone-bubble preview. The reviewer sheet already mixes SMS rows in, so
  this is MVP scope, not an extra.

### Asana — route updates to the right task
- **Auth:** a dedicated bot user (e.g. "ECD Campaign Bank") with a personal access
  token. That makes comments clearly attributable, and it doesn't depend on any one
  staff member.
- **Inbound:** list tasks in the account's campaign section with
  `modified_since = cursor`. Filter `Type of Work ∈ {Email, SMS}`. Parse
  `Design:` / `Klaviyo:` links from the notes.
- **Outbound:** `PUT /tasks/:gid` setting the Stage custom field by **field gid
  and option gid**, never by name. Plus `POST /tasks/:gid/stories` for the
  comment, written as *"[Client name] via Campaign Bank: …"*.
- **Parsing notes is the fragile part.** It works because the team uses a
  consistent notes template. Phase 2: add *Figma frame* and *Klaviyo campaign* as
  Asana custom fields and read those instead.

### Google Sheets — calendar projection
- **Auth:** a Google service account with editor access to the Scheduler sheet
  only.
- **Outbound only:** `values.clear` + `values.update` on `'Campaign Bank'!A1`.
  This is debounced: at most one rewrite per minute per account.

### Klaviyo — Phase 2, read-only
- The Klaviyo campaign ID is already in each task. Reading campaign status confirms
  *scheduled / sent* from the real source rather than the Asana Stage. It would
  also allow a final proof: rendering the built template, so the client approves
  what will actually be sent, not just the Figma frame.
- Allowed under `read_only`. **Unverified:** `get_campaign` is still listed as
  pending in `../mcp/tool-map.md`.
- The Bank never writes to Klaviyo. Scheduling stays a human action.

## 8. Tech stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| DB, auth, storage, functions | **Supabase** | One service for everything above. RLS is the tenant-isolation mechanism. Already connected |
| Frontend | **React + Vite** (or Next.js), Tailwind | The prototype is already component-shaped. Porting it is cheap |
| Build tooling | **Claude Code in a new `campaign-bank` repo** | You own the code and the migrations. The integration layer needs real review. Most learning value |
| Hosting | Vercel or Netlify | Static frontend; the backend is Supabase |
| Email | Resend (or Klaviyo transactional later) | Magic links + "ready for review" notices |

**Alternatives considered:**
- **Lovable** is faster to a first screen. It's fine for the UI shell. But the
  outbox, state machine, and RLS are where the bugs will be, and you want those
  under your own review.
- **Zapier/Make** could wire the Asana/Sheet side quickly. But it hides the state
  machine, can't do the version-pinned approval cleanly, and becomes a second
  place where the rules live.
- **Asana proofing / Filestage-style tools** handle approval, but not the "bank +
  slots" model or ECD branding, and the client UX is the point. Worth a 30-minute
  check before building, not a reason to stop.

## 9. Build order

Each slice is usable on its own. Stop after any slice and you still have
something that works.

| # | Slice | Done when |
|---|---|---|
| 0 | **Decisions + credentials** (§10) | D1–D7 answered or defaulted; bot user, service account, Figma token created |
| 1 | **Core bank**: schema, RLS, `transition()`, auth, ported UI, manual image upload | A client can approve/hold/request changes on an uploaded image. Every action shows up in `events` |
| 2 | **Asana inbound**: `asana-pull`, campaign upsert, Stage → `scheduled`/`sent` | Moving a task to *Client Review* makes the campaign appear in the Bank |
| 3 | **Figma import**: render, store, version, invalidate approval on change | A task with a Figma link shows the real design. Editing the frame re-opens review |
| 4 | **Asana outbound**: outbox worker, Stage update, comments | A client note appears on the right task within a minute, exactly once |
| 5 | **Sheet projection**: `Campaign Bank` tab | The tab matches the Bank after every change |
| 6 | **Parallel run** with the Mockups Reviewer sheet, ~2 weeks, then retire it | Zero campaigns approved outside the Bank. The account's approval-process text is updated |

Slice 1 comes first even though it has no integrations. Every later slice writes
into its tables, and the state machine is the part you can't change cheaply once
clients have used it.

## 10. Open decisions (each has a default, so nothing blocks)

| # | Decision | Default if unanswered |
|---|---|---|
| D1 | Does the Bank **replace** the Mockups Reviewer sheet as the approval record? | Yes, after the slice 6 parallel run |
| D2 | Sheet target: dedicated tab vs writing into the calendar grid | Dedicated `Campaign Bank` tab |
| D3 | The Stage mapping in §5, especially: is *Final Approval* a client step? | As in §5. *Final Approval* is not touched by the Bank |
| D4 | Which client contacts can approve vs only comment | Founders approve; everyone else comments |
| D5 | The BB project has **two custom fields named "Stage"** — which is canonical? | The one in the project's field settings (see the tenant doc). Bind by gid |
| D6 | Do clients see `draft` campaigns? (The prototype shows them) | No. Clients see `in_review` onward, plus `on_hold` |
| D7 | Code location | A separate `campaign-bank` repo. This repo keeps the spec and tenant config |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Approving the Figma frame ≠ what's built in Klaviyo | Pin to version now. Phase 2 Klaviyo render proof before `scheduled` |
| Asana notes format drifts, so links stop parsing | `sync_error` event shown to ECD in-app. Phase 2 custom fields |
| Duplicate/renamed Asana fields break the mapping | Everything bound by gid in tenant config. Unknown option → `sync_error`, never a guess |
| Client picks a date ECD can't honour (cadence, deliverability ceiling) | Slots are ECD-supplied rows; the picker filters by offer window. The date is a request |
| Cross-account leak (the most damaging error in this repo) | RLS on every table, tested with a second fake tenant before BB goes live |
| Scope creep before slice 6 ships | Everything in §12 waits until the reviewer sheet is retired |

## 12. After the MVP (backlog, not now)

- Asana + Figma webhooks, replacing polling
- Klaviyo read: real scheduled/sent status, and a proof render of the built template
- Revision analytics from `events`: time to approve, rounds per campaign, hold
  rate. This feeds `reporting/` and the monthly strategy call
- Feedback mining: recurring client notes (e.g. "discount code missing") become
  checklist items in `execution.campaign-flow-qa`
- Flows and PostPilot pieces in the same bank
- Client-initiated requests ("can we do a Sea Moss spotlight?") creating Asana tasks

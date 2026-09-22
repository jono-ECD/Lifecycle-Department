# MCP skill roadmap — working session

- Owner: Jono
- Status: draft — the agenda for the session that settles this
- Last reviewed: 2026-09-22

The Klaviyo joint project has two halves: build skills for the Klaviyo MCP tools,
and test Composer Preview. This document runs the session that decides what we
build, in what order, and who owns each piece.

**Read the three findings below before the session.** They change the questions,
and rediscovering them in the room costs half the meeting.

---

## Three findings that reshape the agenda

### 1. Four of the six proposed skills already have a home here

The proposed list maps almost entirely onto skills that are already scaffolded or
already named in `skills/CATALOG.md`. The session's job is **promotion and tool
binding**, not a new taxonomy. A second, parallel "MCP skills" library would
duplicate the one we have and split maintenance permanently.

| Proposed | Existing home | State today |
|---|---|---|
| Customer Profile / Persona | `marketing-strategy.customer-persona`, `.target-audience` | `draft` — purpose and inputs settled, procedure not written |
| Flow Builder | `execution.flow-architecture` (planned) + `workflows/flow-architecture.md` | No folder. Workflow steps not written |
| Campaign & Omni-Campaign Builder | `execution.campaign-brief` (planned) + `workflows/multi-campaign.md` | `multi-campaign.md` is our reference workflow — the most complete thing we have |
| Segments (RFM, cohort) | `execution.segmentation` (planned) | Named in the catalog, no folder |
| Reporting & Testing | `marketing-strategy.account-growth-analysis` + `workflows/growth-analysis.md` | `draft`; workflow requires a live connector |
| Creative Design | `execution.email-design` + `execution.creative-direction` (planned) | **`email-design` is written, detailed, and has a mechanical validator** |

`execution.email-design` is the proof of pattern. It has a real procedure, a
`scripts/validate_dnd.py` gate, explicit tool boundaries, and it produces a JSON
artifact reviewable in a PR. Every skill on this list should be built to that
shape. Nobody should start from a blank template.

### 2. Four of the six depend on capability we have not verified, and are not authorized for

`integrations/mcp/tool-map.md` lists **seven verified capabilities. All seven are
reads.** Zero writes have been exercised. `integrations/mcp/access-policy.md`
records that **no account has a named owner**, which caps every account at
`read_only` — including the two with connectors.

| Skill | Needs | Status |
|---|---|---|
| Flow Builder | `create_flow`, `update_flow` | Unverified **and** unauthorized |
| Campaign Builder | `create_campaign`, `assign_template_to_campaign_message` | Unverified **and** unauthorized |
| Segments | `create_segment` (build) / `get_segments` (read) | Unverified; reads authorized, writes not |
| Reporting & Testing | `get_campaign_report`, `get_flow_report`, Hiro | Unverified; reads authorized |
| Customer Persona | `get_profiles`, `query_metric_aggregates` | Unverified; reads authorized |
| Creative Design | `create_dnd_email_template` | Unverified **and** unauthorized |

Three of five registry accounts have **no connector at all** (Exzell Pharma,
Something Borrowed Blooms, Bad Boy Mower Parts). Anything data-dependent runs for
Blessed Botanicals and Lazy Leaf only.

The consequence: if we assign six skills and no owners, we spend a sprint writing
procedures that cannot be run or delivered from. **Naming owners is the unlock,
not writing more skills.**

### 3. "Convert Composer skills to MCP skills" is the wrong direction — they are two halves of one skill

The Composer brief is explicit on Job 7: *"keep the skill about your own working
method. Skills that need to reach into outside tools aren't wired up yet."*

So the two runtimes take different halves of the same document:

| SKILL.md section | Composer custom skill | MCP / Claude Code |
|---|---|---|
| Purpose, Required inputs, Output | ✅ | ✅ |
| Quality checks | ✅ — this is most of Composer's value | ✅ |
| Account customization | ✅ | ✅ |
| Instructions (tool calls, file paths) | ❌ no tool access | ✅ |
| Tools and action boundaries | ❌ | ✅ |

Converting in either direction creates two copies that drift. The durable version
is **one SKILL.md in this repo, projected into two runtimes** — Composer gets the
method and QA half, MCP gets the whole thing. That keeps `skills/` the single
source of truth and makes Composer a delivery surface, which is exactly what
`integrations/klaviyo-composer/README.md` already says it should be.

This reframes one agenda item from "conversion work" to "decide the projection
rule once, then it applies to every skill we ever write."

---

## Agenda — 75 minutes

Compress by cutting Block 5 (the spikes can be assigned async). Do not cut
Block 4 — it is the only block that removes a blocker.

| # | Block | Time | Output |
|---|---|---|---|
| 1 | Frame: what an MCP skill is here | 10 min | Shared definition |
| 2 | The six candidates — scope each | 20 min | One-line scope + the tool it binds to |
| 3 | Composer ↔ MCP projection rule | 10 min | A rule recorded in `integrations/klaviyo-composer/` |
| 4 | **Owners and access** | 15 min | A named owner per skill; one account raised to `draft` |
| 5 | Verification spikes | 10 min | Three assignments, dated |
| 6 | Sequence and the gate | 10 min | Build order agreed, first build starts |

### Block 1 — Frame (10 min)

Walk `skills/execution/email-design/SKILL.md` on screen. It answers "what does
good look like" faster than any explanation:

- A skill is a **procedure**, not account facts. Account facts live in
  `accounts/<slug>/context/`.
- Every required input names its source **and what to do when it is missing** —
  usually "stop and ask", never "infer".
- Quality checks are **observable**: a reviewer ticks them without re-deriving
  your judgment. Mechanical where possible (`validate_dnd.py`).
- The skill produces **a file in a PR**. Pushing it into a client account is a
  separate, separately authorized step.

State the placement test once: *would this be true for a different account?*
Yes → `skills/`. No → that account's folder.

### Block 2 — Scope the six (20 min, ~3 min each)

For each, settle only: **what it produces**, **which tools it binds to**, and
**what it is not**. Do not draft procedure in the room.

**Customer Profile / Persona** — `marketing-strategy.customer-persona`
Already scaffolded. The differentiator in its own purpose line is that personas
map to *queryable cohorts*, not stock photos. Bind to `get_profiles`,
`query_metric_aggregates`, `ask_analytics_question`. Depends on
`marketing-strategy.target-audience`, which is equally unwritten — decide whether
they are written together or whether audience gates persona.

**Flow Builder** — new `execution.flow-architecture`
Split it. Flow *specification* (a spec file in a PR, `templates/flow-specification.md`
already exists) is buildable today and needs no write access. Flow *creation* via
`create_flow` is unverified and unauthorized. Ship the spec half; treat the build
half as a later increment. Also fill in `workflows/flow-architecture.md`, whose
Steps section is still a placeholder.

**Campaign & Omni-Campaign Builder** — `execution.campaign-brief`
`skills/CATALOG.md` already flags this as gating `execution.email-copy` and step 2
of `workflows/creative-production.md`. "Omni" means the channel matrix (email /
SMS / push) is part of the brief, not a separate skill — confirm that, because
if omni is a separate skill it duplicates most of the brief. Note `execution.sms-copy`
is blocked on the `messaging-constraints` SMS section being populated.

**Segments (RFM, cohort)** — new `execution.segmentation`
Highest overlap with Composer Preview: Job 1 is literally RFM ("grouped by how
many times they've ordered, or by value tier") and Job 6 is segment audit. Decide
whether this skill *defines* segments (a definition file, read-only, deliverable
today) or *creates* them in-platform (`create_segment`, unverified, unauthorized).
Recommend the former first.

**Reporting & Testing** — `marketing-strategy.account-growth-analysis`
This is two skills wearing one name. **Reporting** is the recurring
pull-and-narrate loop — `workflows/growth-analysis.md` already scopes it, and it
needs a connector. **Testing** is pre-send QA — which is `execution.campaign-flow-qa`,
already flagged in `skills/CATALOG.md` as the **recommended first build because it
gates three workflows**. Separate them in the room.

**Creative Design** — `execution.creative-direction`
`execution.email-design` is written; the gap ahead of it is creative direction
(step 4 of `workflows/creative-production.md`), which decides layout direction
before design executes it. Scope this as the *upstream* skill, not a rewrite of
`email-design`.

### Block 3 — The projection rule (10 min)

Decide and record: **`skills/**/SKILL.md` is the single source of truth. Composer
receives the runtime-neutral half.** Then settle the three open questions that
`integrations/klaviyo-composer/README.md` already lists and cannot answer:

- How does a skill get *into* Composer — paste, sync, or API? (See spike C.)
- How do we know which revision is loaded in a given session?
- What gets recorded alongside a Composer-produced deliverable?

Minimum viable answer if the room stalls: manual paste, with the skill ID and
version pasted in the first line of the Composer skill, and the same version
recorded in the deliverable README. Crude, but it makes drift detectable.

### Block 4 — Owners and access (15 min) — **the one block that unblocks work**

`integrations/mcp/access-policy.md` says it outright: *"No account has a named
owner. That is the single thing standing between the creative workflow and a
working build step."*

Leave the room with:

1. **A named owner per skill.** Every skill in `skills/CATALOG.md` currently reads
   `_unassigned_`. `governance/skill-authoring.md` requires a named person at
   creation. Unowned skills do not get written.
2. **One account raised to `draft`.** Blessed Botanicals is the candidate — it is
   the only account with populated context (captured 2026-09-21) and a verified
   connector. Raising it needs a PR editing `owner` and `agent_access` in
   `accounts/registry.yml`, `python3 scripts/sync.py`, and the named owner's
   approval. That approval *is* the authorization.
3. **Explicit acknowledgement that publish is never granted.** Scheduling,
   sending, and activating are human-only, per instance. There is no config value
   for it and there never will be. Say it out loud so nobody scopes a skill around it.

### Block 5 — Verification spikes (10 min)

Every spike below is **read-only**, so none needs an authorization decision.
Assign a name and a date to each; results go into `integrations/mcp/tool-map.md`
with the date, per its own rules.

| | Spike | Why it is worth an hour |
|---|---|---|
| **A** | Run `ask_analytics_question` against Blessed Botanicals and Lazy Leaf | This is the Klaviyo SQL surface the Composer brief is built on. It is exposed on both our connected accounts and is **not** in the verified table. If it works, it is the single tool behind Segments, Reporting, and most of Persona — one verification unblocks three skills. |
| **B** | Run `get_campaign_report` / `get_flow_report` on Blessed Botanicals | Reporting & Testing is scoped on the assumption these work. Nobody has run them. |
| **C** | Determine what `create_agent_skill` / `get_agent_skills` actually control | **Unverified and potentially the highest-leverage unknown in the project.** If these are the Composer custom-skill API, skills could sync from this repo automatically and the entire Composer integration question answers itself. If they are the Klaviyo *customer agent* skill API — which is what `onboarding-migration.customer-agent` covers, and is the more likely reading — then Composer stays manual. Do not assume either. One person, thirty minutes, write down what it is. |

Rule from `tool-map.md` that applies to all three: a connector exposing a tool is
**not** evidence it is wired, permitted, or working. An empty result is a finding,
not an outage to work around.

### Block 6 — Sequence and the gate (10 min)

The repo's own recommended first build is `execution.campaign-flow-qa`, and it is
the right call for four independent reasons — worth stating, because it is not on
the proposed list as a standalone:

1. It gates three workflows (`multi-campaign`, `creative-production`,
   `quality-assurance`).
2. It is **read-only** — no write verification, no authorization blocker, buildable
   this week.
3. It maps directly onto Composer Job 9 (pre-send review) and Job 7 names "your
   pre-send QA checklist" as the example custom skill. One artifact, both halves
   of the project.
4. Per `workflows/quality-assurance.md`: *"the cheapest workflow to build and the
   most expensive one to skip."*

Proposed order, read-only first so work starts before any access decision lands:

| Wave | Build | Why here |
|---|---|---|
| 1 | `execution.campaign-flow-qa` | Gates three workflows; read-only; doubles as the Composer skill |
| 1 | `execution.segmentation` (definition only) | Unblocked by spike A; highest Composer-job overlap |
| 2 | `execution.campaign-brief` | Gates `email-copy`; completes `creative-production` |
| 2 | `marketing-strategy.customer-persona` + `.target-audience` | Written together; feeds segmentation |
| 3 | `execution.flow-architecture` (spec only) | Needs `templates/flow-specification.md` exercised once |
| 3 | `execution.creative-direction` | Upstream of the already-written `email-design` |
| 4 | Reporting loop; any *write* increment | Gated on spikes B/C and on an account at `draft` |

---

## Decisions to leave with

Nothing below is a discussion item. If one is unresolved at the end, it is
assigned with a date, not carried.

- [ ] Confirmed: `skills/` is the single source of truth; Composer is a projection
- [ ] A named owner for each of the six skills
- [ ] One account raised to `agent_access: draft` with a named owner, or an
      explicit decision to stay `read_only` this cycle
- [ ] Reporting and Testing separated into two skills
- [ ] Segments scoped as definition-only for wave 1
- [ ] Flow Builder split into spec (now) and build (later)
- [ ] Spikes A, B, C assigned with names and dates
- [ ] Wave 1 build started, to the shape of `execution.email-design`

## Pre-reads

Twenty minutes total. Send with the invite.

| File | Why |
|---|---|
| `skills/execution/email-design/SKILL.md` | The quality bar. Everything else is built to this shape |
| `skills/CATALOG.md` | What exists vs. what is only named |
| `integrations/mcp/tool-map.md` | What actually works — seven reads, nothing else |
| `integrations/mcp/access-policy.md` | The action classes, and why nothing is owned yet |
| `governance/skill-authoring.md` | Skill vs. workflow vs. account context vs. template |
| The Composer Preview "Jobs to Try" brief | The ten jobs; Jobs 7 and 10 are the least understood |

## How the team contributes

Per `governance/skill-review.md` and `skills/CATALOG.md`:

1. Copy `templates/skill-template.md` to `skills/<group>/<name>/SKILL.md`
2. Fill the header — ID, **named owner**, status `draft`, version `0.1.0`
3. Write it per `governance/skill-authoring.md`
4. `python3 scripts/sync.py` — the catalog regenerates from headers; never hand-edit
5. Open a PR

Account facts never justify a new skill. Different voice, products, or
constraints → `accounts/<slug>/context/`. Only a different **procedure** justifies
an account-local skill.

## Open questions this session does not resolve

- Whether Composer custom skills are reachable by API (spike C). Everything about
  automated skill sync depends on the answer, and we do not have it.
- Whether the three accounts without connectors are getting one, and who asks.
- Composer's scheduled tasks (Job 10) — an agent on a recurring schedule touching
  a client account is not covered by `access-policy.md`. Its action classes assume
  a human initiates. Needs a policy decision before anyone schedules one.

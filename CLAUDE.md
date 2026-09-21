# Agent context

## What this repo is

The Lifecycle & Retention Department's skills library. Four kinds of content, kept
apart on purpose:

| Kind | Location | Rule |
|---|---|---|
| Reusable procedure | `skills/<group>/<name>/SKILL.md` | Never account-specific |
| Ordered sequence | `workflows/<name>.md` | Coordinates skills; defines the gate |
| Account facts | `accounts/<slug>/context/` | Never procedure |
| Work product | `accounts/<slug>/{strategy,campaigns,flows,reporting}/` | Never in the shared library |

`department/`, `templates/`, `integrations/`, `governance/`, and `scripts/` support
these. `scripts/` is infrastructure, not content.

Placement test: *would this be true for a different account?* Yes → shared library.
No → that account's folder.

**Account facts never justify a new skill.** Different voice, products, or
constraints → `accounts/<slug>/context/`. Only a different *procedure* justifies an
account-local skill. See `governance/skill-authoring.md`.

## Before any account work

1. **Confirm the account.** Resolve by slug through `accounts/registry.yml`. Never
   hardcode a Klaviyo account ID in a skill, workflow, script, or document.
   Applying one account's context to another is the most damaging error available
   here, and it is silent — the output looks plausible.
2. **Check skill status.** `draft` means the procedure is not written and the skill
   is not safe to deliver from. Say so rather than improvising through it.
3. **Check data access.** See the matrix below.
4. **Check the capability is verified.** `integrations/mcp/tool-map.md` lists three
   verified capabilities. Everything else is pending — a connector existing is not
   evidence a tool works.

## Data access is not uniform — check before promising

<!-- Generated from accounts/registry.yml. Do not hand-edit: run scripts/sync.py -->

<!-- BEGIN:generated:access-matrix -->
| Account | Slug | Klaviyo ID | Verified | Live data | Agent may | Owner |
|---|---|---|---|---|---|---|
| Blessed Botanicals | `blessed-botanicals` | `RaFbmF` | yes | Klaviyo MCP + Hiro `128074` | `read_only` | _unassigned_ |
| Exzell Pharma Inc. | `exzell-pharma` | `W3jRK5` | **no** | none | `none` | _unassigned_ |
| Something Borrowed Blooms | `something-borrowed-blooms` | `SmTYz2` | **no** | none | `none` | _unassigned_ |
| Bad Boy Mower Parts | `bad-boy-mower-parts` | `UwjazH` | **no** | none | `none` | _unassigned_ |
| Lazy Leaf | `lazy-leaf` | `RQeWJs` | yes | Klaviyo MCP | `read_only` | _unassigned_ |
<!-- END:generated:access-matrix -->

Three of five accounts have **no connector**. If asked to report on, analyze, or QA
one of them, say so plainly rather than producing an empty or inferred answer.

"Verified: no" means the account ID came from a human and has not been confirmed
against the API. Do not treat it as fact; flag it if it matters.

## Action boundaries

Creating content, creating a platform draft, and scheduling or sending are three
**separate** authorizations. Holding one never implies the others.

Each account's ceiling is the `agent_access` column above, set in
`accounts/registry.yml` and enforced by `scripts/sync.py`:

| | |
|---|---|
| `none` | No agent access |
| `read_only` | Reads only — **the default, and currently every account** |
| `draft` | May also create unpublished drafts. Requires a named `owner` |

**Scheduling, sending and activating are human-only, per instance, always.**
There is no config value that grants them.

Modifying an existing live object (a flow, a segment, a live template) needs the
account owner's approval for that specific change, recorded in the PR. See
`integrations/mcp/access-policy.md`.

## Conventions

- **Generated blocks.** Content between `<!-- BEGIN:generated:… -->` markers is
  derived. Never hand-edit. Edit the source, then run `python3 scripts/sync.py`
  (`--check` verifies without writing).

  | Generated | From |
  |---|---|
  | Account tables in `accounts/README.md`, `CLAUDE.md`, each account README | `accounts/registry.yml` |
  | `accounts/*/platform/klaviyo.md` | `accounts/registry.yml` |
  | `skills/CATALOG.md` | `skills/**/SKILL.md` headers |

- **Skill headers are structured.** The ID/Owner/Status/Version/Last-reviewed block
  is parsed by `sync.py`. Keep the format exactly; a malformed header fails the sync.
- **Don't create empty placeholder folders.** Add a skill folder when the
  capability is being written. Planned skills live in the "Not yet built" table in
  `skills/CATALOG.md`.
- **Deliverables go under the account**, never in `skills/`, `workflows/`, or
  `templates/`.
- **Mark unknowns as unknown.** An empty context section means *not yet captured*,
  never *no constraints*. A `null` in the registry beats a guess.
- **Never commit** credentials, real customer records, or client-identifying
  material in shared examples.

## Default posture

This repo optimizes for leverage, not throughput. Before building something for one
account, check whether it belongs in the shared library. Say so when a request
would be better solved one layer up.

Be honest about state. Most skills are `draft`, all account context is empty, and
most tool capabilities are unverified. Saying "this isn't built yet" is correct
behavior here, not a failure to help.

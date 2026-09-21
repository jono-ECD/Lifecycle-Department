# Accounts

One folder per account. Account **facts** live in `context/`; account **work
product** lives in `strategy/`, `campaigns/`, `flows/`, and `reporting/`. The
procedures applied to them live in [`../skills/`](../skills/) and are referenced,
never copied here.

[`registry.yml`](registry.yml) is the **single source of truth** for account
identity and data access. Agents, workflows, and scripts resolve an account through
it by slug. Nothing else in this repository should contain a hardcoded account ID.

## Active accounts

<!-- Generated from registry.yml. Do not hand-edit: run scripts/sync.py -->

<!-- BEGIN:generated:account-index -->
| Account | Slug | Klaviyo | Verified | Klaviyo MCP | Hiro |
|---|---|---|---|---|---|
| [Blessed Botanicals](blessed-botanicals/) | `blessed-botanicals` | `RaFbmF` | ✅ | ✅ | ✅ `128074` |
| [Exzell Pharma Inc.](exzell-pharma/) | `exzell-pharma` | `W3jRK5` | ⚠️ | ❌ | ❌ |
| [Something Borrowed Blooms](something-borrowed-blooms/) | `something-borrowed-blooms` | `SmTYz2` | ⚠️ | ❌ | ❌ |
| [Bad Boy Mower Parts](bad-boy-mower-parts/) | `bad-boy-mower-parts` | `UwjazH` | ⚠️ | ❌ | ❌ |
| [Lazy Leaf](lazy-leaf/) | `lazy-leaf` | `RQeWJs` | ✅ | ✅ | ❌ |
<!-- END:generated:account-index -->

**Verified** = account ID confirmed against the live Klaviyo API (2026-09-20).
⚠️ = supplied by a human, not yet confirmed. Treat as provisional.

**Read the access columns before promising automation.** Three of five accounts
have no data connector. Any workflow that pulls live data — reporting, growth
analysis, QA against live flows — runs for Blessed Botanicals and Lazy Leaf only.
See [`../integrations/mcp/tool-map.md`](../integrations/mcp/tool-map.md) for which
capabilities are actually verified.

**All account context is currently empty.** Every `context/` file is scaffolded and
marked *not yet captured*. Populate from approved sources before delivery work.

## Folder conventions

| Folder | Holds | Naming |
|---|---|---|
| `context/` | Account facts — who the work is for | fixed filenames |
| `platform/` | Platform IDs and conventions, no secrets | `klaviyo.md` (generated) |
| `skills/` | Which shared skills apply; local skills only if the *procedure* differs | `CATALOG.md` |
| `strategy/` | Retention thesis, journey maps, research | `topic.md` |
| `campaigns/` | Campaign deliverables | `YYYY-MM-DD-campaign-name/` |
| `flows/` | Flow specs and QA | `flow-name/` |
| `reporting/` | Performance reviews | `YYYY-MM/` |

## Adding an account

1. Copy [`_template/`](_template/) to `accounts/<lowercase-slug>/`.
2. Add an entry to [`registry.yml`](registry.yml). Set `verified: false` until the
   ID is confirmed against the API.
3. Run `python3 scripts/sync.py` — this generates the account tables and
   `platform/klaviyo.md`.
4. Assign a named account owner in the account README. Required before delivery.
5. Populate `context/` from approved sources. Mark unknowns explicitly.
6. Build the account skills catalog by referencing approved shared skills.
7. Run one sample task and review the output before relying on the setup.

## Connecting data access later

Edit the `access:` block and `verified:` flag in `registry.yml`, then run
`python3 scripts/sync.py`. Every derived table updates. Never edit them by hand.

Confirming an account ID against the live API needs MCP access — ask Claude to
verify, then set `verified: true`.

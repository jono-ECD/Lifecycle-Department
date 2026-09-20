# Agent context

## What this repo is

The Lifecycle & Retention Department's operating system. Two layers:

- `system/` — reusable method. Templates, SOPs, agent skills, workflows.
  Applies to every account. **Never write client-specific content here.**
- `clients/` — per-account instances. Strategy, state, output.
  **Never write reusable method here.**

`scripts/` is repo infrastructure, not a third content layer — tooling that keeps
the two layers consistent.

If you are about to write a file and cannot tell which layer it belongs in, ask:
*would this be true for a different client?* Yes → `system/`. No → `clients/<slug>/`.

## Resolving a client

`clients/registry.yml` is the single source of truth for account identity and data
access. **Always read it before touching a client.** Never hardcode a Klaviyo account
ID in a skill, workflow, script, or document — look it up by slug.

When writing a skill or workflow, take a client **slug** as the parameter and resolve
identity through the registry. A skill that hardcodes `RaFbmF` works for one account;
one that resolves `blessed-botanicals` works for all of them.

## Data access is not uniform — check before promising

<!-- Generated from clients/registry.yml. Do not hand-edit: run scripts/sync_registry.py -->

<!-- BEGIN:generated:access-matrix -->
| Client | Slug | Klaviyo ID | Verified | Live data |
|---|---|---|---|---|
| Blessed Botanicals | `blessed-botanicals` | `RaFbmF` | yes | Klaviyo MCP + Hiro `128074` |
| Exzell Pharma Inc. | `exzell-pharma` | `W3jRK5` | **no** | none |
| Something Borrowed Blooms | `something-borrowed-blooms` | `SmTYz2` | **no** | none |
| Bad Boy Mower Parts | `bad-boy-mower-parts` | `UwjazH` | **no** | none |
| Lazy Leaf | `lazy-leaf` | `RQeWJs` | yes | Klaviyo MCP |
<!-- END:generated:access-matrix -->

Three of five accounts have **no connector**. If asked to report on, analyze, or QA
one of them, say so plainly rather than producing an empty or inferred answer.

"Verified: no" means the account ID came from a human and has not been confirmed
against the API. Do not treat it as fact; flag it if it matters to the task.

## Conventions

- Client folders stay lean. Create subfolders when there is real work for them, not
  as empty scaffolding.
- Each `system/` node README carries an asset table. Update it when you add a
  template or skill so the tree reports its own state honestly.
- Account tables in `clients/README.md`, `CLAUDE.md`, and each client README sit
  between `<!-- BEGIN:generated:… -->` markers and are **derived from the registry**.
  Never hand-edit them. Edit `clients/registry.yml`, then run:
  `python3 scripts/sync_registry.py` (`--check` verifies without writing).
- Don't duplicate registry data into client folders. One source of truth, or it drifts.
- Mark unknowns as unknown. A `null` in the registry is more useful than a guess.

## Default posture

This repo optimizes for leverage, not throughput. Before building something for one
account, check whether it belongs in `system/`. Say so when a request would be better
solved one layer up — building the reusable version is usually worth the extra pass.

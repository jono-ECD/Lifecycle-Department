# Clients — the instance layer

One folder per account. Client-specific output lives here; the method it follows
lives in [`../system/`](../system/).

[`registry.yml`](registry.yml) is the **single source of truth** for account identity
and data access. Agents, workflows, and scripts resolve a client through it. Nothing
else in this repo should contain a hardcoded account ID.

## Active accounts

| Client | Slug | Klaviyo | Verified | Klaviyo MCP | Hiro |
|---|---|---|---|---|---|
| [Blessed Botanicals](blessed-botanicals/) | `blessed-botanicals` | `RaFbmF` | ✅ | ✅ | ✅ `128074` |
| [Exzell Pharma Inc.](exzell-pharma/) | `exzell-pharma` | `W3jRK5` | ⚠️ | ❌ | ❌ |
| [Something Borrowed Blooms](something-borrowed-blooms/) | `something-borrowed-blooms` | `SmTYz2` | ⚠️ | ❌ | ❌ |
| [Bad Boy Mower Parts](bad-boy-mower-parts/) | `bad-boy-mower-parts` | `UwjazH` | ⚠️ | ❌ | ❌ |
| [Lazy Leaf](lazy-leaf/) | `lazy-leaf` | `RQeWJs` | ✅ | ✅ | ❌ |

**Verified** = account ID confirmed against the live Klaviyo API (2026-09-20).
⚠️ = supplied by a human, not yet confirmed. Treat as provisional.

**Read the access columns before promising automation.** Three of five accounts have
no data connector wired. Any workflow that pulls live data — reporting, growth
analysis, QA against live flows — runs for Blessed Botanicals and Lazy Leaf only
until those connectors exist. This is the binding constraint on the whole repo, not
a footnote.

## Adding a client

1. Add an entry to `registry.yml`. Set `verified: false` until the ID is confirmed
   against the API.
2. `mkdir clients/<slug>/` and copy the README shape from an existing client.
3. Wire data access (Klaviyo MCP connector, Hiro) and update the `access:` block.

That is the whole cost of onboarding an account into this system — which is the
point of separating `system/` from `clients/`.

## Folder convention

Keep client folders lean. Create `strategy/`, `implementation/`, or `reporting/`
subfolders when there is real work to put in them, not as empty scaffolding.

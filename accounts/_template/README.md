# <Account name>

> **Template.** Copy this folder to `accounts/<lowercase-slug>/`, add a matching
> entry to `accounts/registry.yml`, then run `python3 scripts/sync.py`.
> Full steps: [`../README.md`](../README.md#adding-an-account).

| | |
|---|---|
| **Slug** | `<slug>` |
| **Account owner** | _assign a named person — required_ |
| **Registry entry** | [`accounts/registry.yml`](../registry.yml) |

Account identity and data access are generated into `platform/klaviyo.md` from the
registry. Do not restate IDs here.

## Account context
_Summary. Detail lives in [`context/`](context/)._

## Active workstreams

| Workstream | Skill / workflow | Status | Owner |
|---|---|---|---|
| — | — | — | — |

## Working notes
_Decisions, gotchas, anything the next person shouldn't have to relearn._

## Folder conventions

| Folder | Holds | Naming |
|---|---|---|
| `context/` | Account facts — who the work is for | fixed filenames |
| `platform/` | Platform IDs and conventions — no secrets | `klaviyo.md` |
| `skills/` | Which shared skills apply; local skills only if the *procedure* differs | `CATALOG.md` |
| `strategy/` | Retention thesis, journey maps, research | `topic.md` |
| `campaigns/` | Campaign deliverables | `YYYY-MM-DD-campaign-name/` |
| `flows/` | Flow specs and QA | `flow-name/` |
| `reporting/` | Performance reviews | `YYYY-MM/` |

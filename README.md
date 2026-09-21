# Lifecycle & Retention Department

The department's skills library: how we work, held once, applied across accounts.

## The separation this repository enforces

| Layer | Holds | Answers |
|---|---|---|
| [`skills/`](skills/) | Reusable procedures | **How** the work is done |
| [`workflows/`](workflows/) | Ordered sequences of skills, with gates | **In what order** |
| [`accounts/*/context/`](accounts/) | Voice, products, audiences, constraints | **Who** it's for |
| `accounts/*/{strategy,campaigns,flows,reporting}/` | Work product | **What** was produced |

Skills are **referenced, never copied**. One authoritative version of each
procedure; account facts are supplied to it as context.

The test when you cannot place something: *would this be true for a different
account?* Yes → shared library. No → that account's folder.

## Map

```
department/     What we sell, how we operate, the quality bar
skills/         Reusable procedures — CATALOG.md is the index
workflows/      Ordered sequences with quality gates
accounts/       Per-account context, platform refs, and deliverables
integrations/   Klaviyo Composer and MCP — verified capabilities only
templates/      Reusable output formats
governance/     Authoring, review, isolation, changelog
scripts/        sync.py — regenerates derived docs from their sources
```

## Start here

| You want to | Go to |
|---|---|
| Run work for an account | [`accounts/`](accounts/), then the matching [workflow](workflows/) |
| Find a procedure | [`skills/CATALOG.md`](skills/CATALOG.md) |
| Understand what we sell | [`department/service-catalog.md`](department/service-catalog.md) |
| Add an account | [`accounts/README.md`](accounts/README.md#adding-an-account) |
| Write or change a skill | [`governance/skill-authoring.md`](governance/skill-authoring.md) |
| Work here as an agent | [`CLAUDE.md`](CLAUDE.md) |

## Current state — read before relying on anything

**Most skills are `draft`.** Purpose, inputs, and outputs are settled; the
step-by-step procedures are not written. A `draft` skill is not safe to deliver
from. [`skills/CATALOG.md`](skills/CATALOG.md) shows status per skill.

Fully worked, as reference examples:
- [`execution.email-copy`](skills/execution/email-copy/SKILL.md) — the skill shape
- [`workflows/multi-campaign.md`](workflows/multi-campaign.md) — context → skill → QA → deliverable

**Account context is empty.** Every `accounts/*/context/` file is scaffolded and
marked *not yet captured*. An empty `messaging-constraints.md` means unknown, never
unconstrained.

**Two of five accounts have live data connectors.** Anything reading live
performance runs for Blessed Botanicals and Lazy Leaf only. See
[`integrations/mcp/tool-map.md`](integrations/mcp/tool-map.md) — only three
capabilities are verified; everything else is pending.

**No access separation between accounts.** Folders organize, they do not restrict.
See [`governance/account-isolation.md`](governance/account-isolation.md).

## Derived content

Some tables are generated from their sources by `scripts/sync.py` and sit between
`<!-- BEGIN:generated:… -->` markers. Never hand-edit them.

| Generated | From |
|---|---|
| Account tables in `accounts/README.md`, `CLAUDE.md`, each account README | `accounts/registry.yml` |
| `accounts/*/platform/klaviyo.md` | `accounts/registry.yml` |
| `skills/CATALOG.md` | `skills/**/SKILL.md` headers |

```bash
python3 scripts/sync.py          # regenerate
python3 scripts/sync.py --check  # fail if stale
```

## Suggested build order

1. `execution.campaign-flow-qa` — cheapest to make real, gates three workflows
2. `execution.campaign-brief` — gates `email-copy`, which is already written
3. Populate context for one account and pilot `workflows/multi-campaign.md` end to end
4. Refine the structure from what that pilot teaches, then expand

# Lifecycle & Retention Department

The operating system for the department: how we work, held once, applied across
accounts.

## The one idea

Two layers, separated on purpose:

| Layer | What it holds | Rate of change | Scope |
|---|---|---|---|
| [`system/`](system/) | Method — templates, SOPs, agent skills, workflows | Rarely | Every account |
| [`clients/`](clients/) | Instances — strategy, state, output per account | Weekly | One account |

[`clients/registry.yml`](clients/registry.yml) joins them. It is the only place
account IDs live.

**Why this and not the obvious thing.** The natural move is to turn the department's
service taxonomy straight into folders and drop clients inside. That fails two ways:
nest clients under the taxonomy and you get ~100 folders with each client's context
scattered across all of them; nest the taxonomy under clients and you duplicate every
template five times and they drift within a quarter. Splitting method from instance
means adding client #6 touches zero files in `system/`, and improving a template
improves it for everyone at once.

## Start here

- **Running work for an account?** → [`clients/`](clients/), then the relevant
  [`system/`](system/) node for the method.
- **Improving how we work?** → [`system/`](system/). Fix it once, everyone gets it.
- **Adding an account?** → [`clients/README.md`](clients/README.md).
- **Working here as an agent?** → [`CLAUDE.md`](CLAUDE.md).

## Current state

Five active accounts. **Two have live data connectors; three do not.** Any workflow
that reads live performance data runs for Blessed Botanicals and Lazy Leaf only.
See [`clients/README.md`](clients/README.md) for the access matrix — closing those
gaps is the highest-leverage unblock in the repo.

The `system/` tree is scaffolded: every node documents its purpose, inputs, outputs,
and dependencies. **Templates and skills are not yet built.** Each node's README
carries an asset table tracking what exists.

## Working principle

Before solving something for one account, ask whether the solution belongs in
`system/`. If it does, build it there and instantiate it — that is the difference
between the department getting faster and the department getting busier.

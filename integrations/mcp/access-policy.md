# MCP access policy

What an agent may do in a client's platform account, who decides, and where the
decision is recorded.

**The registry is the policy.** `accounts/registry.yml` carries `owner` and
`agent_access` per account; `scripts/sync.py` refuses to run if they are
inconsistent. This document explains the rules — the registry enforces them. If
the two ever disagree, the registry wins and this file is out of date.

## Action classes

| Class | Examples | Who authorizes | Reversible? |
|---|---|---|---|
| **Read** | Account metadata, performance, segments, existing templates | Nobody — permitted wherever a connector is wired | n/a |
| **Draft** | Create an unpublished template or campaign draft | The account `owner` in the registry, once, by setting `agent_access: draft` | Yes, and invisible to customers |
| **Update** | Modify an existing flow, segment, live template, or brand library | The account `owner`, **per change**, recorded in the PR | Sometimes — may affect live sending |
| **Publish** | Schedule, send, activate a flow, switch a form live | **A human, per instance. Never an agent.** | **No** |

Holding one class never implies another. Authorization for one campaign never
extends to the next.

**Publish is not a registry value and never will be.** There is no config that
grants it. A human performs the action, or it does not happen.

### Why draft and update are separate

They were one tier, and that is what deadlocked the previous version of this
policy. An unpublished draft is reversible and no customer ever sees it. An edit
to a live flow can change what lands in an inbox tonight. Treating them as
equally risky means the safe one never gets approved either — so the whole
creative workflow stalls on the same gate that exists to protect live sending.

## Defaults

**Every rule below has a default. Nothing is ever blocked pending a decision.**
A missing decision resolves to the conservative option and work continues at that
level. The previous version ended everything above read until five open questions
were answered, and one of those questions was who could answer them — so nobody
could, and the whole policy was unreachable.

| Question | Default when unanswered |
|---|---|
| What may an agent do here? | `read_only` |
| Who authorizes? | The `owner` field. `null` caps the account at `read_only` |
| How is authorization recorded? | The PR that lands the deliverable |
| Which accounts opt out? | None; set `agent_access: none` to opt one out |
| Who owns the connector? | The account `owner` |

## The registry fields

```yaml
owner: null              # who authorizes agent actions here
agent_access: read_only  # none | read_only | draft
```

Enforced by `scripts/sync.py`, which exits non-zero when:

- `agent_access` is not one of `none`, `read_only`, `draft`
- `agent_access: draft` is set with no `owner` — nobody named means nobody can be
  asked
- `agent_access` is above `none` with no Klaviyo connector wired

Both fields surface in the generated tables in `CLAUDE.md`, each account README
and each `platform/klaviyo.md`, so an agent reading account context sees its
ceiling without being told.

## Recording authorization

The PR that lands the deliverable is the record. In the deliverable's
`README.md`, alongside the skill versions already recorded:

```markdown
## Authorization
- Action class: draft
- Authorized by: <name>
- Date: YYYY-MM-DD
- Platform objects created: <template id>, <campaign id>
```

No separate ticket system. If it is not in the PR, it did not happen.

## Standing rules

- **Confirm the account before any call.** Resolve by slug through
  `accounts/registry.yml`. Applying one account's context to another is the most
  damaging error available here, and it is silent.
- **Never hardcode an account ID** in a skill, workflow, or script.
- **Capability is not permission.** `integrations/mcp/tool-map.md` records
  whether a tool *works*; this file records whether we *may*. A verified
  capability with `agent_access: read_only` is still off limits. An authorized
  action on an unverified tool still has to be tested before it is promised.
- **A connector existing is not authority to use it.** Connectors are present in
  this session for accounts that are not in the registry at all. They are out of
  scope.
- **Credentials live in the team's secret manager**, never in this repository.
- **A failed or unavailable tool is reported, not worked around** with inference.
- **Read access is not authority to act.**

## Current state

| Account | `agent_access` | `owner` |
|---|---|---|
| Blessed Botanicals | `read_only` | _unassigned_ |
| Lazy Leaf | `read_only` | _unassigned_ |
| Exzell Pharma | `none` | — no connector |
| Something Borrowed Blooms | `none` | — no connector |
| Bad Boy Mower Parts | `none` | — no connector |

**No account has a named owner.** That is the single thing standing between the
creative workflow and a working build step — not this policy's wording. Name an
owner for Blessed Botanicals and set `agent_access: draft`, and
`workflows/creative-production.md` can run end to end.

## Changing an account's access

1. Open a PR editing `owner` and/or `agent_access` in `accounts/registry.yml`.
2. Run `python3 scripts/sync.py` to regenerate the derived tables.
3. The named owner approves the PR. That approval *is* the authorization.

Raising an account to `draft` is a standing grant for the draft class only. It
never implies update or publish.

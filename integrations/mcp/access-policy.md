# MCP access policy

## Action classes

| Class | Examples | Authorization |
|---|---|---|
| **Read** | Account metadata, performance, segments | Permitted for accounts with a wired connector |
| **Create draft** | Campaign draft, template | **Requires account-owner authorization.** Reversible, but visible in the client's account |
| **Update** | Modify an existing flow, segment, template | **Requires account-owner authorization.** May affect live sending |
| **Publish** | Schedule, send, activate a flow | **Requires explicit, per-instance human authorization.** Not delegable to an agent |

Holding one class never implies another. Authorization for one campaign never
extends to the next.

## Open decisions

These are **not yet decided**. Until they are, treat everything above `read` as
prohibited.

- [ ] Who may authorize draft creation, per account?
- [ ] Is agent-initiated draft creation permitted at all, or human-only?
- [ ] What is the record of authorization — a PR, a ticket, a Slack approval?
- [ ] Which accounts, if any, opt out of agent access entirely?
- [ ] Who owns each connector, and who can revoke it?

## Standing rules

- Confirm the account before any call. Resolve by slug through
  `accounts/registry.yml`.
- Never hardcode an account ID in a skill, workflow, or script.
- Credentials live in the team's secret manager, never in this repository.
- A failed or unavailable tool is reported, not worked around with inference.
- Read access to an account is not authority to act on it.

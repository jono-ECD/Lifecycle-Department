# Operating principles

## Separation of concerns

- **Skills describe how to do work.** Reusable instructions, held once.
- **Account context describes who the work is for.** Voice, products, audiences,
  constraints — facts, not procedure.
- **Account skills describe a different process.** Only when context alone cannot
  express the difference.
- **Workflows coordinate skills.** Order, handoffs, review, completion criteria.
- **Integrations connect work to tools.** MCP exposes capability; a skill decides
  when and how to use it.
- **Deliverables belong to their account.** Never in the shared library.
- **Reference shared skills, never copy them.** One authoritative version each.

The test when you cannot place something: *would this be true for a different
account?* Yes → shared library. No → that account's folder.

## Leverage over throughput

Before solving something for one account, ask whether it belongs in the shared
library. Building the reusable version usually costs one extra pass and pays back
on the second account. Say so when a request would be better solved one layer up.

## Honesty about state

- A `draft` skill is not safe to deliver from. Say so rather than using it anyway.
- Unknown context is marked unknown. A blank `messaging-constraints.md` means
  *not yet captured*, never *no constraints*.
- An unverified account ID is provisional. Flag it when it matters.
- Missing data access is stated plainly, not worked around with inference.

## Separation of actions

Creating content, creating a platform draft, and scheduling or sending are three
distinct authorizations. Holding one never implies the others. See
[`../integrations/mcp/access-policy.md`](../integrations/mcp/access-policy.md).

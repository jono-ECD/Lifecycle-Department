# Flow Architecture

- ID: `execution.flow-architecture`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: _never_

## Purpose

Build a Klaviyo flow — trigger, path, delays, branches, and filters — directly in
a connected account, using the `create_flow` MCP tool. Covers the four standard
lifecycle flows (Welcome Series, Abandoned Cart, Post-Purchase, Browse
Abandonment) plus fully custom flows built from a user-supplied spec. Use once a
flow's structure is approved and ready to stand up in Klaviyo. Not for writing
the copy that goes inside it (`execution.email-copy`) or for deciding the
audience a flow targets (`execution.segmentation`).

## Required inputs

| Input | Source | If missing |
|---|---|---|
| Approved flow spec (type, trigger, path/steps, delays, filters, naming) | Account strategy/brief, or supplied inline | Ask for the deltas from the standard skeleton (Instructions, Step 3) rather than building from a blank page. |
| Klaviyo MCP connector for the target account | `integrations/mcp/tool-map.md` | Stop. Do not build against an unconfirmed account. |
| Live metric, list, and segment IDs | `get_metrics` / `get_lists` / `get_segments` on the connector | Stop and ask — never invent an ID or substitute a similarly-named one. |
| SMS consent and opt-out requirements | Account messaging constraints | Apply the standing requirements below regardless; they are not optional per account. |

## Instructions

### Standing requirements (every flow, no exceptions)

Apply these regardless of flow type and regardless of what the spec says — add
them even if not explicitly requested, and drop them only on explicit
instruction:

- Every `send-sms` action gets its own SMS consent filter on the action itself
  (`additional_filters.condition_groups`: channel `sms`,
  `can_receive_marketing: true`, `consent_status: {subscription: "subscribed"}`),
  in addition to any flow-level consent filter.
- Every `send-sms` action has `add_opt_out_language: true` set on its `FlowSms`
  message object.
- Every Welcome and Abandonment flow (Welcome Series, Abandoned Cart, Browse
  Abandonment) gets a "no order since flow start" `conditional-split` gate
  placed directly before *every* send action, not just once at entry —
  `profile-metric` on Placed Order, `measurement: count`,
  `measurement_filter: {operator: "equals", value: 0}`,
  `timeframe_filter: {type: "date", operator: "flow-start"}`. Route "true" into
  the send, "false" to exit. Post-Purchase is triggered *by* a Placed Order, so
  this does not apply there.

### Hard constraints

- This skill does not write content. Email/SMS actions without supplied copy get
  a placeholder subject (`"[DRAFT] <flow name> - Email 1"`) and the gap is
  reported, not filled in.
- Everything is created in `draft` status. Never call `update_flow` to set
  `live` or `manual` status without a separate, explicit confirmation.
- `create_flow` only builds new flows — it cannot edit an existing live flow's
  structure. If the ask is to modify one, say so and ask whether to build a new
  flow or inspect the existing one with `get_flows` first.
- Never invent a metric, list, segment, or template ID. Resolve every one live.

### Steps

1. **Confirm the account.** Call `get_account_details` on the chosen connector
   and confirm name/domain match expectations before building anything.
2. **Collect the spec.** Flow type, trigger, ordered path (sends/delays/
   branches), filters, naming, and content (or placeholders). If a standard
   type was picked, confirm against the standard skeleton and ask only for the
   deltas.
3. **Pull live data.** Resolve every metric, list, and segment ID the trigger or
   filters reference via `get_metrics`/`get_lists`/`get_segments`. If something
   named doesn't exist, say so and ask — do not substitute.
4. **Apply the standard skeleton** for Welcome Series, Abandoned Cart,
   Post-Purchase, or Browse Abandonment, or build the custom path as specified,
   folding in the standing requirements above at every applicable send.
5. **Assemble the `FlowDefinition`**: one trigger object, every action with a
   unique `temporary_id`, an `entry_action_id`, actions chained via
   `links.next`/`next_if_true`/`next_if_false`, the flow-level `profile_filter`,
   and `reentry_criteria` (default: no re-entry, unless asked otherwise). Every
   branch action needs both `next_if_true` and `next_if_false` wired.
6. **Confirm, then create.** Present the full structure in plain language
   (trigger → step 1 → step 2 → ...) before calling `create_flow`, unless the
   type is standard and confirmation was waived.
7. **Report back**: flow name, new flow ID and edit link, draft-status
   confirmation, every remaining placeholder, and every default assumed (delay
   durations, re-entry) so the requester can correct them.

## Output

- A new Klaviyo flow in `draft` status, created via `create_flow`.
- A short report (as above) saved to
  `accounts/<slug>/flows/<flow-name>.md` alongside the flow definition used to
  build it.

Deliverables are stored under the account, never in this folder. See
`governance/account-isolation.md`.

## Quality checks

- [ ] Account confirmed via `get_account_details` before any build call
- [ ] Every metric/list/segment ID resolved live — none invented or guessed
- [ ] Standing requirements (SMS consent filter, opt-out language, no-order-
      since-start gating) present everywhere they apply
- [ ] Every branch action has both `next_if_true` and `next_if_false` wired
- [ ] Flow created in `draft` status only — no live/manual status set
- [ ] Every action missing supplied copy carries an explicit `[DRAFT]` placeholder
- [ ] Report lists every placeholder and every assumed default

## Tools and action boundaries

This skill **writes real objects** to the connected Klaviyo account via
`create_flow` — it is not text-only. Requires a verified Klaviyo MCP connector
per `integrations/mcp/tool-map.md`. Never sets a flow to `live`/`manual` without
a separate explicit confirmation; that authorization is not granted by this
skill. See `integrations/mcp/access-policy.md`.

## Account customization

The four standard skeletons and standing requirements are shared and do not
vary by account. Day counts, filters, and content are inputs, read from the
approved spec and account context — never a reason to fork this skill. Fork
only if the account's actual build *procedure* differs (for example, a
non-standard confirmation or approval path).

## Dependencies

Consumes an approved flow spec from `marketing-strategy.purchase-journey` or a
campaign/flow brief, and audience definitions from `execution.segmentation`.
Feeds copy into `execution.email-copy` once built. Gated by
`execution.campaign-flow-qa` before going live. Called from
`workflows/flow-architecture.md`.

## Examples and references

`examples/` — approved samples. Keep fictional or fully anonymized; no real
customer data, no credentials.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-28 | Ported from the Claude skill `klaviyo-flow-builder` |

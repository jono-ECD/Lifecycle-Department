# Segmentation

- ID: `execution.segmentation`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: _never_

## Purpose

Build a standard set of Klaviyo segments — engagement tiers, buyer/non-buyer,
VIP, and product-category buyers — directly in a connected account, using the
Klaviyo MCP tools. Use once an audience needs to exist as a live, targetable
segment for a campaign or flow. Not for deciding audience strategy at a
planning level (`marketing-strategy.target-audience`) or for building the flow
that targets the segment (`execution.flow-architecture`).

## Required inputs

| Input | Source | If missing |
|---|---|---|
| Naming prefix (account initials or name) | Account context or the requester | Ask before creating anything — segment names are shared, visible objects. |
| Engagement day-windows (e.g. 7, 15, 30, 60, 90, 180) | Requester | Read back any ambiguous or garbled numbers before proceeding. |
| VIP order threshold | Requester, default suggestion 2+ | Confirm the default rather than assuming it applies. |
| Klaviyo MCP connector for the target account | `integrations/mcp/tool-map.md` | Stop. Do not build against an unconfirmed account. |
| Live metric IDs (Placed Order, Opened Email, Clicked Email, Active on Site, Checkout Started, Added to Cart, Ordered Product) | `get_metrics` on the connector | Never substitute a similarly-named metric. Flag the gap and ask how to proceed. |

## Instructions

1. **Confirm the account.** If multiple Klaviyo connectors are available, ask
   which one, or use the one named. Call `get_account_details` and confirm
   name/domain match expectations before creating anything.
2. **Collect parameters**: naming prefix, engagement day-windows, VIP
   threshold, and whether to show the full segment list for confirmation before
   creating (recommended default) or create immediately.
3. **Pull live metrics** via `get_metrics` and record IDs for whichever of the
   metrics above exist. Added to Cart is often absent — do not substitute;
   flag it and ask whether to drop it from engagement segments or find an
   equivalent.
4. **Build engagement segments** for each day-window `X`:
   - `<PREFIX> - Engaged L{X}D` — consent group (channel `email`,
     `can_receive_marketing: true`, `consent_status: {subscription: "any"}`) AND
     (Opened Email ≥1 OR Clicked Email ≥1) in the last X days.
   - `<PREFIX> - Full Engaged L{X}D` — consent group AND (Active on Site ≥1 OR
     Checkout Started ≥1 OR Added to Cart ≥1 [only if it exists] OR Opened
     Email ≥1 OR Clicked Email ≥1) in the last X days.
   - Every count condition: `type: profile-metric`, `measurement: count`,
     `measurement_filter: {type: numeric, operator: greater-than-or-equal, value: 1}`,
     `timeframe_filter: {type: date, operator: in-the-last, unit: day, quantity: X}`.
5. **Build buyer / non-buyer segments**: `<PREFIX> - Buyer` (consent AND Placed
   Order ≥1, alltime); `<PREFIX> - Non-Buyer` (consent AND Placed Order = 0,
   alltime).
6. **Build the VIP segment.** Klaviyo's metric-aggregate endpoint caps at a
   1-year window and returns unique-buyer counts, not true lifetime-buyer
   averages — default to the predictive field: `<PREFIX> - VIP (N+ Orders)`
   (consent AND `profile-predictive-analytics`,
   `dimension: historic_number_of_orders`,
   `filter: {operator: greater-than-or-equal, value: N}`). If a computed
   average is wanted instead, explain this limitation first and proceed only
   with explicit sign-off on the approximation method.
7. **Build category buyer segments.** Call `get_catalog_categories` first. If
   populated, use category conditions directly. If empty, sample `Ordered
   Product` events and inspect the `Collections` event property as a
   substitute, cross-check against the site's navigation categories (they
   often don't match 1:1), and present both levels to the requester rather than
   assuming which to segment on. Skip clearly internal collections (e.g.
   containing "DO NOT EDIT"). Each confirmed category:
   `<PREFIX> - Buyers: {Category Name}` — consent AND Ordered Product ≥1
   alltime, with a `Collections` list-contains-any filter.
8. **Confirm, then create.** If asked to show the list first, present every
   segment definition in plain language before calling `create_segment`.
   Otherwise create directly — one `create_segment` call per segment; there is
   no bulk-create endpoint. Report back the full list of created segment
   names.

## Output

- Live Klaviyo segments, created via `create_segment`.
- A short summary of segment definitions and names saved to
  `accounts/<slug>/strategy/segmentation-<date>.md`.

Deliverables are stored under the account, never in this folder. See
`governance/account-isolation.md`.

## Quality checks

- [ ] Account confirmed via `get_account_details` before any build call
- [ ] Every segment includes the consent condition as its own group, not folded
      into an OR clause
- [ ] No metric, category, or average invented — every gap surfaced and asked
      about, not worked around
- [ ] Category segments cross-checked against site navigation before creation
- [ ] Internal/non-customer-facing collections excluded
- [ ] Full segment list reported back after creation

## Tools and action boundaries

This skill **writes real objects** to the connected Klaviyo account via
`create_segment` — it is not text-only. Requires a verified Klaviyo MCP
connector per `integrations/mcp/tool-map.md`. See
`integrations/mcp/access-policy.md`.

## Account customization

Naming prefix, day-windows, and VIP threshold are inputs read from account
context or the requester — never a reason to fork this skill. The
`can_receive_marketing` consent condition as a first-class group (not folded
into OR logic) is a department-wide requirement, not a per-account default;
do not drop it for any account.

## Dependencies

Feeds `execution.flow-architecture` (segments as flow triggers/filters) and
campaign targeting more broadly. Consumes naming and threshold conventions from
`marketing-strategy.target-audience` where defined for the account.

## Examples and references

`examples/` — approved samples. Keep fictional or fully anonymized; no real
customer data, no credentials.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-28 | Ported from the Claude skill `klaviyo-segment-builder` |

# SMS Flow Audit

- ID: `execution.sms-flow-audit`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: _never_

## Purpose

Assess a client's current SMS platform (Attentive or similar) and turn it into
a build-ready plan for Klaviyo: an audit, a live flow tracker, and — once the
client already has Klaviyo email live — flow cards reconciling SMS against
existing email flows. Run this before any SMS build work starts, per the SMS
Implementation & Migration SOP. This skill covers audit and planning only; it
feeds `onboarding-migration.sms-migration` and does not cover build execution,
QA, or cutover, which remain that skill's (currently unwritten) procedure.

## Required inputs

| Input | Source | If missing |
|---|---|---|
| Read access to the client's source SMS platform | Account owner / platform credentials via the team's secret-management system | Stop. This skill never handles credentials directly. |
| Stage 1 findings, before running Stage 2 | This skill's own output | Run Stage 1 first. |
| Existing Klaviyo email flow inventory, before running Stage 3 | `get_flows` on the account's Klaviyo MCP connector, or account flow records | If no Klaviyo email flows exist yet, skip Stage 3 — every flow defaults to standalone SMS. |
| Consent verification in progress (opt-in timestamp, per profile and per list) | Account owner, running in parallel — not sequenced after this skill | Flag explicitly if consent verification has not started; do not proceed to build regardless of audit completeness. |

## Instructions

Three stages. Each stage's output feeds the next. Consent verification runs
alongside Stages 1 and 2, not after them — this skill does not replace the
SOP's consent, QA, or cutover requirements.

### When each stage applies

- Run Stage 1 whenever source-platform access is available and no audit exists
  yet.
- Run Stage 2 once Stage 1 findings exist and flows are being scoped for build.
- Run Stage 3 only if the client already has email live in Klaviyo. Otherwise
  every flow defaults to standalone SMS and Stage 3 is not needed.

### Stage 1 — SMS platform audit

Establish the current state of the source SMS platform before any build work
starts.

- **Pop-ups**: inventory every active pop-up, confirm its purpose (welcome
  offer, exit intent, desktop/mobile variant), flag gaps against a standard set
  (no always-on welcome, no exit-intent, no SMS-specific prompt), and note
  which list each feeds — this affects welcome-flow reentry logic in Stage 2.
- **Active flows**: pull every flow marked Active — step count, trigger,
  active entry sources, total sent, revenue, CTR. Flag any Active flow with
  zero active entry sources (published and counted as live but unenterable),
  and flows tied to expired discount codes or past seasonal promotions.
- **Content and structure flags**: duplicate/near-duplicate flows (welcome-flow
  sprawl), stale copy contradicting a since-changed product or offer, missing
  links/CTAs (shows as flat 0% CTR), A/B tests run well past a normal window
  with no winner declared, and low-CTR high-volume flows worth a refresh.
- **Output**: a findings table — `Finding | Detail | Flows Affected | Priority`
  — one row per finding. This is the input to Stage 2 and the audit readout
  with the Account Strategist.

### Stage 2 — live flow content & triggers tracker

Turn audit findings into flow-by-flow detail that can actually be built and
QA'd against. Keep this current as flows are built — do not reconstruct it
after the fact. One row per flow, capturing: flow name and trigger (from the
audit); status (Active / Archive candidate / Consolidation candidate); step
count and send volume; timing and delay per step; discount code or offer per
step, including whether it's still valid; segment logic and filters (e.g. has
not started checkout, has not ordered since entering); paths and branches
(click vs. no-click, new vs. returning, and where paths rejoin); build path
(integrate into an existing Klaviyo email flow, build new, or consolidate); and
a source reference (link or screenshot back to the source export, for
line-by-line QA). Log a flow here with its reason and status if it's held
pending a fix — don't drop it.

### Stage 3 — SMS flow card

Reconcile audited SMS flows against the client's existing Klaviyo email flows,
deciding what integrates and what stays standalone. Apply the
integrate-don't-mirror principle: add SMS steps into existing Klaviyo email
flows rather than building a parallel SMS journey, unless the client
specifically asked for SMS to live in its own flow. One card per flow,
capturing: flow name and build status (Not Yet Built / In Production /
Awaiting Approval / Needs Decision); Klaviyo destination (link to the existing
or new flow, or "no live counterpart"); source-platform performance (from
Stage 1, for comparison); SMS sequencing (touches, trigger, timing, splits,
filters); SMS copy once approved; and open notes needing sign-off before
build. Each flow lands in one of three outcomes:

1. **Integrated** — SMS steps added into the existing Klaviyo email flow.
2. **Standalone SMS** — a dedicated SMS-only flow, used when cadence, trigger,
   or offer timing doesn't match the email flow, or an established SMS voice
   needs preserving.
3. **Needs Decision** — a conflict (different trigger windows, discount
   structures, or reentry rules) needing an Account Strategist or client call
   before it can move to build.

The completed card set is what the Account Strategist reviews and signs off on
before anything moves to build.

## Output

- Stage 1: a findings summary table.
- Stage 2: a live flow content & triggers tracker.
- Stage 3 (when applicable): a set of SMS flow cards.

Save all three under `accounts/<slug>/strategy/sms-audit/` as the audit
deliverable. Deliverables are stored under the account, never in this folder —
see `governance/account-isolation.md`.

## Quality checks

- [ ] Every field in Stages 2 and 3 cross-checked against a source-platform
      export or screenshot line by line, never summarized from memory
- [ ] Zero-active-entry-source flows flagged in Stage 1
- [ ] Flows tied to expired codes or past promotions flagged in Stage 1
- [ ] A/B tests run past a normal window with no declared winner flagged
- [ ] Consent verification (opt-in timestamp, per profile and per list)
      confirmed in progress before Stage 3 sign-off is sought
- [ ] No flow set live as part of this workflow — everything here is
      build-only until an explicit cutover date
- [ ] Stage 3 outcome (Integrated / Standalone / Needs Decision) recorded for
      every audited flow, with reasoning

## Tools and action boundaries

This is a **read-and-document** skill: it audits the source SMS platform and,
where relevant, existing Klaviyo flows, and produces planning documents. It
does not create, edit, or set live any flow, segment, or send in Klaviyo or the
source platform — that happens only after Stage 3 sign-off, under
`onboarding-migration.sms-migration` (procedure not yet written) or
`execution.flow-architecture` for the Klaviyo build itself. Credentials for the
source SMS platform are handled per the team's secret-management system, never
recorded here. See `governance/account-isolation.md`.

## Account customization

The three-stage structure and non-negotiables are shared. Which flows exist,
their triggers, and reconciliation outcomes are account facts, captured in the
account's own audit output — never a reason to fork this skill.

## Dependencies

Feeds `onboarding-migration.sms-migration`, which covers carrier registration,
rebuild, and cutover once Stage 3 cards are signed off. Stage 3's "Integrated"
outcome hands off to `execution.flow-architecture` for the actual Klaviyo
build. Governed by the SMS Implementation & Migration SOP (referenced, not
duplicated, here).

## Examples and references

_None yet._ The source workflow this was ported from included a worked example
naming a specific client account. Per `governance/skill-authoring.md`
("client-identifying material in examples — use fictional or fully anonymized
accounts"), that example has been left out rather than ported as-is. Add a
fictional or fully anonymized worked example before promoting this skill out
of `draft`.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-28 | Ported from the Claude skill `sms-flow-audit`; worked example redacted pending anonymization (see Examples and references) |

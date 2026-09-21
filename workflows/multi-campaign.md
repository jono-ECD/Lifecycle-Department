# Multi-Campaign Workflow

- ID: `workflow.multi-campaign`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: 2026-09-20

## Purpose

Plan, build, and ship a campaign calendar for an account: promo calendar →
segmentation → copy → QA → platform draft → review → schedule. The
highest-frequency motion the department runs, so efficiency here compounds hardest.

This is the reference workflow — it demonstrates the full
context → skill → QA → deliverable path end to end.

## When to use

A campaign or set of campaigns needs to go out for an account with an approved
promo calendar. Not for one-off transactional sends or flow work (see
`flow-architecture.md`).

## Inputs

- Approved promo/content calendar entry (date, offer, audience intent)
- Account context: `accounts/<slug>/context/brand-voice.md`,
  `products-offers.md`, `messaging-constraints.md`
- Current offer details confirmed against an approved source
- Sending cadence and fatigue constraints from `context/audiences-personas.md`

Missing any of these → stop and resolve with the account owner. Do not infer offer
terms or claims.

## Steps

| # | Step | Skill | Output |
|---|---|---|---|
| 1 | Confirm account and scope | — | Correct `accounts/<slug>/` confirmed; registry entry read |
| 2 | Resolve or flag brief gaps | `execution.campaign-brief` | Complete brief, or a list of blocking unknowns |
| 3 | Define the audience | `execution.segmentation` | Segment definition + exclusions |
| 4 | Write email copy | `execution.email-copy` | Subject, preview, body copy |
| 5 | Write SMS copy (if in scope) | `execution.sms-copy` | SMS body within length + compliance limits |
| 6 | Creative direction | `execution.creative-direction` | Layout and asset direction |
| 7 | **Quality gate** | `execution.campaign-flow-qa` | Pass/fail against checklist |
| 8 | Create platform draft | — | Draft in Klaviyo, **if** authorized per `integrations/mcp/access-policy.md` |
| 9 | Human review | — | Named reviewer sign-off |
| 10 | Schedule | — | Scheduled send |

## Quality gate

Step 7 is mandatory and blocking. Nothing proceeds to step 8 on a fail. The gate
checks factual accuracy, offer terms, audience alignment, link integrity,
personalization fallbacks, and required compliance messaging.

## Action boundaries

Creating content, creating a platform draft, and scheduling or sending are three
**separate** authorizations. Holding one does not imply the others. See
`integrations/mcp/access-policy.md`.

## Completion criteria

- [ ] Brief complete, or gaps explicitly accepted by the account owner
- [ ] QA passed and recorded
- [ ] Human reviewer named and signed off
- [ ] Skill versions used are recorded with the deliverable
- [ ] Deliverables saved to
      `accounts/<slug>/campaigns/YYYY-MM-DD-campaign-name/`

## Deliverable destination

```
accounts/<slug>/campaigns/YYYY-MM-DD-campaign-name/
├── brief.md
├── copy.md
├── qa.md          # checklist result + reviewer
└── README.md      # skill versions used, decisions, links to platform objects
```

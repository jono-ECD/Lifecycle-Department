# Creative Production Workflow

- ID: `workflow.creative-production`
- Owner: _unassigned_
- Status: draft
- Version: 0.2.0
- Last reviewed: 2026-09-21

## Purpose

Brief and copy → email design → platform build. Concept to a built, reviewable
email at a consistent quality bar, without replacing creative judgment.

The deliverable at step 6 is a **JSON definition in a PR** — reviewable,
diffable, and buildable by `create_dnd_email_template` without translation. The
platform build is a separate, separately authorized step.

## When to use

An email is needed for a campaign or flow message and the brief is approved. For
a full campaign calendar use `multi-campaign.md`; for flow structure use
`flow-architecture.md`.

## Inputs

- Approved brief — `accounts/<slug>/campaigns/<campaign>/brief.md`
- Account context — `brand-voice.md`, `products-offers.md`,
  `messaging-constraints.md`
- **Design tokens** — `accounts/<slug>/context/design-tokens.json`
- Image assets, by URL or existing asset ID
- Offer terms confirmed against an approved source, with the confirmation date

Missing any of these → stop and resolve with the account owner. Do not infer
offer terms or claims.

## Prerequisite: the account has a design system

This workflow assumes `design-tokens.json` exists and is confirmed. Without it,
step 5 produces a one-off that teaches the next build nothing, and the account
accumulates templates instead of a system.

If tokens are marked `status: target_state`, they are a proposal. Confirm them
before building production creative.

## Steps

| # | Step | Skill | Output |
|---|---|---|---|
| 1 | Confirm account and scope | — | Correct `accounts/<slug>/` confirmed via `registry.yml`; `agent_access` ceiling noted |
| 2 | Resolve or flag brief gaps | `execution.campaign-brief` | Complete brief, or a list of blocking unknowns |
| 3 | Write copy | `execution.email-copy` | Subject, preview, body, CTA, tokens + fallbacks |
| 4 | Creative direction | `execution.creative-direction` | Layout and asset direction against the design system |
| 5 | Build the design | `execution.email-design` | `design.json` + `design.md`, validator clean |
| 6 | **Quality gate** | `execution.campaign-flow-qa` | Pass/fail against the checklist |
| 7 | Human review | — | Named reviewer sign-off, per the account's approval process |
| 8 | Create platform draft | — | Klaviyo template + campaign draft, **only if `agent_access: draft`** |
| 9 | Schedule or send | — | **Human-only, per instance. Never an agent.** |

Steps 2 and 4 depend on skills that are **not yet built** — see
`skills/CATALOG.md`. Until they exist, do those steps manually and record what
was decided.

## Quality gate

Step 6 is mandatory and blocking. Nothing proceeds to step 8 on a fail.

Step 5 carries its own mechanical pre-gate, which must be clean before step 6:

```
python3 scripts/validate_dnd.py accounts/<slug>/campaigns/<campaign>/design.json \
    --tokens accounts/<slug>/context/design-tokens.json
```

Errors block. Warnings are justified in `design.md` or fixed.

## Action boundaries

Creating content, creating a platform draft, and scheduling or sending are three
**separate** authorizations. Holding one never implies the others.

| Step | Needs |
|---|---|
| 1–7 | Nothing beyond repo access — the output is files |
| 8 | `agent_access: draft` with a named `owner` in `accounts/registry.yml` |
| 9 | **A human.** No configuration grants this |

Uploading an image asset is a write. See `integrations/mcp/access-policy.md`.

## Completion criteria

- [ ] Brief complete, or gaps explicitly accepted by the account owner
- [ ] Copy approved and unchanged between approval and build
- [ ] `validate_dnd.py` clean; warnings justified in `design.md`
- [ ] QA passed and recorded
- [ ] Human reviewer named and signed off, per the account's approval process
- [ ] Skill versions recorded with the deliverable
- [ ] Authorization recorded if step 8 ran
- [ ] New reusable sections flagged as Universal Content candidates

## Deliverable destination

```
accounts/<slug>/campaigns/YYYY-MM-DD-campaign-name/
├── brief.md
├── copy.md
├── design.json    # the DnD definition
├── design.md      # rationale, assets, validator output
├── qa.md          # checklist result + reviewer
└── README.md      # skill versions, decisions, authorization, platform object ids
```

## Why the design step is not optional

An email exported as a flat image has no typed blocks, so nothing downstream can
read or modify it — including this workflow. That makes step 8 meaningless
(upload one image, place one block) and step 5 unrepeatable.

Modular live-text design is what makes the workflow mechanically possible, not a
quality preference layered on top. `execution.email-design` enforces it, and
`validate_dnd.py` measures it.

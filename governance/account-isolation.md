# Account isolation

## Folders are organization, not access control

Everyone with repository access can read every account folder. If accounts require
genuinely different access permissions, that needs separate repositories or
restricted storage — not a folder convention. Document where authoritative account
context lives and how authorized workflows retrieve it.

**This repository currently provides no access separation between accounts.**
Treat that as a known limitation, not a solved problem.

## The account check

Confirm the account before doing anything else, and confirm that every input
belongs to it. Applying one account's voice, offers, or constraints to another is
the most damaging error available here — and it is silent, because the output
looks entirely plausible.

Resolve accounts through [`../accounts/registry.yml`](../accounts/registry.yml) by
slug. Never hardcode a Klaviyo account ID in a skill, workflow, or script.

## What must not be in this repository

- Credentials or API keys. These live in the team's secret manager. Documentation
  may name the required connection or secret; never its value.
- Raw customer records.
- Client-identifying material in shared examples — use fictional or fully
  anonymized accounts.
- Unreleased offer terms in shared templates.

## Deliverables

Work product belongs to its account, under
`accounts/<slug>/{strategy,campaigns,flows,reporting}/`. Never in `skills/`,
`workflows/`, or `templates/`.

## Ownership

| Role | Responsible for |
|---|---|
| Library owner | Shared conventions, catalog health, structure |
| Skill reviewer | Correctness of a given shared skill |
| Account owner | Accuracy and currency of that account's context |

One person may hold several roles initially. Every account must have a named owner
in its README before it is used for delivery.

## Maintenance rhythm

- Skills: review when edited.
- Account context: review when offers or strategy change, and before any campaign
  that depends on a time-sensitive fact.
- Catalog: review monthly for stale owners, broken links, and retired procedures.

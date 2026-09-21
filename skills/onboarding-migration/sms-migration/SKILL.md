# SMS Migration

- ID: `onboarding-migration.sms-migration`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: _never_

## Purpose

Moving an existing SMS program into Klaviyo without losing subscribers, consent records, or compliance standing. Highest-risk onboarding motion: consent and carrier registration failures are expensive and slow to unwind.

## Required inputs

- Current SMS provider export (subscribers + consent timestamps + source)
- Carrier registration status (10DLC / toll-free / short code)
- Existing automation inventory
- Compliance and disclosure language

If a required input is missing, stop and request it from the account owner rather
than inferring it. Record the gap in the account README.

## Instructions

> **Not yet written.** This skill is scaffolded from the department service
> taxonomy: purpose, inputs, and outputs are settled; the step-by-step procedure
> is not. Do not rely on this skill for delivery until this section is complete
> and status is `approved`.

1. Confirm the account and scope against `accounts/<slug>/README.md`.
2. Load the required account context listed above.
3. _Procedure to be documented._
4. Run the quality checks below.
5. Save the output to the destination named under Output.

## Output

- Migrated subscriber list with consent provenance intact
- Registered and verified sending numbers
- Rebuilt SMS automations
- Compliance record and cutover log

Deliverables are stored under the account, never in this folder. See
`governance/account-isolation.md`.

## Quality checks

_To be defined with the procedure. Until then, department quality standards in
`department/quality-standards.md` apply as the minimum bar._

## Tools and action boundaries

Account data access is not uniform — resolve the account through
`accounts/registry.yml` and confirm a connector exists before promising live data.
See `integrations/mcp/tool-map.md` for verified capabilities.

## Account customization

Account facts belong in `accounts/<slug>/context/`, not in this skill. Create an
account-local skill only when the *procedure* differs, not the inputs. See
`governance/skill-authoring.md`.

## Dependencies

`full-implementation` for flow architecture. Blocks on carrier registration lead times — sequence this first, not last.

## Examples and references

_None yet._

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-20 | Scaffolded from department service taxonomy |

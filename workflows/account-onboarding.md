# Account Onboarding Workflow

- ID: `workflow.account-onboarding`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: 2026-09-20

## Purpose

Take a signed account from kickoff to a running lifecycle program: integration, context capture, flow architecture, build, QA, and handoff. The first full pass through both strategy and execution for a new account.

## When to use

A new account has been signed and scoped. Choose the matching implementation skill (`onboarding-migration.full-implementation` or `.mini-implementation`) based on the signed scope.

## Inputs

- Signed scope and timeline
- Platform and ESP integration access
- Brand assets, voice, and offer strategy
- Historical performance baseline

## Steps

> **Not yet written.** Purpose and scope are settled; the ordered procedure,
> handoffs, and skill bindings are not. See `multi-campaign.md` for the
> reference shape this should take.

## Quality gate

`execution.campaign-flow-qa` before anything sends. Deliverability and consent checks are blocking.

## Completion criteria

_To be defined with the steps._

## Deliverable destination

`accounts/<slug>/strategy/ and flows/`

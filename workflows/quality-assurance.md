# Quality Assurance Workflow

- ID: `workflow.quality-assurance`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: 2026-09-20

## Purpose

The gate before anything reaches a customer: links, rendering, personalization fallbacks, segment logic, consent, and compliance. The cheapest workflow to build and the most expensive one to skip.

## When to use

Before every send, every flow activation, and every platform draft that a human will approve. No exceptions path.

## Inputs

- The asset, flow, or campaign under review
- Segment and targeting definition
- Account messaging constraints and compliance standards

## Steps

> **Not yet written.** Purpose and scope are settled; the ordered procedure,
> handoffs, and skill bindings are not. See `multi-campaign.md` for the
> reference shape this should take.

## Quality gate

This workflow **is** the gate. A fail blocks the deliverable; it does not generate a warning to be overridden without a named approver.

## Completion criteria

_To be defined with the steps._

## Deliverable destination

`accounts/<slug>/campaigns/<campaign>/qa.md or flows/<flow>/qa.md`

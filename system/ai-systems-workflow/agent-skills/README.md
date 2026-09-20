# Agent Skills

Authored, versioned skills the department's agents load. This is the compounding asset: a skill written once for one client runs for every client through the registry. Skills read account identity from `clients/registry.yml` and never hardcode an account ID.

## Inputs
- A repeatable task currently done by hand
- The SOP or checklist a human follows today
- Worked examples of good and bad output

## Outputs
- Versioned skill definition
- Trigger description precise enough to fire correctly
- Eval cases covering the failure modes

## Depends on
`clients/registry.yml` for account resolution. Every workflow below is composed of these.

## Reusable assets
_Templates, prompts, checklists, and SOPs live in this folder. Client output does not._

| Asset | Type | Status |
|---|---|---|
| — | — | not yet built |

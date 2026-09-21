# MCP integration

How agent work connects to Klaviyo and analytics tooling.

- [`tool-map.md`](tool-map.md) — which business actions map to **verified**
  capabilities, and what is still pending
- [`access-policy.md`](access-policy.md) — action classes and who may authorize
  what

## What this repository is and is not

This repository is the source of truth for **instructions**. It is not itself an
integration. Folder structure alone makes nothing available to an agent or to
Composer — the runtime must explicitly be given the skill instructions and account
context it should load.

Do not assume an assistant can see this repository unless the integration
explicitly provides access.

## Configured connections

| Connection | Owner | Accounts covered |
|---|---|---|
| Klaviyo MCP (per-account) | _unassigned_ | Blessed Botanicals, Lazy Leaf |
| Hiro Analytics | _unassigned_ | Blessed Botanicals (id `128074`) |

Owners are unassigned — assign them before relying on these for delivery.

## Before using a capability

1. Confirm the account by slug against `accounts/registry.yml`.
2. Confirm the capability is listed **verified** in `tool-map.md`.
3. Confirm the action class is authorized in `access-policy.md`.

Any of the three failing means stop and say so.

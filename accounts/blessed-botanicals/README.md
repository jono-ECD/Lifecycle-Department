# Blessed Botanicals

<!-- BEGIN:generated:account-header -->
| | |
|---|---|
| **Slug** | `blessed-botanicals` |
| **Klaviyo account** | `RaFbmF` (verified) |
| **Data access** | Klaviyo MCP + Hiro (id 128074) |
| **Agent may** | `read_only` (owner: _unassigned_) |
| **Registry entry** | [`accounts/registry.yml`](../registry.yml) |
<!-- END:generated:account-header -->

Identity and data access above are generated from
[`accounts/registry.yml`](../registry.yml). Do not restate IDs elsewhere in this
folder.

| | |
|---|---|
| **Account owner** | _unassigned — assign before delivery work_ |

## Account context

Founder-led botanical wellness on Shopify — ~26 organic herbal extracts and clean
skincare, built by Brittany and Ashton Spink after Ashton's late-stage Lyme
diagnosis. Subscriptions (Seal) plus one-time. ~$83 AOV against a $100–140
target, 64% repeat rate, ~90K Shopify records, **~90% mobile traffic**.

The defining tension: **product education is the conversion lever and the
compliance risk at the same time.** Customers need to understand what each herb
does before buying, and the brand cannot make medical claims.

Detail lives in [`context/`](context/), captured 2026-09-21:

| File | Covers |
|---|---|
| [`business.md`](context/business.md) | Model, stack, ECD scope, contacts, open flags |
| [`brand-voice.md`](context/brand-voice.md) | Voice, founder story, specificity rule, approved phrases |
| [`messaging-constraints.md`](context/messaging-constraints.md) | **No medical claims**, 25% discount ceiling, approval process |
| [`audiences-personas.md`](context/audiences-personas.md) | Three personas, sale fatigue, cadence gaps |
| [`products-offers.md`](context/products-offers.md) | Catalog, $34/$49 price architecture, standing offers |
| [`design-system.md`](context/design-system.md) | Brand palette and type, and why none of it is live in Klaviyo |
| [`design-tokens.json`](context/design-tokens.json) | Machine-readable tokens, shaped for the Klaviyo DnD API |

## Active workstreams

| Workstream | Skill / workflow | Status | Owner |
|---|---|---|---|
| Email design system | `design-system.md` + `design-tokens.json` | Captured — **pending rebrand confirmation** | _unassigned_ |
| Account context capture | — | Done for 5 of 5 files; gaps marked inline | _unassigned_ |
| Subscriber churn flow | `execution.flow-architecture` | **Not built — Ashton top-3 priority** | _unassigned_ |

## Working notes

**Before any send:**

- No medical claims, ever. Every herb-specific email is client-reviewed. The
  founder story is a compliance surface, not just an asset.
- 25% discount ceiling. Lead with tiered AOV or gift-with-purchase — the list has
  12+ months of sale fatigue.
- Approval goes through the mockups reviewer sheet. An email once went live
  without sign-off; enforce the checkbox.

**Known problems:**

- **Deliverability 60 against a 90+ goal** (2026-04-22). Emails are built as
  stacked JPEGs with no live text, which plausibly contributes and also makes
  them impossible to build or edit through the Klaviyo MCP. See
  [`design-system.md`](context/design-system.md).
- `ECD - AB CART EM 1` (`ShTq9R`) sets white link colour on a white background.
  Unverified against a render — check before the next send.
- Two product names contain claim language: "Jasiel's Blend — Powerful Blend to
  Block Spike Protein Replication" and "Organic Got Pain?".
- Instagram handle conflict: Copy Guide says `blessedbotanicalsofficial`, the
  live Klaviyo footer links `blessedbotanicalsextracts`.

**Needs an answer:**

- Is the April 2026 rebrand approved and live? Blocks the design system.
- SMS constraints are uncaptured while SMS is live in four flows.
- No documented send-frequency ceiling or suppression rules.

Client-side assets live in Drive folder `1d-AsNmFOiNaa5btTvmCzZCPVsmHdrxOv`.
Pull by file ID; never commit binaries here.

---
Folder conventions: [`../README.md`](../README.md#folder-conventions).
Shared skills are referenced via [`skills/CATALOG.md`](skills/CATALOG.md), never
copied into this folder.

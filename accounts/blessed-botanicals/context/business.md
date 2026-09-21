# Business — Blessed Botanicals

_Captured 2026-09-21 from the ECD NTK (May 2026) and the client Copy Guide
(Drive `1nDDU2k3yqksGm3r9PrubllxtcHyPPmAPJjJD3T6T_lo`)._

## Model

DTC ecommerce on Shopify. Founder-led botanical wellness — organic herbal
supplements and clean skincare, ~26 products.

Revenue mix is **subscription (Seal) plus one-time purchase.** Subscribers carry
a 15% discount and are the stated retention priority. A **wholesale/B2B** line
is scoped but not built.

| | |
|---|---|
| Average order value | **~$83** |
| Target AOV | **$100–140** |
| Repeat buyer rate | **64%** |
| Reviews | 264+ (Yotpo) |
| Customer records in Shopify | **~90K** |
| Traffic | **~90% mobile** |

The founders are Brittany and Ashton Spink. The brand began when Brittany, then
in a pre-med program, researched herbal approaches after Ashton was diagnosed
with late-stage Lyme disease. Faith-rooted, family-led, built from lived
experience — see [`brand-voice.md`](brand-voice.md).

## Revenue and seasonality

_Partially captured._ No revenue figures, peak/trough months or normal-month
baseline are recorded. What is known:

- **$22K from warm-up campaigns alone**, before any flows were live.
- An email list 3+ years old that is **still highly engaged** — unusual, and a
  real asset.
- Seasonal promo rhythm: **May** Mother's Day tiered, **June** Father's Day
  gift-with-purchase. BFCM has a Drive folder, so Q4 is planned.
- **12+ months of 25%-off-sitewide** before ECD, which trained the list to wait
  for discounts. Sale fatigue is an active commercial constraint.

Pull actual revenue and seasonality from Hiro (client `128074`) before planning
a calendar.

## Platform stack

| Layer | Tool |
|---|---|
| Store | Shopify |
| ESP | Klaviyo (`RaFbmF`) — see [`../platform/klaviyo.md`](../platform/klaviyo.md) |
| Subscriptions | Seal |
| Reviews | Yotpo |
| Quiz | Octane AI — **structure not yet supplied by client** |
| Direct mail | PostPilot |
| Analytics | Hiro (client `128074`) |
| Chatbot | Klaviyo AI Customer Agent — in build |

## Commercial constraints

- **Discount ceiling 25%, no exceptions.**
- **Moving off sitewide percentage-off** as the primary hook. Tiered AOV and
  gift-with-purchase are the approved formats.
- **No medical claims** — a regulatory constraint that directly limits the
  product education the audience needs. The defining tension of the account; see
  [`messaging-constraints.md`](messaging-constraints.md).
- **Promo codes must not appear on social.** Protects email value and
  attribution.
- **Deliverability at 60 against a 90+ goal** (2026-04-22). A ceiling on send
  volume until it improves.
- Margin bands, inventory limits and fulfilment constraints are **not
  captured.**

## What ECD is delivering

### Flows

| Flow | Status |
|---|---|
| Welcome | ✓ Live — founder photo + About Us, 7-day dynamic coupon |
| Back in Stock | Built, awaiting client sign-off |
| Abandoned Cart | In build — priority. **ECD must turn off Shopify's native abandoned cart at launch** |
| Browse Abandonment | Planned |
| Checkout Abandonment | Planned |
| Post-Purchase | Planned |
| **Subscriber retention / churn** | **Not built — Ashton top-3 priority** |
| Quiz-triggered (segmented) | Blocked on client quiz structure |
| Wholesale application | Scoped |
| Chatbot launch campaign | Planned |

### Ongoing email management

15 campaigns/month (excludes warm-up sends). Promo calendar built bi-monthly,
reviewed on monthly strategy calls. Client may request products, launches or
promos at any time.

**Messaging pillars:** founder story · product education (no medical claims) ·
social proof · purity and transparency · subscription value · seasonal/AOV promos.

**Campaign concepts ready to brief:** "Letter from Ashton" · "What's NOT in our
products" · herb spotlight series · subscriber milestone emails · quiz-result
nurture · behind-the-scenes.

### Klaviyo AI Customer Agent

Complimentary setup ($2,500 value), 8–10 business days. Intake form with
Brittany. Base includes install, brand-voice customisation, knowledge base and
FAQ training, product recommendation logic, Klaviyo profile integration, QA and
launch. Paid add-ons — Lead Capture Optimization, Lifecycle Flow Integration
($400–800), Advanced Sales Logic — **Brittany signed; Ashton and Mason not yet
confirmed.** Build with add-ons from day one rather than retrofitting.

### PostPilot direct mail

Setup ($2,500) and management ($500/mo) waived; client pays platform ($500/mo)
plus postage (~$0.59/postcard). ECD manages integration, segmentation, design,
flow builds, execution and reporting.

Recommended start **3,000–4,000 contacts/month** to validate ROI before scaling.
**No opt-in required for direct mail**, so the full ~90K Shopify database is
addressable — the largest reachable audience on the account. Postcards take 3–5
days, so **evergreen or long-window promos only.**

## Key contacts

| Role | Name | Approves |
|---|---|---|
| Founder | Ashton Spink | Final approval |
| Founder | Brittany Spink | Final approval |
| Tech / ops | Mason | — |
| Account strategist | Mariana | Primary contact, ongoing + PostPilot |
| Account strategist | Luis | Supports |
| Retention | Jo | — |
| Design | Paz | — |

**Approval process:** all campaigns approved in the mockups reviewer sheet
(Drive `1DnnkjHBhD4Im6V80DoDgwRYLt3cW3v8i-PA24lgAYNk`) before send. No
text-message approvals. An email went live without sign-off early in the
engagement — enforce the checkbox.

**Call cadence:** monthly strategy calls, biweekly preferred. Mariana primary.

> **Account owner in [`../README.md`](../README.md) is still `unassigned`.**
> Mariana is primary client contact, but the repo's authorization owner is a
> separate question — see `integrations/mcp/access-policy.md`.

## Open items from the NTK

| Flag | Owner |
|---|---|
| Octane AI quiz structure outstanding — blocks multiple flow builds | Client, chase |
| Shopify native abandoned cart must be switched off before the Klaviyo flow goes live | **ECD** |
| Subscriber churn flow not built, top-3 priority | ECD, scope now |
| Chatbot add-ons unconfirmed with Ashton + Mason | Verify before dev scopes |
| PostPilot budget, segments and campaign direction not finalised | Mariana |
| Deliverability 60 → 90+ | Monitor, share milestones |

# Messaging constraints — Blessed Botanicals

_Captured 2026-09-21 from the ECD NTK (May 2026) and the client Copy Guide
(Drive `1nDDU2k3yqksGm3r9PrubllxtcHyPPmAPJjJD3T6T_lo`)._

What may not be said, and what must be.

> **An empty section here means "not yet captured", never "no constraints".**
> If a constraint is unknown, treat the area as restricted and ask the account
> owner before sending. Getting this wrong is a client-facing incident, not a
> style error.

## Prohibited claims

**No medical claims. No outcome guarantees. No exceptions.** This is the single
hardest constraint on the account and the NTK flags it twice: every email with
herb-specific language must be client-reviewed before send, and *"they are
vigilant and will flag inaccurate claims."*

Never say a product treats, cures, prevents or diagnoses disease.

| Never say | Say instead |
|---|---|
| Cures Lyme | — no equivalent; do not approach this claim |
| Eliminates anxiety | Helps support calm nighttime routines |
| Heals disease | Supports immune function |
| Fixes your hormones | Supports the body's stress response |
| Detoxes your body overnight | Traditionally used to support digestion and detox pathways |

Approved grammatical frames: *supports…*, *helps support…*, *traditionally used
to support…*, *made to fit into…*.

**The founder story is a compliance surface.** Ashton's recovery from late-stage
Lyme is the brand's most powerful asset and its biggest claim risk. Tell it as
lived experience. Never state or imply the formulas treated or cured the
disease, and never place a product name next to the recovery as cause and
effect.

**Customer reviews are subject to the same rule.** Reviews may show experience,
taste, ease of use and routine consistency. They may not be edited into medical
claims or used to imply guaranteed outcomes.

## ⚠ Product names that are themselves claims

Two SKUs carry claim language in the product name:

- **"Jasiel's Blend — Powerful Blend to Block Spike Protein Replication + Much
  More!"**
- **"Organic Got Pain?"** (lower risk, but still a symptom reference)

A product name renders inside `product` blocks and subject lines, so the "no
medical claims" rule and the product catalog currently contradict each other.
**Unresolved — raise with the account owner before either SKU appears in a send.**
Do not quietly rename in copy; that creates a mismatch with the storefront.

## Promo guardrails

| Rule | Detail |
|---|---|
| **Discount ceiling** | **25% off maximum. No exceptions.** |
| **Moving away from** | Sitewide percentage-off as the main hook. Client stated this explicitly after 12+ months of sale fatigue. |
| **Approved format** | Tiered AOV promos (spend $90 → $10 off / $120 → $20 off / $150 → free gift) and gift-with-purchase |
| **Email exclusive** | Promo codes must **not** be posted on social. Undermines email value and muddies attribution. |
| **Code expiry** | Always include. Flow coupons auto-expire; for campaigns, confirm the end date with the client **every time**. |

Sale fatigue is real here — the NTK warns percentage-off copy may underperform in
early campaigns. Lead with tiered/AOV or gift-with-purchase.

## Required disclosures

_Not yet captured._ No FDA structure/function disclaimer requirement is recorded
in either source. Supplement marketing in the US normally carries one.
**Confirm with the client before the next send** and record the answer here.

Currently present in the Klaviyo footer: unsubscribe link, organisation name and
full address.

## Regulatory context

_Partially captured._ The category is dietary supplements and cosmetics in the
US, which brings FDA and FTC substantiation rules into scope. Neither source
names a specific regime or a legal reviewer. **Treat as restricted and confirm.**

## Legal and client review triggers

- **Every email containing herb-specific language** → client review before send.
- **Any reference to the founder story alongside a product** → client review.
- **Anything touching the two claim-bearing product names above** → account owner
  first.

## Approval process

**All campaigns must be approved in the mockups reviewer (Google Sheet) before
send.** No text-message approvals. No campaign goes live without a checkbox or
written sign-off.

> The NTK records that **an email went live without confirmed sign-off early in
> the engagement.** Enforce the checkbox — no exceptions.

Mockups reviewer: Drive `1DnnkjHBhD4Im6V80DoDgwRYLt3cW3v8i-PA24lgAYNk`.

## AI-generated copy

The Copy Guide forbids publishing AI output as-is. Final copy is always reviewed,
fact-checked and refined by a human writer. This binds every skill in this repo
that drafts for this account.

## SMS-specific

_Not yet captured._ Consent language, opt-out text, quiet hours and carrier
limits are not recorded. SMS is in scope (the Copy Guide references texts in the
Welcome, Abandoned Cart, Abandoned Checkout and Back in Stock flows), so this gap
is live. **Treat SMS as restricted until captured** — see
`skills/CATALOG.md`, which already blocks `execution.sms-copy` on this section.

## Deliverability

Score was **60 as of 2026-04-22 against a 90+ goal.** The NTK notes Ashton
watches this closely and responds well to progress updates. Sending practice —
volume, segment hygiene, image-to-text ratio — is a constraint on this account,
not just a metric. See [`design-system.md`](design-system.md) for the image-only
build problem that plausibly contributes.

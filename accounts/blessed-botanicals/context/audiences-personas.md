# Audiences and personas — Blessed Botanicals

_Captured 2026-09-21 from the ECD NTK (May 2026) and the client Copy Guide
(Drive `1nDDU2k3yqksGm3r9PrubllxtcHyPPmAPJjJD3T6T_lo`)._

Who we are talking to, mapped to segments that can actually be built.

## Core segments

The NTK describes three audiences. **None has been built or sized against the
live account yet** — the definitions below are proposals for
`execution.segmentation`, not existing segments.

| Segment | Definition | Approx size | Notes |
|---|---|---|---|
| Subscribers (auto-ship) | Active Seal subscription | _unknown_ | **Retention is the top priority per Ashton.** Churn-prevention flow not yet built. |
| Chronic-condition seekers | Engagement with founder-story or condition-adjacent content | _unknown_ | Highest emotional resonance; highest claim risk |
| Clean-wellness households | Purchasers with no subscription, repeat or single | _unknown_ | 64% repeat buyer rate overall |
| Legacy engaged | On list 3+ years, still opening | _unknown_ | NTK: list from 3+ years ago is still highly engaged; $22K from warm-up campaigns alone, pre-flows |
| Quiz respondents | By Octane AI outcome path (sleep, energy, immune, hormonal) | _unknown_ | **Blocked** — client has not supplied the quiz structure |
| Wholesale leads | Klaviyo form on the wholesale tab | _unknown_ | B2B onboarding flow scoped, not built |

Sizes must be read from the account before any of these is used in a send.

## Personas

### 1. The clean-wellness household buyer

Health-conscious adults, skewing women purchasing for the whole household.

- **Motivation** — believes in herbal wellness, actively rejects synthetic
  ingredients. Usually found the brand through trusted word of mouth: TikTok, a
  podcast, or an affiliate.
- **Objection** — *doesn't know which product is right for them.* This is the
  single biggest friction point on the account.
- **What resolves it** — the quiz and the chatbot, plus routine-builder content
  that explains which product does what.
- **Angle that works** — "There's no one-size-fits-all approach. What does your
  body need?" Start from the need, not the catalog.

### 2. The chronic-condition seeker

People managing Lyme, inflammation or hormonal imbalance who feel failed by
conventional medicine.

- **Motivation** — Ashton's recovery story resonates deeply; they see themselves
  in it.
- **Objection** — sceptical of supplement-industry quality after being let down
  before.
- **What resolves it** — purity positioning (what is *not* in it) plus the
  founder story as lived experience.
- **Angle that works** — "We made this for us first. Now we make it for you."
- **⚠ Highest compliance risk on the account.** This reader is looking for a
  treatment claim. Do not supply one. See
  [`messaging-constraints.md`](messaging-constraints.md).

### 3. The auto-ship subscriber

- **Motivation** — routine, reliability, and the 15% subscription discount.
- **Objection** — _not captured._ Churn drivers are unknown; no exit survey or
  cancellation-reason data is recorded.
- **Angle that works** — consistency. "Consistency changes everything." One
  bottle as 30 days of support.
- **Priority** — Ashton flagged subscriber retention as **top-3**. The
  churn-prevention flow is not yet built.

> Each persona must map to a queryable cohort before use — see
> `marketing-strategy.customer-persona`. None is mapped yet.

## The universal objection: product education

The NTK names this as the biggest friction on the account:

> Customers need to understand what Cat's Claw, Moringa and Black Seed Oil do
> before buying — but the brand cannot make medical claims. **Walk the line
> carefully.**

This is the defining tension of the account. Education is the conversion lever
*and* the compliance risk, and they pull against each other. The resolution is
the specificity rule in [`brand-voice.md`](brand-voice.md): be concrete about
what the herb *supports*, never about what it treats.

## Sale fatigue

12+ months of 25%-off-sitewide trained this list to wait for discounts. Any
percentage-off hook may underperform. Treat trained discount-waiting as an
audience characteristic, not just a promo rule.

## Channel and device

- **~90% mobile traffic.** Design mobile-first, no exceptions.
- Email is the core owned channel. SMS is in scope across several flows.
- Direct mail via PostPilot reaches **~90K Shopify customer records** with no
  opt-in requirement — the largest addressable audience on the account, and the
  only one not gated by consent.

## Contact cadence and fatigue

| | |
|---|---|
| Campaign volume | **15 campaigns/month** under ongoing management (excludes warm-up sends) |
| Sends-per-week ceiling | _not captured_ |
| Quiet periods | _not captured_ |
| Suppression rules | _not captured_ |

Three of four unknown. With deliverability at 60 against a 90+ goal, **the
absence of a documented fatigue rule is itself a risk.** Capture before scaling
volume.

## Who this brand is not for

_Not captured._ No explicit exclusions are recorded in either source.

Inferable but **unconfirmed**: people looking for a fast fix or a single
miracle product, and anyone wanting a clinical or pharmaceutical framing. Do not
treat as settled — confirm with the client.

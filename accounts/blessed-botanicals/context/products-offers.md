# Products and offers — Blessed Botanicals

_Captured 2026-09-21 from the product export (Drive
`1RZmfAMqBI14hW3epO6Nqqy0vYMxAXRNqaLPw--L0GPA`, 2026-04-22), the client Copy
Guide and the ECD NTK (May 2026)._

## Catalog shape

44 export rows, **~26 distinct products** (most extracts ship in 2oz and 4oz).
Organic herbal extracts and tinctures, plus topicals, skincare, oils and gift
cards. Zero synthetic fillers, zero synthetic fragrance.

### Price architecture

| Tier | Price | What |
|---|---|---|
| Extract, 2 oz | **$34** | Standard entry size across nearly the whole extract range |
| Extract, 4 oz | **$49** | Standard value size |
| Topical salve, 2 oz | $25 | Muscle Salve, Poke Root Salve |
| Body / mist | $20 | Hydrating Body Lotion, Magnesium Mist |
| Skincare | $39 | Eternal Youth Serum, Pearl Powder Face Cream, Lavender Glow Serum |
| Carrier oils, 16 oz | $35–49 | Castor, Jojoba |
| Gift cards | $25 / $35 / $50 / $100 | |

Pricing is unusually uniform — **$34/$49 covers most of the catalog.** That makes
AOV tiers easy to reason about: $90 ≈ two 2oz + a topical; $150 ≈ three 4oz.

## Hero products

Named in the Copy Guide with their required framing. **Use this framing, not
your own.**

| Product | Frame around | Price |
|---|---|---|
| Organic Black Seed Oil | Immune function, respiratory wellness, inflammation response, whole-body balance | $34 / $49 |
| Organic Moringa | Natural energy, daily nutrient intake, metabolism, antioxidants, amino acids, vitamins. May be positioned as a daily staple / multivitamin-style support | $34 / $49 |
| Organic Lemon Balm | Nervous-system calm, stress balance, restful evenings, racing thoughts, gentle relaxation without heavy sedation | $34 / $49 |
| Organic Liver Cleanse | Digestion, liver function, bile flow, kidney and gallbladder support, foundational daily cleanse | $34 / $49 |
| Organic Candida Cleanse | Gut wellness, microbial balance, sugar cravings, yeast concerns, brain fog, sluggishness | $34 / $49 |
| Organic Cortisol Control | Stress response, recovery, balance, helping the body adapt | $34 / $49 |
| Organic Breathe Easy | Lung health, respiratory comfort, soothing herbal support | $34 / $49 |
| Wildcrafted Irish Sea Moss | Daily mineral support, natural energy, thyroid support | **$40** (2 oz) — confirmed live on the storefront 2026-10-12; outside the $34/$49 architecture |
| Muscle Salve / Poke Root Salve | Topical support, recovery, soreness, targeted body care | $25 |
| Skincare & sun care | Ingredient integrity, skin-barrier support, hydration, lightweight wear, no greasy or synthetic feel | $20–39 |

Full catalog also includes Ginkgo Biloba, Gotu Kola Blend, Sleepy Time, Got
Pain?, Oregano Extract, Elderberry Blend, Men's Health Extract, Soursop,
Jasiel's Blend, Magnesium Mist, Castor and Jojoba oils.

> **Irish Sea Moss** is live on the storefront at $40 (confirmed 2026-10-12 via
> the Shopify Admin MCP). **Cat's Claw** is named in the Copy Guide and NTK but
> was not seen in the April export or on the two collections read so far —
> confirm before featuring.

## Products with no approved framing

The Copy Guide frames the hero products above and nothing else. These products
sit in live collections and have **no recorded framing**; copy featuring them
draws only on the client-published collection description and goes to client
review:

| Product | Collection | Collection-page language (client-published, 2026-10-12) |
|---|---|---|
| Organic Ginkgo Biloba | Energy & Focus | focus support, mental clarity, brain health, daily vitality |
| Organic Sleepy Time | Sleep Support | restful sleep, nighttime calm, soothing evening routine |
| Organic Chill Pill | Sleep Support | as above; **URL slug carries claim language** |
| Magnesium Mist ($20, 4 oz topical) | Sleep Support | as above |

Product-page URL slugs for Sleepy Time and Chill Pill contain condition words.
Never surface a slug as text.

## Storefront collections read 2026-10-12

| Collection | Handle | Products | Type |
|---|---|---|---|
| Energy & Focus | `energy-focus` | Moringa, Liver Cleanse, Irish Sea Moss, Cortisol Control, Ginkgo Biloba | manual, best-selling sort |
| Sleep Support | `sleep-support` | Lemon Balm, Magnesium Mist, Sleepy Time, Chill Pill | manual, best-selling sort |

Collection pages show the 2 oz price only. The Klaviyo catalog API returns no
items for this account — Shopify-integrated catalog items are not readable
through it, so product blocks cannot be verified by an agent.

## ⚠ Two product names carry claim language

**"Jasiel's Blend — Powerful Blend to Block Spike Protein Replication + Much
More!"** and **"Organic Got Pain?"**. Product names render in `product` blocks
and subject lines. See [`messaging-constraints.md`](messaging-constraints.md) —
unresolved, raise before either appears in a send.

## Entry products

_Not confirmed from data._ The uniform $34 2oz tier is the structural entry
point, and Black Seed Oil, Moringa and Lemon Balm are the most-referenced heroes
— but **first-order product mix has not been read from the account.** Query
before relying on this.

## Replenishment

One bottle is positioned as **30 days of support** (Copy Guide). That implies a
~30-day replenishment cycle for extracts, which sets subscription cadence and
post-purchase timing.

Per-product consumption cycles are **not captured**. Topicals, oils and skincare
will differ from extracts.

## Cross-sell logic

The Copy Guide gives the *principle* — a routine-builder should explain how each
product supports a different part of the day, never throw best sellers together
without meaning. It gives one explicit pairing:

| If bought | Offer next | Why |
|---|---|---|
| Organic Liver Cleanse | Organic Candida Cleanse | They work together — foundational liver/bile support alongside targeted gut and microbial balance. **Copy must explain the distinct role of each.** |

Routine slots to build pairings from: energy · immune · minerals · detox ·
sleep · stress · digestion · recovery.

No other pairings are documented. **Do not invent cross-sells** — derive them
from purchase data via `execution.segmentation`.

## Standing offers

| Offer | Terms | Valid | Source of truth |
|---|---|---|---|
| Subscribe & Save | **15% off** subscription orders | Ongoing | Seal subscriptions app |
| Tiered AOV promo | Spend $90 → $10 off · $120 → $20 off · $150 → free gift or $37.50 off | Per campaign | Campaign brief; confirm end date every time |
| Discount ceiling | **25% off maximum, no exceptions** | Standing | NTK |

Observed in the live account (May 2026 Memorial Day send): `STACK90`,
`STACK120`, `STACK150`.

Seasonal pattern recorded in the NTK: **May** = Mother's Day tiered;
**June** = Father's Day free gift (Folklore Salt or Muscle Salt at $100+).

> "Folklore Salt" and "Muscle Salt" appear in the NTK. The catalog lists "Muscle
> Salve". **Likely a typo for Salve — confirm before using either name in copy.**

**Offer terms must be confirmed against the source before use in any send.**
Record the confirmation date in the campaign brief.

## Commercial targets

| | |
|---|---|
| Current AOV | **~$83** |
| Target AOV | **$100–140** |
| Repeat buyer rate | 64% |
| Reviews | 264+ (Yotpo) |

The AOV gap is what the tiered promo structure exists to close: $83 current
against a $90 first tier means the first tier is already a stretch for the
average order. **Flag AOV progress in monthly reporting** (NTK).

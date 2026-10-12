# Campaign brief — Energy by day, rest by night (routine education)

| | |
|---|---|
| **Account** | `blessed-botanicals` — resolved via `accounts/registry.yml`; Klaviyo `RaFbmF` confirmed live 2026-10-12 |
| **Campaign type** | education (routine builder, no discount) |
| **Send date** | 2026-10-21, 10:00 ET — _proposed, TBC_ (after Stack & Save closes 2026-10-19) |
| **Channels** | email |
| **Brief owner** | Jono |
| **Status** | draft — ready for approval; no blocking questions open |
| **Approved by, date** | |
| **Skill** | `execution.campaign-brief` v0.1.0 |

This is the first instance of the revised brief format and the test case for
the brief → design → Klaviyo build workflow. Decisions and defaults are written
down so the test can be judged on quality, not on gaps.

## 1. Objective

Get readers who have bought or browsed one half of the day (Energy & Focus **or**
Sleep Support) to start a two-part daily routine, measured by clicks into the two
collections and orders that contain one product from each.

## 2. Audience and situation

| | |
|---|---|
| **Include** | `EC - Interested in Energy and Focus L90D` (`VQ7XgJ`) — viewed, added or ordered in the Energy & Focus category/collection in 90 days, **≤3 orders all-time**, email-consented · `ECD \| Quiz Result: Stress` (`VF46sd`) — Octane quiz result = Stress · `EC - Full Engaged 30D` (`Skh7J7`) — engaged in 30 days, **≤2 orders all-time**, email-consented. Covers leads with no purchase plus light buyers. |
| **To build** | **Interested in Sleep Support L90D** — clone of `VQ7XgJ` with category/collection = `Sleep Support`. The Shopify collection exists under that name, so the metric filter is viable. · **Purchased Energy & Focus or Sleep Support, all-time** — the interest segments cap at ≤3 orders, so repeat buyers of either category are currently *outside* the audience. Needs the Placed Order metric with a category/collection item property; confirm that property exists before building. |
| **Exclude** | `[EXCLUDE] Purchased L7D` (`VWxJtq`) · `[EXCLUDE] Bounced 3X Last 90D` (`X8ZNFM`) · `Email Unengaged 90D` (`XpwVbX`) — deliverability is 60 against a 90+ goal, so unengaged profiles stay out. Smart Sending on. |
| **Estimated size** | _unknown_ — segment counts not read. Read in the Klaviyo UI before scheduling. For scale: recent full sends deliver 29–34K; engaged-only sends 17–21K (Hiro, 2026-10-12). |
| **Recent contact** | Eight email campaigns 2026-10-01 → 10-12 (shot-glass promo, Wellness Quiz + follow-up, Stack & Save ×4 + follow-up). Stack & Save runs to 10-19. **No other campaign 10-20 → 10-22** so this send is not the ninth promo-adjacent touch. Sends-per-week ceiling is _not captured_ for this account. |
| **Situation** | The reader already trusts one product for one moment of the day, or has looked at it. They have just sat through two weeks of tiered-spend offers. The account's biggest friction is *"I don't know which product is right for me"*; this email answers it for two specific moments — morning and night — without asking them to understand the whole catalog. |

## 3. Desired action

- **Primary CTA** — `Start your routine` → `https://getblessedbotanicals.com/collections/energy-focus`
  (the day starts there; see open question 1 for the single-destination option)
- **Secondary** — per-section buttons: `Shop Energy & Focus` → that collection;
  `Shop Sleep Support` → `https://getblessedbotanicals.com/collections/sleep-support`.
  Section buttons carry distinct UTM content so the split is measurable.

## 4. The main takeaway

What you take in the morning and what you take at night are one routine, not two
problems — and it only takes one bottle for each.

## 5. Creative angle

**A day has two halves.** Most people treat energy and rest as separate fixes:
something for the slump, something else for the night. The brand's answer is a
rhythm — a morning extract that supports natural energy and focus, an evening
extract that supports calm and rest — and the point is that each one makes the
other easier. The routine is the product.

**What this email is not:**

- Not a Stack & Save or discount send. That just ran for two weeks. No code, no
  threshold, no countdown.
- Not a best-sellers dump. Four products, two moments, one reason each.
- Not a "wellness journey" email. If a paragraph could sit in any supplement
  brand's send, it fails the gut check in `brand-voice.md`.
- Not a sleep-problem or burnout fear email. The reader is not behind.

## 6. Verified facts

Read live 2026-10-12 from the Shopify Admin MCP (store `getblessedbotanicals.com`,
Shopify Plus) and the two public collection pages. Prices are the 2 oz "from"
price shown on the collection page; 4 oz pricing was not displayed there.

**Energy & Focus** — `/collections/energy-focus`, 5 products, manual collection, sorted best-selling.
Client-published description: *"natural energy and focus supplements designed to
support mental clarity, brain health, and daily vitality… energy support, focus
support, and a balanced daily routine."*

| Product | Price | Sizes | URL | Approved framing (`products-offers.md`) |
|---|---|---|---|---|
| Organic Moringa | $34 | 2 oz / 4 oz | `/products/organic-moringa-extract` | **Yes** — natural energy, daily nutrient intake, metabolism, antioxidants, amino acids, vitamins; daily-staple positioning. Specificity: organic moringa *leaves*, small-batch, vegetable glycerin + distilled water |
| Organic Ginkgo Biloba | $34 | 2 oz / 4 oz | `/products/ginkgo-biloba-extract-natural-clarity-focus-balance` | **None recorded.** Collection page says focus support, mental clarity. **Review trigger.** |
| Organic Cortisol Control | $34 | 2 oz / 4 oz | `/products/cortisol-control-natural-focus-energy-brain-health-stress-adaptogen` | **Yes** — stress response, recovery, balance, helping the body adapt. Alternate to Ginkgo if the client prefers approved framing only |
| Organic Liver Cleanse | $34 | 2 oz / 4 oz | `/products/liver-cleanse-…` | Yes, but off-concept here — not featured |
| Wildcrafted Irish Sea Moss | **$40** | 2 oz / 4 oz | `/products/irish-sea-moss-tincture-…` | Yes (daily minerals, natural energy). **Confirmed live** — resolves the "not in export" flag in `products-offers.md`. Price sits outside the $34/$49 architecture. Not featured |

**Sleep Support** — `/collections/sleep-support`, 4 products, manual collection, sorted best-selling.
Client-published description: *"calming herbs… to support relaxation and restful
sleep… better sleep, nighttime calm, and a soothing evening routine."*

| Product | Price | Sizes | URL | Approved framing |
|---|---|---|---|---|
| Organic Lemon Balm | $34 | 2 oz / 4 oz | `/products/organic-lemon-balm-tincture-all-natural-sleep-aid` | **Yes** — nervous-system calm, stress balance, restful evenings, racing thoughts, gentle relaxation *without heavy sedation* |
| Organic Sleepy Time | $34 | 2 oz / 4 oz | `/products/sleepy-time-extract-all-natural-sleep-aid-great-for-insomnia-restlessness-more` | **None recorded.** Collection page says restful sleep, nighttime calm. **Review trigger.** The URL slug contains "insomnia" — do not echo it in copy |
| Organic Chill Pill | $34 | 2 oz / 4 oz | `/products/chill-pill-great-for-anxiety-stress-hyperactivity-much-more` | None recorded. URL slug carries claim language — do not echo. Not featured |
| Magnesium Mist | $20 | 4 oz | `/products/magnesium-mist-…` | None recorded. Topical, not an extract — breaks the AM/PM symmetry. Not featured |

**Featured four (default):** Morning = Moringa + Ginkgo Biloba · Evening = Lemon
Balm + Sleepy Time. Two carry approved framing, two do not; the two without are
drafted from collection-page language only and go to client review (section 9).

**Claims language allowed** (`messaging-constraints.md`): *supports…*, *helps
support…*, *traditionally used to support…*, *made to fit into…*. One bottle
positions as ~30 days of support (Copy Guide).

**Catalog note for the build:** the Klaviyo catalog API returned zero items on
2026-10-12. Shopify-integrated catalog items are not readable through that
endpoint, so native `product` blocks cannot be verified by an agent. Product
cards are built as image + text + button using the Shopify CDN image URLs below.

## 7. Offer

| | |
|---|---|
| **Offer** | **None.** This is not a promotional send. Decision, not omission. |
| **Code / dates / terms** | n/a |
| **Standing offer copy may mention** | Subscribe & Save, 15% off subscription orders (Seal). One line at most, framed as the consistency mechanism, not a discount hook. **Re-confirm 15% on a product page at copy stage** — last confirmed 2026-09-21 from the May NTK. |
| **Do not mention** | Free-shipping threshold. The October creative shows both "$98+" and "$100+". Unconfirmed, so it stays out. |

## 8. Brand direction

- **Voice rules for this send**
  1. The specificity rule. Every product gets the herb, the part used, what it
     supports and *when in the day*. "Calm nights" is not enough; "lemon balm
     leaf, for racing thoughts and an evening that winds down without heavy
     sedation" is.
  2. *Name the need. Explain the herb. Show the routine. Keep the promise
     grounded.* Morning need → morning herbs → evening need → evening herbs →
     the three-step routine.
  3. Doable, not overwhelming. Two bottles, two moments. No ingredient stacks.
- **Approved phrases to lean on** — *Build your wellness routine* · *Consistency
  changes everything* · *Start with what your body needs* · *The small choices
  add up* · *Simple, clean formulas* · *Whole herbs* · *Nothing unnecessary*
- **Reference sends**
  - *May 29 — What Moringa Actually Does*: the depth of product explanation to match
  - *Jun 7 — What a Real Detox Routine Looks Like*: how a routine is laid out as moments in a day
  - *May 14 — Best Sellers Routine Builder*: routine-builder structure
  - *Oct 10 — Stack & Save EM2* (attached): the "2 Ways to Reach $200" two-column
    block is the layout to adapt as **Morning / Evening**; the numbered "How to
    apply this promo" block becomes **How to start your routine**
  - *Oct 8 — Stack & Save EM1* (attached): named routines ("The Calm Routine",
    "The Foundation Routine") show the client already accepts routine naming
- **What to avoid** — AI-smooth wellness filler. The Copy Guide names it and the
  NTK says the client will catch it. Founder story stays out of this send: it
  adds a review surface and the routine does not need it.

## 9. Constraints

- **No medical claims, no outcome guarantees.** Live risks for this content:
  anything that treats fatigue, brain fog, insomnia, anxiety or stress as a
  condition the product fixes; "better than coffee" or any comparison to
  stimulants or sleep aids; dosage or timing advice beyond the label.
  Product-page URL slugs for Sleepy Time and Chill Pill carry claim language —
  never surface them as text.
- **Collection descriptions are client-published** and may be used as framing
  baselines, but they do not exempt the send from review.
- **Required disclosures** — FDA structure/function disclaimer requirement is
  _not captured_. Default: include the standard statement as small footer text
  (open question 7).
- **Review triggers** — every email with herb-specific language goes to the
  client via the mockups reviewer sheet (Drive
  `1DnnkjHBhD4Im6V80DoDgwRYLt3cW3v8i-PA24lgAYNk`); Ginkgo Biloba and Sleepy Time
  framing specifically needs client confirmation; AI-drafted copy must be
  reviewed and refined by a human writer before it is final.
- **Deliverability** — live-text build only; `scripts/validate_dnd.py` floor
  (≥4 text-bearing blocks, ≤60% image blocks). Engaged-only audience.

## 10. Structure

| | |
|---|---|
| **Required elements** | Live-text hero headline that states the two-part routine · Morning section: two products, each with herb + what it supports + when · Evening section: same · "How to start your routine" in three steps · one primary CTA · existing footer Universal Content (`b8626a7eb0914562b550f664250b6d51`) |
| **Suggested flow** | Header (logo) → Hero: headline, one-line subhead, primary CTA → "A day has two halves" intro, 2–3 sentences → **Morning** block on cream or sage ground: two product cards → **Evening** block on forest ground: two product cards → "How to start your routine" numbered steps → Primary CTA → optional *Feeling Blessed* review (only if an existing review speaks to routine or consistency and carries no claim) → Footer |
| **Design notes** | Tokens from `context/design-tokens.json`. They are marked `target_state`, but the attached October sends use the forest / sage / cream / gold / amber palette and serif display type from the April guidelines, so treat them as live for this test (open question 6). Mobile-first — ~90% mobile. Headline in live text, never baked into the hero image (hero component spec). Morning / Evening as a two-column row that stacks on mobile, each column a card. Announcement bar, header, hero and product grid are `not_built` components: build as sections and flag as Universal Content candidates. Secondary (forest) button on the amber or forest grounds, amber primary on cream. |
| **Assets** | Product images, Shopify CDN, public: Moringa `…/files/blessed-botanicals-moringa-herbal-extract-main.png` · Ginkgo `…/files/blessed-botanicals-ginkgo-biloba-herbal-extract-dropper-bottle.png` · Lemon Balm `…/files/blessed-botanicals-lemon-balm-tincture.png` · Sleepy Time `…/files/blessed-botanicals-sleepy-time-herbal-extract-main.png` (base `https://cdn.shopify.com/s/files/1/0708/1371/2706/`). Logo: Klaviyo asset `312947524` (desktop 188px) / `312948006` (mobile 149px). Lifestyle or hero photography: **none verified** — pull from the Drive brand-assets folder by ID if needed, otherwise the hero is a flat amber or sage band with live text, per the hero spec. |

## 11. Success measure

Benchmarks from Hiro Analytics, client `128074`, read 2026-10-12. The three
non-promotional sends in the last 45 days:

| Send | Delivered | Open | Click | Revenue / recipient |
|---|---|---|---|---|
| Oct 3 — Take the Wellness Quiz | 30,083 | 43.0% | 0.64% | $0.10 |
| Sep 21 — 64% of You Come Back | 24,415 | 57.2% | 0.49% | $0.17 |
| Sep 9 — The Family Wellness Shelf | 24,951 | 55.9% | 0.37% | $0.07 |

| | |
|---|---|
| **Primary metric** | Click rate **≥ 0.6%** — beats the best education send in the window |
| **Secondary** | Revenue per recipient ≥ $0.12 · unsubscribe rate ≤ 0.25% (recent range 0.19–0.31%) · orders containing one product from each collection, read from Shopify after send · click split between hero, Morning and Evening buttons via UTM content |
| **What we learn** | Does routine-framed education without an offer out-click the quiz send to the same kind of audience? And does a two-collection CTA split attention, or does the morning-first hero carry it? That answer decides whether a single routine landing page is worth building. |

## 12. Build and authorization

| | |
|---|---|
| **Account ceiling** | `agent_access: read_only`, `owner: null`. Steps 1–7 of `workflows/creative-production.md` (brief → copy → design → QA → human review) produce files only and are permitted now. |
| **Step 8 — Klaviyo template + campaign draft via MCP** | **Not permitted at the current ceiling.** Needs a named `owner` and `agent_access: draft` in `accounts/registry.yml`, via a PR the owner approves. Proposed: owner = Jono. The capabilities involved (`create_dnd_email_template`, `create_campaign`, `assign_template_to_campaign_message`, `upload_image_from_url`) are **unverified** in `integrations/mcp/tool-map.md` and get verified by this test. |
| **Segments to build** | Two (section 2). Built in the Klaviyo UI by Mariana or Jono, or by an agent once the ceiling is raised. Using an existing segment is a read; creating one is a write. |
| **Scheduling / sending** | Human, per instance. Never an agent. Named sender: _TBC_ (Mariana by default). |

## 13. Open questions

| # | Question | Blocking? | Owner | Default if unanswered |
|---|---|---|---|---|
| 1 | Should a single "Day & Night Routine" collection be created in Shopify (4 featured products) so the primary CTA has one destination? | No | Jono / Mariana, client to create | Hero → Energy & Focus; section buttons to each collection |
| 2 | Approved framing for Ginkgo Biloba and Sleepy Time | No for drafting; **yes for copy approval** | Client via Mariana | Draft from collection-page language only; client review |
| 3 | Build the Sleep-interest and all-time category-purchaser segments | No for creative; **yes for send** | Mariana / Jono | Send to the three existing segments only |
| 4 | Octane quiz result values for sleep and energy outcomes (only `Stress result page` is known) | No | Client via Mariana | Include Quiz Result: Stress only |
| 5 | Name an account owner and raise `agent_access` to `draft` so step 8 can run | No for the brief; **yes for the Klaviyo build test** | Jono | Deliverable stops at `design.json` in the repo |
| 6 | Is the April 2026 rebrand confirmed live? | No | Mariana / Paz | Proceed on the tokens; the October sends already use the palette |
| 7 | Is an FDA structure/function disclaimer required in email? | No | Client via Mariana | Include the standard statement as small footer text |
| 8 | Confirm send date 2026-10-21 10:00 ET and a clear calendar 10-20 → 10-22 | No | Mariana | As proposed |
| 9 | Is Subscribe & Save still 15%? | No | Copywriter checks a product page at copy stage | Mention only if confirmed; otherwise omit |
| 10 | Show prices in the email? 4 oz price not displayed on the collection pages | No | Jono | No prices in the email; cards show name, framing, button |

No blocking question is open for **brief approval**. Questions 2, 3 and 5 block
later gates (copy approval, send, platform build) and are assigned.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-10-12 | Drafted from live reads of Shopify, Klaviyo segments and campaigns, and Hiro benchmarks |

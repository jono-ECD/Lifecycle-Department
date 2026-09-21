# Design system — Blessed Botanicals

_Last updated 2026-09-21._

Account **facts** — the values. The *procedure* for extracting and applying a
design system belongs in a shared skill, never here. See
`governance/skill-authoring.md`.

Machine-readable companion: [`design-tokens.json`](design-tokens.json), shaped to
Klaviyo's `definition.styles` array so it injects into
`create_dnd_email_template` with no translation step.

## Sources

| Source | Where | Read |
|---|---|---|
| Brand guidelines, 28pp | Drive `Blessed Botanicals Rebranding/Blessed Botanicals.pdf` (`1DbK2CPIGD99LkMdOcxHQVjqb7z0OlP9B`), dated 2026-04-08 | 2026-09-21 |
| Live Klaviyo account | 6 drag-and-drop templates + brand email defaults, account `RaFbmF` | 2026-09-21 |

Binaries stay in Drive. This repo holds extracted values and pointers only.

## ⚠ Blocking question

**Is this rebrand approved and live, or pending client sign-off?**

It matters. The guidelines are dated April 2026; the Klaviyo templates were built
in May 2026 and use **none** of it; the May 2026 NTK doesn't mention a rebrand.
Until someone confirms, `design-tokens.json` is marked `status: target_state` —
a proposal, not the system. Everything below is written on that basis.

## The system

### Palette

| Token | Hex | Role | Used for |
|---|---|---|---|
| Forest | `#1f4d3a` | primary | Footer, announcement bar, headings, secondary button |
| Sage | `#a8bfa3` | secondary | Section grounds, often with botanical line-art |
| Cream | `#f6f3ec` | surface | **Primary content background — not white** |
| Gold | `#c8a96a` | accent | Dividers, icon detail |
| Amber | `#f9b342` | CTA | Primary button fill, full-bleed hero bands |

### Typography

| Role | Family | Weights | Email stack |
|---|---|---|---|
| Titles, subtitles, highlights | **Alga** | Light → Bold, each with italic | `Alga, Georgia, 'Times New Roman', serif` |
| Paragraph text | **Poppins** | Light → Black | `Poppins, 'Helvetica Neue', Helvetica, Arial, sans-serif` |

**Alga is not a Google Font.** It won't render in Gmail or Outlook. With ~90%
mobile traffic (largely iOS Mail, which does support webfonts) a good share will
see it, but the serif fallback has to be chosen deliberately rather than left to
whatever the client picks. Poppins is safer but still falls back in Outlook.

The brand book specifies families and weights, not an email type scale. The scale
in `design-tokens.json` is marked `derived: true` — it's a proposal for review,
not something lifted from the book.

### Logo rules (p13)

Do not change the colour · change the proportions · add effects or an outline ·
remove any words · narrow it · change the font.

## Current state vs brand — every token is wrong

All six live templates carry a **byte-identical, unmodified Klaviyo stock token
layer**. The brand-colors library in the account is empty.

| Token | Live in Klaviyo | Brand | |
|---|---|---|---|
| Body text | `#5D5E60` grey | `#1f4d3a` forest | ✗ |
| Headings | `#5D5E60` grey | `#1f4d3a` forest | ✗ |
| Links | `#334fb4` | `#1f4d3a` | ✗ Klaviyo's stock blue, foreign to the palette |
| Content bg | `#FFFFFF` | `#f6f3ec` cream | ✗ |
| Canvas | `#f5f5f7` cool grey | warm cream family | ✗ |
| Heading font | Arial / Helvetica | Alga | ✗ |
| Body font | Arial / Helvetica | Poppins | ✗ |
| Footer font | `Assistant` (inline) | Poppins | ✗ Assistant is in neither the account tokens nor the brand book |
| Footer ground | `#1f4d3a` | `#1f4d3a` | ✓ **the only match** |
| Content width | 600px | 600px | ✓ |

The one brand value that reached the account — forest green on the footer — is
applied as a single inline section override, not a token. Nothing inherits it, so
every email would have to re-apply the brand by hand. That is the whole problem
in one line.

## The structural blocker: the emails are images

`BB - Holiday Promo Sale`, the most recent promo build, has a body of **seven
stacked JPEGs and nothing else**. No text block, no button block, no product
block. ~8,000px of image at 1146px source width, rendered into a 600px template.

- **Images off renders a blank email.** No live-text fallback anywhere.
- **Accessibility rests entirely on alt text** — one alt string is a
  200-character dump of the whole offer table.
- **Deliverability.** Image-dominant sends with near-zero live text are a known
  filter signal. The NTK records a deliverability score of **60 against a 90+
  goal**, and notes Ashton watches it closely. This is a contributing cause.
- **Dark mode can't adapt** — backgrounds are baked into pixels.
- **Nothing is editable or reusable.** `$10 OFF` → `$15 OFF` needs a designer and
  a re-export.

And the one that decides the workflow: **an image-based email cannot be built or
modified through the Klaviyo MCP.** The drag-and-drop API composes typed blocks;
a flat JPEG exposes none of them. For an agent, "build this email" collapses to
`upload_image_from_url` plus one image block — automating nothing worth
automating.

So modular live-text design is not a quality preference upstream of the creative
workflow. It is the **precondition that makes the workflow mechanically
possible.**

**The brand book already agrees.** Its own email mockups (p26–27) are built from
live headlines, paragraph text, buttons, badge grids and product grids — not
flattened images. Moving to modular blocks isn't a change of direction for the
agent's convenience; it's what the brand already specifies and the current builds
don't follow.

## Component set

Read from the brand book's own email mockups (p26–27). Build each as Klaviyo
**Universal Content** — edited once, inherited everywhere. Specs in
`design-tokens.json`.

| Component | Status |
|---|---|
| Footer | ✓ built — `universal_id b8626a7eb0914562b550f664250b6d51` |
| Announcement bar | not built |
| Header | not built |
| Hero | not built |
| Feature badges (2×2) | not built |
| Product grid | not built |
| Support block | not built |

The footer is the only Universal Content in the account, and it's the right
pattern — including separate mobile (149px) and desktop (188px) logo widths via
`show_on`. Replicate it. Its font still needs moving from `Assistant` to Poppins.

## Defect found during the audit

**`ECD - AB CART EM 1` (`ShTq9R`) sets `link-styles.color: #FFFFFF`** against a
`#FFFFFF` content background — white links on white. The other five use
`#334fb4`. Unless every link sits on a dark block, links are invisible in a live
abandoned-cart flow. **Not verified against a render — check before the next
send.**

That template is also the only one with `tip_tap_enabled: true`, so it was built
on a newer editor version than the rest.

## Naming

`BB - Holiday Promo Sale` contains Memorial Day / "Summer Wellness Reset"
creative. Five of six templates use an `ECD - ` prefix, one uses `BB - `. No
convention is recorded in [`../platform/klaviyo.md`](../platform/klaviyo.md).

## Audited templates

| Template | ID | Editor |
|---|---|---|
| ECD - AB CART EM 1 | `ShTq9R` | `SYSTEM_DRAGGABLE` |
| BB - Holiday Promo Sale | `VZ2gq2` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM1 | `YcDMMx` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM 2 | `RLnyNb` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM 3 | `V8LyQB` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM 4 | `RsA3mp` | `SYSTEM_DRAGGABLE` |

Only `VZ2gq2` had its block structure read. The other five were audited at the
token layer only.

## Next steps

1. **Confirm the rebrand status.** Blocks everything below.
2. Confirm the derived type scale and button spec with Paz (design).
3. Decide the Alga fallback strategy for Gmail and Outlook.
4. Push tokens into the Klaviyo **brand library** so the platform enforces them.
   Needs a write decision — see `integrations/mcp/access-policy.md`.
5. Build the component set as Universal Content, following the footer's pattern.
6. Rebuild one email as modular live-text blocks to prove the path end to end.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-21 | Audit of 6 live templates; confirmed values and gaps |
| 0.2.0 | 2026-09-21 | Full system from the brand guidelines PDF; current-vs-brand conflict table |

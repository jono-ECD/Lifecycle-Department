# Design system — Blessed Botanicals

_Status: **audit complete, system not yet authored.** Values below were read from
the live Klaviyo account on 2026-09-21 via MCP (read-only). Every unconfirmed
value is marked `unknown` rather than guessed._

This file is account **facts** — the values. The *procedure* for extracting and
applying a design system belongs in a shared skill, never here. See
`governance/skill-authoring.md`.

Machine-readable companion: [`design-tokens.json`](design-tokens.json). That file
is shaped to match Klaviyo's `definition.styles` array so it can be injected into
`create_dnd_email_template` with no translation step.

## Headline finding

**There is no design system in this account.** Six drag-and-drop templates were
audited. All six carry a **byte-identical, unmodified Klaviyo stock token layer** —
Arial/Helvetica, `#5D5E60` grey body text, `#334fb4` stock-blue links.

The brand exists only as **inline overrides on individual blocks**. Nothing is
inherited, so every email re-applies the brand by hand, or doesn't.

| Layer | State |
|---|---|
| Klaviyo brand-colors library | **Empty** (zero entries) |
| Klaviyo brand email defaults | Stock values + a logo, button and social group attached |
| Template token layer (`definition.styles`) | Stock defaults, identical across all 6 templates |
| Actual brand values | Present, but only as per-block inline overrides |

## What the audit confirmed

| Token | Value | Where it came from |
|---|---|---|
| Brand green | `#1F4D3A` | `content_color` on the footer section of `BB - Holiday Promo Sale` |
| Brand typeface | `Assistant` | Inline `font-family` in footer text HTML, with Arial/Helvetica fallback |
| Content width | `600` px | `definition.body.styles.width`, consistent across all 6 templates |
| Logo asset | `312947524` (crop `312948006`) | Footer image block; separate mobile (149px) / desktop (188px) widths |
| Brand logo record | `2167357` | `brand-email-defaults` relationship |
| Brand button record | `2167358` | `brand-email-defaults` relationship |
| Brand social group | `2167363` | `brand-email-defaults` relationship |
| Social profiles | Facebook, Instagram, X | Footer `social` block, white icons |

Neither `#1F4D3A` nor `Assistant` appears anywhere in the token layer. They are
applied by hand, per block, per email.

## What is still unknown

Not captured, and **not inferable** from the account. These need a brand source.

- Secondary and accent colours; any palette beyond the single green
- Full type scale and weights as the brand actually intends them
- Button specification — fill, radius, padding, size, hover, secondary variant
- Spacing scale / vertical rhythm
- Photography and art direction rules
- Whether `#f5f5f7` (canvas) and `#FFFFFF` (content) are brand decisions or
  simply the Klaviyo defaults nobody changed. **Currently assume the latter.**

## The structural problem: the emails are images

`BB - Holiday Promo Sale` — the most recent promotional build — has a body
consisting of **seven stacked JPEGs and nothing else**. No text block, no button
block, no product block. Roughly 8,000px of image at 1146px source width,
rendered into a 600px template.

This is the real constraint on the creative workflow, and it is worth stating
plainly:

- **Images-off renders a blank email.** There is no live-text fallback anywhere in
  the body.
- **Accessibility rests entirely on alt text**, and one alt string is a
  200-character dump of the whole offer table.
- **Deliverability risk.** Image-dominant sends with near-zero live text are a
  known spam-filter signal.
- **Dark mode cannot adapt** — backgrounds are baked into the pixels.
- **Nothing is editable or reusable.** Changing `$10 OFF` to `$15 OFF` requires a
  designer and a re-export.

That last point is the one that matters most here. **An image-based email cannot be
built or modified by the Klaviyo MCP.** The drag-and-drop API composes typed
blocks — text, button, product, coupon — and a flat JPEG exposes none of them. For
an agent, "build this email" collapses to `upload_image_from_url` plus one image
block, which automates nothing worth automating.

Modular, live-text design is therefore not a quality preference. It is the
**precondition** that makes the brief → design → build workflow mechanically
possible.

## The one real component

The footer of `BB - Holiday Promo Sale` carries
`universal_id: b8626a7eb0914562b550f664250b6d51` — it is already Klaviyo
**Universal Content**, edited once and inherited everywhere. It also handles
mobile and desktop logo sizing correctly via `show_on`.

This is the pattern to replicate for header, hero, product grid, review and CTA.
Universal Content is Klaviyo's native component layer; it is the platform-side
half of the design system, and this account already has exactly one.

## Defect found during the audit

**`ECD - AB CART EM 1` (`ShTq9R`) has `link-styles.color: #FFFFFF`** against a
`#FFFFFF` content background — white links on white. The other five templates use
`#334fb4`. Unless every link in that email sits on a dark block, links are
invisible. **Not yet verified against a render; worth checking before the next
send.**

That template is also the only one with `tip_tap_enabled: true`, suggesting it was
built on a newer editor version than the rest.

## Naming inconsistency

`BB - Holiday Promo Sale` contains Memorial Day and "Summer Wellness Reset"
creative. Five of six templates use an `ECD - ` prefix; one uses `BB - `. There is
no naming convention recorded in
[`../platform/klaviyo.md`](../platform/klaviyo.md).

## Audited templates

| Template | ID | Editor |
|---|---|---|
| ECD - AB CART EM 1 | `ShTq9R` | `SYSTEM_DRAGGABLE` |
| BB - Holiday Promo Sale | `VZ2gq2` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM1 | `YcDMMx` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM 2 | `RLnyNb` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM 3 | `V8LyQB` | `SYSTEM_DRAGGABLE` |
| ECD - WS - EM 4 | `RsA3mp` | `SYSTEM_DRAGGABLE` |

Only `VZ2gq2` had its full block structure read. The other five were audited at
the token layer only; their block structures are **not yet reviewed** and may
differ.

## Next steps

1. Supply a brand source for the unknowns above (guidelines, Figma, or the
   Claude Design folder). Nothing further can be authored honestly without it.
2. Author the full token set in `design-tokens.json`.
3. Push the tokens into the Klaviyo **brand library** so the platform enforces
   them, rather than relying on every build to remember. Requires a write
   authorization decision — see `integrations/mcp/access-policy.md`.
4. Build the component set as Universal Content, following the footer's pattern.
5. Rebuild one email as modular live-text blocks to prove the path end to end.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-21 | Audit of 6 live templates; confirmed values and gaps recorded |

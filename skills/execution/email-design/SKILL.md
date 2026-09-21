# Email Design

- ID: `execution.email-design`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: 2026-09-21

## Purpose

Turn approved copy and an account's design tokens into a valid Klaviyo
drag-and-drop template definition, built from live-text blocks. Use when copy is
approved and the next deliverable is the built email. Not for writing copy
(`execution.email-copy`), not for deciding layout direction
(`execution.creative-direction`), and not for pushing anything into a client's
account — that is a separate authorization.

The output is a JSON definition, reviewable in a PR and buildable by
`create_dnd_email_template` without translation.

## Why live text, not a designed image

A drag-and-drop template is a tree of **typed blocks** — text, button, product,
coupon. An email exported as a flat JPEG exposes none of them, which costs:

- **Editability.** Changing `$10 OFF` to `$15 OFF` needs a designer and a
  re-export. Nothing downstream can touch it — including this skill.
- **Deliverability.** Image-dominant sends with near-zero live text are a known
  filter signal.
- **Accessibility.** Alt text ends up carrying the entire offer.
- **Dark mode.** Baked-in backgrounds cannot adapt.
- **Images-off.** A blank email.

Images belong in an email. Images **as** the email do not. The rule below is
mechanical: see the live-text floor in Quality checks.

## Required inputs

| Input | Source | If missing |
|---|---|---|
| Approved copy | `accounts/<slug>/campaigns/<campaign>/copy.md` | Stop. Run `execution.email-copy` first. |
| Design tokens | `accounts/<slug>/context/design-tokens.json` | Stop. Designing without tokens produces a one-off that teaches the next build nothing. |
| Design system notes | `accounts/<slug>/context/design-system.md` | Proceed, but flag — you lose the component set and usage rules. |
| Approved brief | `accounts/<slug>/campaigns/<campaign>/brief.md` | Stop. The brief names the destination and the one objective. |
| Messaging constraints | `accounts/<slug>/context/messaging-constraints.md` | Stop. Product names and alt text are copy too, and can carry prohibited claims. |
| Image assets | Account's asset store, or a URL | Proceed with placeholders, marked. Never invent an asset ID. |

If `design-tokens.json` carries `status: target_state`, the tokens are a
proposal, not the system. Say so in the deliverable and get confirmation before
anyone builds from it.

## Instructions

1. **Confirm the account.** Read `accounts/<slug>/README.md` and resolve the slug
   through `accounts/registry.yml`. Verify the copy you were handed belongs to
   this account. Mismatched account context is the most damaging error available
   here, and it is silent — the output looks plausible.

2. **Read the constraints before the copy.** Prohibited claims apply to every
   rendered string: headings, button labels, alt text, preview text, and
   **product names pulled by `product` blocks**, which are easy to forget because
   nobody typed them.

3. **Load the tokens.** Everything in `klaviyo_definition_styles` goes into the
   template's `styles` array verbatim. This is the whole point of the token
   layer — set it once at template level so every block inherits.

   **Never re-specify a token value as an inline block style.** An inline
   override is invisible to the next build and to every other template. If a
   value genuinely needs to differ, that is a design-system decision: raise it,
   don't inline it.

4. **Map copy to blocks.** Each element of the copy gets a block type:

   | Copy element | Block |
   |---|---|
   | Headline | `text` with an `<h1>`/`<h2>` — never an image |
   | Body paragraph | `text` |
   | CTA | `button` |
   | Product feature | `product` (lets the catalog feed name, price, image) |
   | Social proof | `review` |
   | Offer code | `coupon` |
   | Lifestyle / hero imagery | `image` |
   | Vertical rhythm | `spacer`, `horizontal_rule` |

   Reach for `html` only when no typed block can express it, and record why.

5. **Assemble the structure.** Sections → rows → columns → blocks. Column layout
   comes from the closed enum in `klaviyo_dnd_block_vocabulary.column_layouts`;
   nothing else is valid.

   Reuse the account's components. Any component in `design-tokens.json` with a
   `universal_id` is existing Universal Content — reference the id, don't rebuild
   it. A component marked `not_built` is a gap: build it as a normal section and
   flag it as a Universal Content candidate.

6. **Handle mobile explicitly.** Set `stack_on_mobile`, and use `show_on` where
   desktop and mobile need different assets (differently sized logos, for
   instance). Check the account's traffic mix — where it is mobile-dominant,
   mobile is the primary design target and desktop is the variant.

7. **Write alt text as copy.** Every `image` block gets alt text that carries its
   meaning in one readable sentence. Not a keyword dump, not the entire offer
   table. If an image needs a paragraph of alt text, its content belongs in a
   `text` block.

8. **Link every clickable thing** to the destination the brief names. Buttons and
   linked images both need `href`.

9. **Validate mechanically:**

   ```
   python3 scripts/validate_dnd.py <definition.json> --tokens accounts/<slug>/context/design-tokens.json
   ```

   Fix every error. Justify every warning in the deliverable README or fix it.

10. **Save** to `accounts/<slug>/campaigns/<campaign>/` (or `flows/<flow>/`) with
    the skill version recorded. Do not push to the platform — see Tools below.

## Output

```
accounts/<slug>/campaigns/<campaign>/
├── design.json     # the DnD definition, ready for create_dnd_email_template
└── design.md       # block-by-block rationale, asset list, open questions,
                    # validator output, skill version
```

`design.json` holds the `definition` object only — the `data.attributes.definition`
value the API expects, not the whole request envelope.

## Quality checks

Mechanical, via `scripts/validate_dnd.py`:

- [ ] Definition parses and every block matches a known type
- [ ] Every `column_layout` is in the allowed enum
- [ ] Template `styles` present, with all eight `style_type` entries
- [ ] **Live-text floor: at least 4 text-bearing blocks, and at most 60% of
      blocks are images.** The check that stops a designed-JPEG email.
- [ ] Every `image` block has non-empty alt text of at most 160 characters
- [ ] Every `button` has a non-empty label and an `href`
- [ ] No colour or font appears inline that duplicates a token value
- [ ] No inline colour outside the account's palette
- [ ] Every `{{ token }}` has a `default` filter

By review:

- [ ] Every string traces to approved copy — nothing invented at build time
- [ ] No prohibited claim in any rendered string, **including product names**
- [ ] Offer code and terms match the brief exactly
- [ ] Reads top-to-bottom at mobile width with one clear primary action
- [ ] Existing Universal Content is referenced, not rebuilt
- [ ] Links resolve to the brief's destination
- [ ] New reusable sections flagged as Universal Content candidates

## Tools and action boundaries

This skill produces **a file**. It does not create a platform draft, assign a
template to a campaign, schedule, or send.

Pushing `design.json` into an account requires that account's `agent_access` to
be `draft` in `accounts/registry.yml`, with a named `owner`. Check before
promising it. Scheduling and sending are human-only, per instance, always. See
`integrations/mcp/access-policy.md`.

Uploading an image asset is itself a write. Assets stay in their source of truth
and are referenced by URL or existing asset ID.

## Account customization

Palette, type, components and asset IDs are account **facts** and live in
`accounts/<slug>/context/`. They never justify forking this skill — the skill
reads whatever tokens it is given.

Fork only if the *procedure* differs: an extra approval stage, a different
handoff, a platform that isn't Klaviyo. See `governance/skill-authoring.md`.

## Dependencies

Consumes `execution.campaign-brief` and `execution.email-copy`. Expects
`accounts/<slug>/context/design-tokens.json`. Gated by
`execution.campaign-flow-qa`. Called from `workflows/creative-production.md`.

## Examples and references

- `reference/dnd-definition.md` — structure of a Klaviyo DnD definition, the
  block vocabulary, and the traps.
- `../../../scripts/validate_dnd.py` — the validator.

Keep examples fictional or fully anonymized. No real customer data, no
credentials, no client-identifying material.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-21 | Created, with mechanical validation |

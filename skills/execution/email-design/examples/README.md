# Examples — Email Design

## `campaign-definition.json`

A complete Klaviyo drag-and-drop definition for a **fictional brand, Northfold
Tea Co.** No real client data, per `governance/skill-authoring.md`.

Validates clean:

```
python3 scripts/validate_dnd.py skills/execution/email-design/examples/campaign-definition.json
→ 15 blocks (11 text-bearing, 2 image) — clean (0 warnings)
```

### What it demonstrates

- **Section structure** — announcement bar, header, hero, proof, cross-sell,
  footer. Each section is a candidate for Universal Content.
- **Live text everywhere it matters.** The headline is a `text` block, not part
  of the hero image. Images carry photography; they don't carry words.
- **Typed blocks over images** — `review` for social proof, `product` for
  cross-sell, so the catalog and review platform feed them.
- **Empty `styles` objects.** Deliberate. Populate from the account's
  `design-tokens.json` → `klaviyo_definition_styles`. Leaving them empty keeps
  the example account-agnostic and demonstrates the rule: **styling lives in the
  token layer, not inline.**
- **Personalization with a fallback** — `{{ first_name|default:'there' }}`.
- **Alt text as a sentence** — "A glass teapot of amber oolong steeping on a
  windowsill in morning light", not a keyword dump.

### What it is not

Not a layout to copy. The section order came from one fictional brand's
structure; yours comes from the account's design system. Copy the *mechanics* —
typed blocks, empty inline styles, live text — not the arrangement.

## Counter-example

There isn't a file for this, because the anti-pattern is easy to state: **an
email whose body is a stack of `image` blocks and nothing else.**

`scripts/validate_dnd.py` rejects it on two counts — fewer than 4 text-bearing
blocks, and more than 60% image blocks. Both are errors, not warnings. An email
like that can't be read with images off, can't be edited without a designer, and
can't be rebuilt by any downstream tool including this skill.

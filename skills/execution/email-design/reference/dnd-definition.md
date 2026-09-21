# Klaviyo drag-and-drop definition — structure reference

Supporting reference for `execution.email-design`. Derived from the
`create_dnd_email_template` tool schema, read 2026-09-21. **Verify against the
live schema before relying on a detail here** — this is a convenience copy, not
a source of truth.

## Shape

```
definition
├── styles[]          ← the token layer. Set once; every block inherits.
└── body
    ├── styles        ← background_color, width
    └── sections[]
        └── rows[]
            ├── data.styles.column_layout
            └── columns[]
                └── blocks[]
```

Four levels: **section → row → column → block.** A row declares its column
layout; columns hold the blocks.

## Template styles

`definition.styles` is an array of style objects, each with a `style_type`.
Include all eight:

| `style_type` | Controls |
|---|---|
| `base-styles` | Content background, borders, outer padding, webfont toggle, mobile optimisations |
| `text-styles` | Default body text: colour, family, size, weight, line height, mobile size |
| `link-styles` | Colour, weight, decoration |
| `heading-1-styles` … `heading-4-styles` | Per-level type, each with its own `mobile_font_size` |
| `mobile-styles` | Mobile margin and padding overrides |

Setting these correctly is what makes a design system real. Skip them and every
block carries its own inline styling, which nothing else can inherit — the
failure mode already present in the Blessed Botanicals account, where all six
templates run Klaviyo stock defaults and the brand survives only as scattered
per-block overrides.

## Block types

Discriminated by `type`. Every block is `content_type: "block"` with a `data`
object holding `properties`, `display_options` and `styles`.

| Type | Use for | Notes |
|---|---|---|
| `text` | Headings, paragraphs | `data.content` is an HTML string. Where headings belong. |
| `image` | Photography, lifestyle | `properties.src` + `alt_text`, or `asset_id`. `dynamic` discriminates static from feed-driven. |
| `button` | The CTA | `data.content` is the label; `properties.href` the destination. |
| `product` | Catalog items | `dynamic: false` with `subblocks`, or `dynamic: true` from a feed. Renders name, price, image, rating. |
| `review` | Social proof | Static or dynamic, with fallback options. Many layout presets. |
| `coupon` | Discount codes | Static or Shopify-integrated unique codes. |
| `social` | Follow icons | `subblocks` of `social_link_icon`. |
| `spacer` / `horizontal_rule` | Vertical rhythm | |
| `split` | Side-by-side cells | `subblocks` of text/image/html. |
| `table` | Tabular data | Static or repeating. |
| `header` | Logo + nav bar | `subblocks` for logo, links, images. |
| `video` | Video thumbnail | |
| `drop_shadow` | Decorative | |
| `html` | Escape hatch | **Last resort.** Opaque to every downstream tool, including validation. |

## Column layouts

Closed enum on `row.data.styles.column_layout`:

```
1-column-full-width
2-columns-equal-width  2-columns-25%-75%  2-columns-33%-67%
2-columns-67%-33%      2-columns-75%-25%
3-columns-equal-width  3-columns-25%-25%-50%
3-columns-25%-50%-25%  3-columns-50%-25%-25%
4-columns-equal-width
```

Anything else is rejected.

## Universal Content

A block or section carrying `universal_id` is Klaviyo Universal Content — edited
once, inherited by every template using it. This is the platform's component
layer.

**Reference an existing `universal_id` rather than rebuilding the component.**
Rebuilding forks it: the next edit updates one copy and silently leaves the other
behind.

## Traps

- **`text` blocks take HTML, not plain text.** Inline styles inside that HTML
  override the token layer and are invisible to anyone reading the tokens. Keep
  the markup structural.
- **`content` is the label on a `button`**, not a `label` property.
- **Set `alt_text` on every image.** The schema allows null. Email clients with
  images off do not.
- **`show_on`** (`all` / `desktop` / `mobile`) is how you serve different assets
  per device — duplicate the block, don't compromise on one.
- **`display_options.visibility`** carries conditional-render logic. Test both
  branches; a broken condition fails silently.
- **`content_repeat`** (`repeat_for` + `item_alias`) drives repeating blocks from
  a feed. Confirm the feed exists first.
- **`disable_websafe_fonts`** in `base-styles` governs custom-font handling. A
  brand font that isn't a Google Font will fall back in Gmail and Outlook
  regardless — choose the fallback deliberately.
- **Currency** is set per template in `base-styles.properties.currency`. Check it
  matches the account's registry entry.
- **Product names render.** They are copy, they come from the catalog, and they
  are subject to the account's messaging constraints even though nobody typed
  them into the brief.

## Minimum viable definition

```json
{
  "styles": [
    { "style_type": "base-styles", "properties": {}, "styles": {} },
    { "style_type": "text-styles", "styles": {} },
    { "style_type": "link-styles", "styles": {} },
    { "style_type": "heading-1-styles", "styles": {} },
    { "style_type": "heading-2-styles", "styles": {} },
    { "style_type": "heading-3-styles", "styles": {} },
    { "style_type": "heading-4-styles", "styles": {} },
    { "style_type": "mobile-styles", "properties": {}, "styles": {} }
  ],
  "body": {
    "styles": { "background_color": "#ffffff", "width": 600 },
    "properties": {},
    "sections": [
      {
        "content_type": "section",
        "type": "section",
        "data": { "properties": {}, "display_options": {}, "styles": {} },
        "rows": [
          {
            "data": { "styles": { "column_layout": "1-column-full-width" } },
            "columns": [
              {
                "data": {},
                "blocks": [
                  {
                    "content_type": "block",
                    "type": "text",
                    "data": {
                      "content": "<h1>Headline</h1>",
                      "display_options": {},
                      "styles": {}
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Populate the empty `styles` objects from the account's
`design-tokens.json` → `klaviyo_definition_styles`.

# Energy by day, rest by night — routine education

First end-to-end test of the brief → copy → design → Klaviyo build workflow for
Blessed Botanicals, and the first instance of the revised campaign brief format.

| Deliverable | File | Status |
|---|---|---|
| Brief | [`brief.md`](brief.md) | draft, ready for approval |
| Copy | `copy.md` | not started — waits on brief approval |
| Design | `design.json` + `design.md` | not started |
| QA | `qa.md` | not started |

## Skill versions

| Skill | Version |
|---|---|
| `execution.campaign-brief` | 0.1.0 |

## Decisions

- No offer. The send follows two weeks of Stack & Save; the routine is the hook.
- Featured four: Moringa + Ginkgo Biloba (morning), Lemon Balm + Sleepy Time
  (evening). Two lack approved framing and go to client review.
- Product cards are image + text + button, not native `product` blocks: the
  Klaviyo catalog API returned no items for this Shopify-integrated account.
- Design tokens are used as live despite `target_state` — the October 2026 sends
  already use the palette. Logged as open question 6 in the brief.

## Authorization

- Action class: none yet. Account is `read_only` with no named owner.
- Step 8 (Klaviyo template + campaign draft) needs a registry change — see
  brief section 12 and open question 5.
- Platform objects created: none.

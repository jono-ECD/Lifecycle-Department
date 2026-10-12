# Campaign brief — <campaign name>

| | |
|---|---|
| **Account** | `<slug>` — resolved via `accounts/registry.yml` |
| **Campaign type** | education / promotion / launch / seasonal / retention |
| **Send date** | YYYY-MM-DD (or _TBC_) |
| **Channels** | email / SMS |
| **Brief owner** | |
| **Status** | draft / approved |
| **Approved by, date** | |
| **Skill** | `execution.campaign-brief` vX.Y.Z |

A brief is a **decision record**, not a creative outline. Every section below
exists because copy or design goes wrong without it. The creative team keeps
room to work inside sections 5, 8 and 10; sections 1–4, 6, 7 and 9 are fixed
once approved.

## 1. Objective

One sentence: **who** does **what** after reading, and **how we will know**.
If the sentence needs an "and", there are two campaigns.

## 2. Audience and situation

| | |
|---|---|
| **Include** | Segments by name and platform ID |
| **Exclude** | Segments by name and platform ID |
| **Estimated size** | Read from the platform, or _unknown_ |
| **Recent contact** | What this audience received in the last 14 days; sends-per-week against the account ceiling |
| **Situation** | The frustration or desire this email meets. Where the reader is in the journey. What they already know. |

Segments that do not exist yet are listed as **to build**, with the definition
and who builds them. A proposed segment is not an audience.

## 3. Desired action

- **Primary CTA** — one verb, one destination URL
- **Secondary action** (optional) — must not compete with the primary

## 4. The main takeaway

The one idea the reader should remember if they read nothing else. One sentence,
in plain customer language, no product names.

## 5. Creative angle

Why this email deserves attention in the inbox. **What this email is not** —
name the adjacent email it could collapse into, so copy and design steer away
from it.

## 6. Verified facts

Everything copy is allowed to state. Each line carries a source and the date it
was confirmed. **Nothing unverified reaches copy.** If a product's approved
framing is missing, say so here — it becomes a review trigger, not a guess.

| Fact | Value | Source | Confirmed |
|---|---|---|---|
| Product, price, size, URL | | storefront / platform | YYYY-MM-DD |
| Approved framing per product | | `context/products-offers.md` | |
| Claims language allowed | | `context/messaging-constraints.md` | |

## 7. Offer

| | |
|---|---|
| **Offer** | or _none — this is not a promotional send_ |
| **Code** | |
| **Valid from / to** | |
| **Terms and restrictions** | |
| **Source of truth** | link + date confirmed |

Standing offers (subscription discount, free-shipping threshold) are listed here
if copy may mention them, with the same source line.

## 8. Brand direction

- **Voice notes for this send** — the two or three rules from
  `context/brand-voice.md` that matter most here
- **Approved phrases to lean on** — from the account's approved list
- **Reference sends** — three to five, each with one line on what to take from it
- **What to avoid** — the failure mode this voice is most prone to in this
  campaign type

## 9. Constraints

Pull from `context/messaging-constraints.md`:

- Prohibited claims that are live risks for *this* content
- Required disclosures
- **Review triggers** — who must see this before send, and why
- Platform or deliverability constraints (image-to-text, send volume)

## 10. Structure

| | |
|---|---|
| **Required elements** | Must appear. Short list. |
| **Suggested flow** | A section order the creative team may change |
| **Design notes** | Components from `context/design-system.md` to reuse; mobile-first rules; build format (live-text blocks) |
| **Assets** | Images available, by URL or asset ID. Never invented. |

## 11. Success measure

| | |
|---|---|
| **Primary metric** | with benchmark and its source |
| **Secondary** | |
| **What we learn** | The question this send answers for the next one |

## 12. Build and authorization

| | |
|---|---|
| **Account ceiling** | `agent_access` from the registry, and the named `owner` |
| **Platform objects** | Template, campaign draft, segments — created by whom |
| **Scheduling / sending** | Human, named |

## 13. Open questions

| Question | Blocking? | Owner | Default if unanswered |
|---|---|---|---|

**A brief with open blocking questions is not approved.** A non-blocking
question carries a default so work continues.

## Change history

| Version | Date | Change |
|---|---|---|

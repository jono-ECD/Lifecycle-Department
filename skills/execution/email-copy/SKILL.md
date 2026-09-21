# Email Copy

- ID: `execution.email-copy`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: 2026-09-20

## Purpose

Write campaign or flow email copy from an approved brief, in the account's voice,
within the account's messaging constraints. Use when a brief exists and copy is the
next deliverable. Not for writing the brief itself (`execution.campaign-brief`) or
for deciding the audience (`execution.segmentation`).

## Required inputs

| Input | Source | If missing |
|---|---|---|
| Approved campaign brief | `accounts/<slug>/campaigns/<campaign>/brief.md` | Stop. Run `execution.campaign-brief` first. |
| Brand voice | `accounts/<slug>/context/brand-voice.md` | Stop. Copy without voice is a rewrite waiting to happen. |
| Offer details + terms | `accounts/<slug>/context/products-offers.md`, confirmed against the brief | Stop. Never infer offer terms, dates, or discount amounts. |
| Messaging constraints | `accounts/<slug>/context/messaging-constraints.md` | Stop. Prohibited claims are a compliance risk, not a style note. |
| Audience definition | Brief, or `execution.segmentation` output | Proceed, but flag — copy written for an unknown reader is generic by default. |

## Instructions

1. **Confirm the account.** Read `accounts/<slug>/README.md`. Verify the brief you
   were given belongs to this account. Mismatched account context is the single
   most damaging error this skill can make.
2. **Read the constraints before the brief.** Knowing what cannot be said shapes
   what you draft. Note every prohibited claim and required disclosure.
3. **Read the brief and voice guide.** Extract: the one objective, the offer and
   its exact terms, the CTA, and the landing destination.
4. **Check offer terms against the source.** The brief names a source of truth and
   a confirmation date. If that date is stale relative to the send date, re-confirm
   before writing.
5. **Draft in this order** — subject and preview last:
   - Body: lead with the reader's reason to care, not the brand's announcement.
   - CTA: one primary action, stated as a verb.
   - Subject + preview text: written to match the body that exists, not the body
     you intended. Preview text complements the subject; it does not repeat it.
6. **Write personalization fallbacks.** Every token gets a fallback that reads
   naturally when empty. `Hi ,` shipping to the list is a QA failure that starts
   here.
7. **Self-check against the quality criteria below**, then revise.
8. **Save** to `accounts/<slug>/campaigns/<campaign>/copy.md` with the skill
   version recorded.

## Output

Markdown at `accounts/<slug>/campaigns/<campaign>/copy.md`:

```markdown
# Copy — <campaign name>
- Skill: execution.email-copy v0.1.0
- Drafted: YYYY-MM-DD

## Subject line
## Preview text
## Body
## CTA
## Personalization tokens and fallbacks
| Token | Fallback |
```

## Quality checks

- [ ] Every factual claim traces to the brief or account context — nothing invented
- [ ] Offer terms match the brief exactly (amount, code, dates, restrictions)
- [ ] No claim appears that `messaging-constraints.md` prohibits
- [ ] Required disclosures present
- [ ] One primary CTA, phrased as an action
- [ ] Every personalization token has a fallback that reads naturally
- [ ] Subject and preview complement rather than duplicate
- [ ] Voice matches `brand-voice.md` — read it aloud against an approved example
- [ ] Links resolve and point at the destination the brief names

## Tools and action boundaries

This skill produces **text only**. It does not create a platform draft, schedule,
or send. Those are separate authorizations — see
`integrations/mcp/access-policy.md`.

## Account customization

Voice, offers, and prohibited claims are account **context** and belong in
`accounts/<slug>/context/` — they never justify forking this skill. Create an
account-local copy skill only when the *procedure* differs (for example, a weekly
product-drop with a fixed multi-step sequence). See `governance/skill-authoring.md`.

## Dependencies

Consumes `execution.campaign-brief` and `execution.segmentation`. Gated by
`execution.campaign-flow-qa`. Called from `workflows/multi-campaign.md`.

## Examples and references

`examples/` — approved samples. Keep fictional or fully anonymized; no real
customer data, no credentials.

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-20 | Created as the reference worked example |

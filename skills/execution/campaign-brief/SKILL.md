# Campaign Brief

- ID: `execution.campaign-brief`
- Owner: _unassigned_
- Status: draft
- Version: 0.1.0
- Last reviewed: 2026-10-12

## Purpose

Turn a campaign idea into an approved, goal-oriented brief that copy and design
can work from without guessing. Use when a campaign concept exists and the next
deliverable is the brief. Not for writing copy (`execution.email-copy`) or for
building segments (`execution.segmentation`) — this skill names the audience and
records what must be built.

The brief is a **decision record**. Its job is to remove the ambiguity that
makes AI-drafted copy generic and AI-drafted design off-brand: who the reader
is, what they should do, what may be said, and what "good" means.

## Required inputs

| Input | Source | If missing |
|---|---|---|
| Campaign concept | Client, strategist, or the account's campaign calendar | Stop. A brief without a concept is a calendar slot. |
| Account context | `accounts/<slug>/context/` — all five files | Stop if `brand-voice.md` or `messaging-constraints.md` is empty. Proceed with gaps marked for the rest. |
| Live product facts | Storefront or platform catalog, read on the day | Proceed, but every product line in section 6 is marked _unconfirmed_ and becomes a blocking question. |
| Existing segments | Platform, read on the day | Proceed; list needed segments as **to build**. |
| Recent send history | Platform campaign list, last 14 days | Proceed; mark the fatigue check as _not run_. |
| Performance benchmarks | Reporting tool, last 60–90 days | Proceed; success measure carries _no benchmark_ and the first send sets one. |

## Instructions

1. **Confirm the account.** Resolve the slug through `accounts/registry.yml`.
   Note `agent_access` and `owner` — they decide how far the workflow can run
   after the brief, and the brief records that in section 12.

2. **Read the constraints before the concept.** Prohibited claims, review
   triggers and promo guardrails shape what the campaign can be. A concept that
   needs a prohibited claim to work is a different campaign.

3. **Reduce the concept to one objective.** One reader, one action, one
   measure. If the concept contains two actions, pick the primary and make the
   other a secondary action or a separate send.

4. **Verify every fact copy will use.** Open the landing destination and the
   product pages. Record name, price, size and URL as they appear today, with
   the date. Check each featured product against the account's approved framing
   in `products-offers.md`. A product with no approved framing is still usable,
   but it is a **review trigger** and the brief says so.

5. **Resolve the audience to platform objects.** List existing segments by
   name and ID, with what their definition actually does (read it, do not trust
   the name). Where no segment matches, write the definition and mark it
   **to build**. Add the account's standing exclusions. Run the fatigue check
   against the last 14 days of sends.

6. **Decide the offer explicitly.** "None" is a decision and is written down.
   Any offer carries code, dates, terms and a source of truth with a
   confirmation date. Standing offers copy may mention are listed the same way.

7. **Write the creative angle and what it is not.** Name the adjacent email
   this one could collapse into — the discount send, the generic wellness
   send, the product dump — so copy and design steer away from it.

8. **Set brand direction for this send.** Pick the two or three voice rules
   that matter most for this campaign type and the three to five reference
   sends that show the target. Point at them; do not paraphrase the voice
   guide.

9. **Define structure as required versus suggested.** Required elements are
   the short list the email fails without. Everything else is a suggestion the
   creative team may change. Name the design-system components to reuse and the
   build format.

10. **Set the success measure with a benchmark and its source.** Then write
    the question this send answers for the next one.

11. **List open questions with blocking status, owner and default.** A
    blocking question with no owner is the brief's biggest defect. Resolve
    what you can from the sources before handing the rest to a human.

12. **Save** to `accounts/<slug>/campaigns/YYYY-MM-DD-campaign-name/brief.md`
    using `templates/campaign-brief.md`, with the skill version recorded.
    Status stays `draft` until a named human approves it.

## Output

`accounts/<slug>/campaigns/<campaign>/brief.md`, in the shape of
`templates/campaign-brief.md`, all thirteen sections present. Empty sections are
marked _not captured_ or _none_, never left blank.

## Quality checks

- [ ] Account resolved through the registry; ceiling and owner recorded
- [ ] Objective is one sentence with one action and one measure
- [ ] Every segment in section 2 has a platform ID or is marked **to build** with a definition
- [ ] Fatigue check run against the last 14 days, or marked _not run_
- [ ] Every product in section 6 has price, URL, source and confirmation date read today
- [ ] Every product lacking approved framing is flagged as a review trigger
- [ ] Offer section says _none_ or carries code, dates, terms, source and confirmation date
- [ ] Section 5 names what the email is **not**
- [ ] Reference sends are named, not described
- [ ] Prohibited claims relevant to this content are listed, not just linked
- [ ] Success measure has a benchmark with a source, or says it has none
- [ ] Every open question has blocking status, owner and a default
- [ ] No blocking question is open if status is `approved`

## Tools and action boundaries

This skill **reads**: storefront pages, platform catalog, segments, campaign
history, reporting. It creates no platform objects. Segments it finds missing
are recorded as work for `execution.segmentation` or a human, not built here.

Approval is a human act. The brief's `Status` moves to `approved` only when a
named person is recorded against it.

## Account customization

Audience, products, offers, voice and constraints are account **context** and
never justify forking this skill. Fork only if the *procedure* differs — a
client who requires a second approval stage, or a brief that must be lodged in
an external system before work starts.

## Dependencies

Feeds `execution.email-copy` and `execution.email-design`. Step 2 of
`workflows/creative-production.md`. Names work for `execution.segmentation`.
Gated downstream by `execution.campaign-flow-qa`.

## Examples and references

- `templates/campaign-brief.md` — the output format
- First worked instance: `accounts/blessed-botanicals/campaigns/2026-10-21-energy-sleep-routine/brief.md`

## Change history

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-10-12 | Created from the first end-to-end brief test; replaces the seven-section brief template |

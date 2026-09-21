# Skill review and versioning

## Versioning

| Bump | Means | Example |
|---|---|---|
| Patch `1.0.1` | Clarification, no behavior change | Rewording a step |
| Minor `1.1.0` | Compatible addition | New optional quality check |
| Major `2.0.0` | Required inputs, outputs, or behavior change | New mandatory input |

Keep the version in `SKILL.md` and the catalog consistent — the catalog is
generated from the header, so updating the header is sufficient.

A major bump requires review of every account catalog referencing the skill, and
a recorded adoption decision per account.

> A version number in a Markdown file does not preserve executable copies of older
> instructions. Use git history or release tags to retrieve earlier versions. If an
> integration must run several versions at once, define that packaging mechanism
> before promising version pinning.

## Review by change type

| Change | Validation |
|---|---|
| Spelling, formatting, navigation | Read it; check links resolve |
| Account facts | Confirm against the approved source; record the date |
| Skill instructions | Run a representative task; inspect the output |
| Shared skill behavior | Check against representative affected account contexts |
| Tool mapping or setup | Verify in the intended environment with an authorized, reversible action |
| Publish or access rules | Review by the responsible owner — not optional |

## Promotion to `approved`

A skill leaves `draft` when: instructions are complete, quality checks are
observable, it has been run on a real task, the output was reviewed, and an owner
is named. Until then it stays `draft` and must not be relied on for delivery.

## Retiring

Mark it `retired`, name its replacement in the skill, update every account catalog
that references it, and preserve the history. Never delete a referenced skill
without migrating its users.

## Pull request expectations

State the problem, the new behavior, which accounts are affected, and what
validation you ran. Update catalog references in the same change — the sync script
handles the generated blocks, but curated entries (account catalogs, the
"not yet built" list) are yours.

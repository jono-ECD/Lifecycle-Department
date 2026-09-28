# Campaign Bank — Blessed Botanicals tenant config

The architecture is in
[`integrations/campaign-bank/README.md`](../../../integrations/campaign-bank/README.md).
This file holds only the Blessed Botanicals facts the Bank needs, all read
2026-09-28. **Status: not built.** These values will seed the `accounts.config`
row.

## Asana

| | |
|---|---|
| Project | `Blessed Botanicals \| BB` — gid `1217197156877518` |
| Campaign section | `📣 BB \| Email \| SMS \| Flows` — gid `1217197156877529` |
| Filter | `Type of Work` (field `1217198332959066`) ∈ Email `1217198332959067`, SMS `1217198332959068` |
| Stage field (project setting) | gid `1217203785072631` |

Stage options used by the mapping:

| Option | gid |
|---|---|
| Client Review | `1217203785072639` |
| Edits In Progress | `1217203785072640` |
| Build in Klaviyo | `1217203785072641` |
| QA & Scheduling | `1217203785072642` |
| Scheduled in Klaviyo | `1217285469667201` |
| Final Approval | `1217286659790406` |
| Done | `1217203785072643` |
| On Hold \| Canceled | `1217204032307519` |

> **Data hygiene flag.** Tasks also carry a second custom field named "Stage"
> (gid `1214997479213252`), which is not in the project's field settings. It's
> probably inherited from another project or a template. Its values disagree with
> the first field on the same task: one task reads "QA & Scheduling" on one and
> "Design" on the other. The Bank binds to `1217203785072631` only. Decision D5
> confirms or overrides that.

**Task conventions the parser relies on:** names follow `BB - <Mon D>, <Title>`.
Notes carry `Brief:`, `Copy:`, `Design:` (a Figma URL with `node-id`), and
`Klaviyo:` (a campaign URL) lines. SMS tasks put the copy inline and have an empty
`Design:` line.

## Figma

Design files are monthly (e.g. `BB - AUG - EMAILS`), with one frame per campaign,
addressed by the `node-id` in the task link.

## Google Sheets

| Sheet | Drive id | Bank's relationship |
|---|---|---|
| `BB \| Email & SMS Scheduler` | `1fwQWs__kvpinEcJBlR5mjv3I4OaIPd7po0Z_rcjj9cM` | Calendar. The Bank will write a `Campaign Bank` tab. It never edits the *Promo Calendar* grid |
| `Blessed Botanicals \| Mockups Reviewer` | `1DnnkjHBhD4Im6V80DoDgwRYLt3cW3v8i-PA24lgAYNk` | Current approval record. Columns: Flow, Title, Link to Design File, Status, Client Notes. **The Bank replaces it** after a parallel run (D1) |

The reviewer sheet has no stable ID column. Titles are the only key, and they
already differ between columns in some rows (e.g. "May 26" vs "May 28" for the
same email). That's why the Bank keys on the Asana task gid and does not try to
match rows by name.

## Approvers

Per [`../context/business.md`](../context/business.md): Ashton and Brittany Spink
give final approval. Mason and others leave notes. Default roles:
`client_approver` for the founders, `client_commenter` for everyone else (D4).

When the Bank goes live, update the **Approval process** section of
[`../context/messaging-constraints.md`](../context/messaging-constraints.md).
Until then, the reviewer sheet stays the approval record.

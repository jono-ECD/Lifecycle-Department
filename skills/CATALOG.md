# Skills catalog

The authoritative index of shared skills. Full instructions live in each
`SKILL.md`, never here.

<!-- Generated from skills/**/SKILL.md. Do not hand-edit: run scripts/sync.py -->

<!-- BEGIN:generated:skills-catalog -->
| ID | Skill | Status | Version | Owner | Purpose |
|---|---|---|---|---|---|
| `execution.email-copy` | [Email Copy](execution/email-copy/SKILL.md) | draft | 0.1.0 | _unassigned_ | Write campaign or flow email copy from an approved brief, in the account's voice, within the account's messaging constraints. |
| `marketing-strategy.account-growth-analysis` | [Account Growth & Analysis](marketing-strategy/account-growth-analysis/SKILL.md) | draft | 0.1.0 | _unassigned_ | The recurring loop that checks whether the strategy is working and decides what changes. |
| `marketing-strategy.customer-persona` | [Customer Persona](marketing-strategy/customer-persona/SKILL.md) | draft | 0.1.0 | _unassigned_ | Persona work that earns its place by changing messaging decisions. |
| `marketing-strategy.product-service-strategy` | [Product / Service Strategy](marketing-strategy/product-service-strategy/SKILL.md) | draft | 0.1.0 | _unassigned_ | How the catalog itself drives lifecycle: |
| `marketing-strategy.purchase-journey` | [Purchase Journey](marketing-strategy/purchase-journey/SKILL.md) | draft | 0.1.0 | _unassigned_ | The end-to-end map from first touch to repeat purchase and advocacy, with the decision points, friction, and trigger moments marked. |
| `marketing-strategy.retention-strategy` | [Retention Strategy](marketing-strategy/retention-strategy/SKILL.md) | draft | 0.1.0 | _unassigned_ | The department's core thesis per account: |
| `marketing-strategy.target-audience` | [Target Audience](marketing-strategy/target-audience/SKILL.md) | draft | 0.1.0 | _unassigned_ | Who the brand is actually for, defined tightly enough to drive segmentation and creative rather than sit in a deck. |
| `onboarding-migration.customer-agent` | [Customer Agent](onboarding-migration/customer-agent/SKILL.md) | draft | 0.1.0 | _unassigned_ | Configuring Klaviyo's AI customer agent: |
| `onboarding-migration.full-implementation` | [Full Implementation](onboarding-migration/full-implementation/SKILL.md) | draft | 0.1.0 | _unassigned_ | End-to-end lifecycle build for a new account: |
| `onboarding-migration.k-social` | [K:Social](onboarding-migration/k-social/SKILL.md) | draft | 0.1.0 | _unassigned_ | Klaviyo Social setup and integration into the lifecycle program, so social audiences and owned-channel audiences resolve against the same profile data rather than running as a separate silo. |
| `onboarding-migration.marketing-analytics-personalization` | [Marketing Analytics (Personalization)](onboarding-migration/marketing-analytics-personalization/SKILL.md) | draft | 0.1.0 | _unassigned_ | The measurement and personalization substrate: |
| `onboarding-migration.mini-implementation` | [Mini Implementation](onboarding-migration/mini-implementation/SKILL.md) | draft | 0.1.0 | _unassigned_ | A scoped subset of Full Implementation covering the highest-revenue core flows only. |
| `onboarding-migration.sms-migration` | [SMS Migration](onboarding-migration/sms-migration/SKILL.md) | draft | 0.1.0 | _unassigned_ | Moving an existing SMS program into Klaviyo without losing subscribers, consent records, or compliance standing. |
<!-- END:generated:skills-catalog -->

**Status** — `draft` means scaffolded and not safe to deliver from; `approved`
means reviewed and usable; `retired` means superseded (the entry names its
replacement). **Version** follows `governance/skill-review.md`.

## Not yet built

Named in the department taxonomy, no folder created yet. Add the folder when the
capability is developed — not as an empty placeholder.

| Planned ID | Group | Notes |
|---|---|---|
| `execution.research` | execution | Feeds strategy skills; see `workflows/content-research.md` |
| `execution.campaign-brief` | execution | Next priority — gates `execution.email-copy` |
| `execution.sms-copy` | execution | Needs `messaging-constraints` SMS section populated first |
| `execution.creative-direction` | execution | |
| `execution.segmentation` | execution | |
| `execution.flow-architecture` | execution | Pairs with `workflows/flow-architecture.md` |
| `execution.campaign-flow-qa` | execution | **Recommended first build** — gates three workflows |

## Adding a skill

1. Copy [`templates/skill-template.md`](../templates/skill-template.md) to
   `skills/<group>/<name>/SKILL.md`.
2. Fill the header: ID, owner, status `draft`, version `0.1.0`.
3. Write it per [`governance/skill-authoring.md`](../governance/skill-authoring.md).
4. Run `python3 scripts/sync.py` — this catalog regenerates from the headers.
5. Open a PR per [`governance/skill-review.md`](../governance/skill-review.md).

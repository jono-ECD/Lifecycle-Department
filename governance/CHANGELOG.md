# Changelog

Significant changes to the shared library. Account-level work is not recorded here.

## 2026-09-20

### Restructured to the department repository guide

Adopted the guide's structure: `skills/` (how), `accounts/*/context/` (who for),
`accounts/*/{strategy,campaigns,flows,reporting}/` (what was produced), plus
`workflows/`, `department/`, `templates/`, `integrations/`, and `governance/`.

Replaces the earlier two-layer `system/` + `clients/` layout, which collapsed
account context and account deliverables into one bucket.

- 12 service-taxonomy skills migrated to `SKILL.md` format, all `draft` —
  purpose, inputs, and outputs carried over; procedures still unwritten
- `execution.email-copy` added as the reference worked example
- 7 workflows created; `multi-campaign.md` fully worked as the reference
- 5 accounts expanded to `context/` + `platform/` + `skills/` + work folders
- `accounts/registry.yml` retained as the single source of truth for account
  identity; `platform/klaviyo.md` is now generated from it
- `skills/CATALOG.md` generated from `SKILL.md` headers

### Deviation from the guide

The guide suggests maintaining catalogs manually at first. We generate
`skills/CATALOG.md` from the `SKILL.md` headers instead — the owner/status/version
fields are exactly the ones that go stale silently, and the generator already
existed for the account tables. Manual curation remains for judgment calls: the
"not yet built" list and per-account catalogs.

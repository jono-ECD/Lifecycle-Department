# MCP tool map

Which business actions map to which verified capabilities.

> **Verified** means *someone ran it in the intended environment and it worked*,
> with the date. Everything else is **pending** — do not promise it, do not build a
> workflow that depends on it, and do not infer that a capability exists because a
> connector is present. A Klaviyo MCP connector exposes hundreds of tools; that is
> not evidence any given one is wired, permitted, or working.

## Verified

| Action | Connector | Tool | Kind | Verified |
|---|---|---|---|---|
| Read Klaviyo account metadata | `Klaviyo - Blessed Botanicals` | `get_account_details` | read | 2026-09-20 |
| Read Klaviyo account metadata | `Klaviyo - Lazy Leaf` | `get_account_details` | read | 2026-09-20 |
| List agency clients | `Hiro Analytics` | `list_clients` | read | 2026-09-20 |
| Read brand colour library | `Klaviyo - Blessed Botanicals` | `get_brand_colors` | read | 2026-09-21 |
| Read brand email defaults | `Klaviyo - Blessed Botanicals` | `get_brand_email_defaults` | read | 2026-09-21 |
| List email templates | `Klaviyo - Blessed Botanicals` | `list_email_templates` | read | 2026-09-21 |
| Read one template's DnD definition | `Klaviyo - Blessed Botanicals` | `get_email_template` | read | 2026-09-21 |

Used to confirm the Klaviyo account IDs in `accounts/registry.yml` for
Blessed Botanicals (`RaFbmF`) and Lazy Leaf (`RQeWJs`), and to build
`accounts/blessed-botanicals/context/design-system.md`.

Notes from exercising the template reads:

- `list_email_templates` caps `page_size` at 10 and omits DnD definitions unless
  `additional_fields_template: ["definition"]` is passed.
- `fields_template` accepts `definition.styles` on its own. Pulling just the
  token layer across every template is cheap; pulling `definition.body.sections`
  is not — a single content-heavy template runs to thousands of lines.
- An empty result is a finding. `get_brand_colors` returned `[]` for Blessed
  Botanicals, which is what established that the brand library is unpopulated.

## Pending

Not verified. Listed because workflows reference them, **not** because they work.

| Action | Kind | Blocker |
|---|---|---|
| Read campaign / flow performance | read | Unexercised |
| Read segments, lists, profiles | read | Unexercised |
| Create a campaign draft | **create** | Unexercised; also needs an authorization decision |
| Assign a template to a campaign message | **update** | Unexercised |
| Schedule or send a campaign | **publish** | Unexercised; requires explicit human authorization — see `access-policy.md` |
| Create or update a flow | **update** | Unexercised |
| Any capability for Exzell Pharma, Something Borrowed Blooms, Bad Boy Mower Parts | — | **No connector exists** |

## Connector coverage

Three of five accounts in the registry have no connector. Any workflow that reads
live data runs for Blessed Botanicals and Lazy Leaf only. Check
`accounts/registry.yml` before promising analysis, reporting, or live QA.

Connectors are also present for accounts **not** in this registry (Celtic Sea Salt,
HigherDOSE, Luxury of Watches, Pipeliners Cloud, Power Planter). They are out of
scope for this repository. Presence of a connector is not authority to use it.

## When a tool fails or is missing

1. Say so plainly. Do not substitute an inferred or remembered number.
2. Record the failure and date here.
3. If an account has no connector, state that the analysis cannot be run — an empty
   result is a finding, not an outage to work around.

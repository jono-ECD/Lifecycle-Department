# System — the reusable layer

The method, held once. Templates, SOPs, checklists, prompts, and agent skills live
here. **No client-specific output belongs in this tree.**

Why the split: method changes rarely and applies to every account; client work
changes weekly and applies to one. Storing them together means either duplicating
every template per client (and watching them drift) or scattering client context
across the taxonomy. Separating them means adding client #6 touches no file in here.

## Onboarding & Migration
Getting an account from signed to running.

| Node | Purpose |
|---|---|
| [`full-implementation`](onboarding-migration/full-implementation/) | End-to-end lifecycle build |
| [`mini-implementation`](onboarding-migration/mini-implementation/) | Scoped core-flow subset |
| [`sms-migration`](onboarding-migration/sms-migration/) | SMS program migration + compliance |
| [`marketing-analytics-personalization`](onboarding-migration/marketing-analytics-personalization/) | Measurement and personalization substrate |
| [`customer-agent`](onboarding-migration/customer-agent/) | Klaviyo AI customer agent config |
| [`k-social`](onboarding-migration/k-social/) | Klaviyo Social integration |

## Marketing Strategy
Deciding what the program should do and why.

| Node | Purpose |
|---|---|
| [`target-audience`](marketing-strategy/target-audience/) | Who the brand is for, as segments |
| [`customer-profile-persona`](marketing-strategy/customer-profile-persona/) | Personas mapped to queryable cohorts |
| [`purchase-journey`](marketing-strategy/purchase-journey/) | First touch to advocacy, with gaps marked |
| [`product-service-strategy`](marketing-strategy/product-service-strategy/) | How the catalog drives lifecycle |
| [`retention-strategy`](marketing-strategy/retention-strategy/) | The core thesis per account |
| [`account-growth-analysis`](marketing-strategy/account-growth-analysis/) | The recurring decide-what-changes loop |

## AI Systems & Work Flow
How the work actually gets done, repeatably.

| Node | Purpose |
|---|---|
| [`agent-skills`](ai-systems-workflow/agent-skills/) | Versioned skills — the compounding asset |
| [`creative-workflows`](ai-systems-workflow/creative-workflows/) | Concept to approved asset |
| [`content-research-workflow`](ai-systems-workflow/content-research-workflow/) | VOC, competitive, and category research |
| [`multi-campaign-workflow`](ai-systems-workflow/multi-campaign-workflow/) | Calendar to scheduled sends |
| [`growth-analysis-workflow`](ai-systems-workflow/growth-analysis-workflow/) | Automated reporting and diagnosis |
| [`qa-workflow`](ai-systems-workflow/qa-workflow/) | The gate before anything ships |
| [`flow-architect-workflow`](ai-systems-workflow/flow-architect-workflow/) | Journey to build-ready flow spec |

## Dependency spine

The three groups are not peers — they stack. Strategy decides, workflows execute,
onboarding is the first full pass through both:

```
marketing-analytics-personalization   (data substrate — everything reads from it)
            │
            ▼
target-audience → customer-profile-persona → purchase-journey
            │                                      │
            ▼                                      ▼
   product-service-strategy ──→ retention-strategy │
                                      │            │
                                      ▼            ▼
                              flow-architect-workflow
                                      │
                                      ▼
                        full / mini-implementation ──→ qa-workflow ──→ live
                                                            ▲
                          creative + multi-campaign ────────┘
                                      │
                                      ▼
                        growth-analysis-workflow → account-growth-analysis
                                      │                     │
                                      └─── feeds back to retention-strategy
```

The loop at the bottom is the point. If growth analysis never revises the retention
thesis, the system is reporting, not learning.

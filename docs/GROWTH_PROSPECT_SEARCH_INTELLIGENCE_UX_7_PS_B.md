# Phase 7.PS-B — Prospect Search Intelligence UX & Filters

## Objective

Make Prospect Search visibly useful with Growth Engine 7.2–7.7 intelligence loaded in 7.PS-A — filters, badges, card summaries, and legacy panel gating without new providers or runtime mutations from search.

## Scope

| Area | Implementation |
|------|----------------|
| Verified email / phone / profile filters | `GrowthProspectSearchFilters.engine_verified_*` — post-hydration on `engine_intelligence.verified_channels` |
| Buying committee role filters | `buying_committee_roles` — any selected role in `roles_present` |
| Company intelligence category filters | `company_intelligence_categories` — any selected category in `categories_present` |
| Discovery status badges | `ProspectSearchEngineIntelligenceDiscoveryBadge` |
| Search-card summary | `ProspectSearchEngineIntelligenceSummary` on company result cards |
| People-row channel badges | `ProspectSearchEngineIntelligenceChannelBadges` |
| Legacy panel gating | `ProspectSearchLegacyIntelligenceNotice` wraps company-signals + contact-discovery committee panels when 7.x data exists |
| Operator copy | `prospect-search-engine-intelligence-ux.ts` |

## Read path

- Filters apply **after** `applyProspectSearchContactIntelligenceOverlay` in contact-first and discover hydration paths.
- No cron, orchestrator, or promotion from Prospect Search.

## QA marker

`growth-prospect-search-intelligence-ux-7-ps-b-v1`

## Tests

```bash
pnpm test:growth-prospect-search-intelligence-ux-7-ps-b
pnpm test:growth-prospect-search-engine-intelligence-7-ps-a
pnpm update:master-context
```

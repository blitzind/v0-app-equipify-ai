# Phase 7.PS-C — Prospect Search Actionable Research Workflow

## Objective

Route Prospect Search research actions to existing Growth Engine discovery/intelligence **job APIs** (7.3B–7.7B) instead of only legacy website contact discovery.

## Job mapping

| Research action (examples) | Job API |
|--------------------------|---------|
| `verify_email` | `POST /api/platform/growth/email-discovery/jobs` |
| `verify_phone_numbers`, `improve_call_readiness` | `POST /api/platform/growth/phone-discovery/jobs` |
| `queue_social_profile_discovery` | `POST /api/platform/growth/social-profile-discovery/jobs` |
| `rerun_website_extraction` | `POST /api/platform/growth/company-intelligence/jobs` |
| Persona / committee gaps | `POST /api/platform/growth/buying-committee-intelligence/jobs` |
| No canonical company / `refresh_stale_contacts` | Legacy `GET /api/platform/growth/contact-discovery` |

Uses `canonical_company_id` and `canonical_person_id` from `contact_intelligence.engine_intelligence` (7.PS-A). Operator-triggered only (`trigger_source: manual`). No auto-orchestration from search filters.

## UI

- `ProspectSearchActionableResearchActions` — suggested Growth Engine buttons on engine intelligence panel
- `ProspectSearchEngineDiscoveryRollup` — lane status on search cards
- Shell `handleAccountResearchAction` — dispatches via `executeProspectSearchActionableResearch`

## QA marker

`growth-prospect-search-actionable-research-7-ps-c-v1`

## Tests

```bash
pnpm test:growth-prospect-search-actionable-research-7-ps-c
pnpm test:growth-prospect-search-engine-intelligence-7-ps-a
pnpm test:growth-prospect-search-intelligence-ux-7-ps-b
pnpm update:master-context
```

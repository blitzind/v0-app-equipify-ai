# Growth Engine Phase 7.6A — Company Intelligence Foundation

Evidence-backed company intelligence for canonical companies. **Foundation only** — synchronous HTTP runs, no jobs, cron, browser intake, or call-queue automation (7.6B).

## Hard rules

- No AI-generated company facts
- No hallucinated firmographics
- No paid enrichment providers
- No predictive scoring or buying-intent generation
- Every intelligence item requires source evidence
- Promotion only for **verified** findings at confidence ≥ 0.85

## Schema

Migration: `supabase/migrations/20270717120000_growth_engine_company_intelligence_7_6a.sql`

| Table | Purpose |
|-------|---------|
| `growth.company_intelligence_runs` | Per-company collection orchestration |
| `growth.company_intelligence_evidence` | Auditable evidence rows (grouped by `finding_ref`) |
| `growth.company_intelligence_snapshots` | Canonical promoted intelligence store (unique per `company_id` + `normalized_intelligence_key`) |

## Intelligence categories

`description`, `industry`, `sub_industry`, `website_signal`, `technology`, `social_presence`, `company_size`, `location`, `hiring`, `contactability`

## Deterministic sources (7.6A)

1. **Public website** — crawl, JSON-LD Organization, meta description, tech patterns, careers/hiring detectors, feature flags, contact discovery
2. **Staging** — `company_source_lineage` → `external_company_candidates` / `real_world_company_candidates`
3. **Canonical company** — existing `growth.companies` fields
4. **Canonical social** — `growth.company_profiles`
5. **Prior snapshots** — existing `company_intelligence_snapshots` (read-only channel)

## APIs

- `POST /api/platform/growth/company-intelligence/run` — `{ company_id, promote? }`
- `GET /api/platform/growth/company-intelligence/runs/[runId]`
- `GET /api/platform/growth/company-intelligence/operator-status?company_id=`

## UI

`GrowthCompanyIntelligencePanel` on `/admin/growth/infrastructure`

## QA

- Marker: `growth-company-intelligence-7.6a-v1`
- Tests: `pnpm test:growth-company-intelligence-7.6a`

## Out of scope (7.6B)

- `company_intelligence_jobs`
- Cron worker / queue / stale recovery
- Browser intake triggers
- Call-queue filters
- Operator card in decision-makers panel

# Growth Engine Phase 7.6B — Company Intelligence Runtime Integration

Async orchestration for canonical company intelligence. Mirrors email/phone/social profile discovery runtime (7.3B–7.5B).

## Schema

Migration: `supabase/migrations/20270718120000_growth_engine_company_intelligence_jobs_7_6b.sql`

- `company_intelligence_jobs` — one active job per `company_id` (unique partial index)
- Trigger sources: `manual`, `company_enriched`, `browser_extension`, `infrastructure_panel`

## Runtime

| Component | Detail |
|-----------|--------|
| Cron | `growth-company-intelligence-worker` — `*/10 * * * *`, max **2** jobs per tick |
| Queue | `enqueueCompanyIntelligenceJob`, `processCompanyIntelligenceJobQueue` |
| Stale recovery | 30m running → `failed` (`stale_running_job_recovered_v1`) |
| Orchestrator | Reuses 7.6A `runCompanyIntelligenceForCanonicalCompany` (verification + promotion unchanged) |

## Triggers

- `triggerCompanyIntelligenceAfterCompanyEnriched` — after `company_contact_refresh_queue` completes for a canonical company

## APIs

- `POST /api/platform/growth/company-intelligence/jobs`
- `GET/POST /api/platform/growth/browser-intake/company-intelligence`
- `GET /api/platform/growth/leads/[leadId]/company-intelligence`
- `GET /api/platform/growth/call-queue?company_intelligence_filter=`

Filters: `has_verified_intelligence`, `missing_verified_intelligence`, `discovery_pending`, `discovery_failed`

## Operator surfaces

- `GrowthCompanyIntelligenceOperatorCard` — lead drawer (company-scoped)
- Infrastructure panel — default queue; optional sync `/run` debug
- Browser extension — `company_intelligence` in CRM context

## Audit events

- `company_intelligence_job_enqueued`
- `company_intelligence_job_completed`
- `company_intelligence_job_failed`

## QA

- Marker: `growth-company-intelligence-runtime-7.6b-v1`
- Tests: `pnpm test:growth-company-intelligence-7.6b`

## Hard rules (preserved from 7.6A)

No AI firmographics, no paid enrichment, no predictive scoring, no buying intent. Evidence-backed findings only. Per-company snapshot uniqueness `(company_id, normalized_intelligence_key)`.

# Growth Engine Phase 7.7B — Buying Committee Intelligence Runtime

Async job queue for buying committee intelligence, aligned with 7.3B–7.6B discovery runtimes. Preserves all 7.7A verification, promotion, and employment integrity rules.

## Schema

Migration: `supabase/migrations/20270720120000_growth_engine_buying_committee_jobs_7_7b.sql`

| Object | Purpose |
|--------|---------|
| `buying_committee_jobs` | One active job per canonical company (`pending` / `running` / `completed` / `failed`) |

**Triggers:** `manual`, `company_intelligence_completed`, `browser_extension`, `infrastructure_panel`

## Runtime

| Component | Path |
|-----------|------|
| Queue | `lib/growth/buying-committee-intelligence/buying-committee-intelligence-queue.ts` |
| Stale recovery | `buying-committee-intelligence-stale-jobs.ts` (30m) |
| Cron | `POST /api/cron/growth-buying-committee-intelligence-worker` (`*/10`, max 2 jobs/run) |
| Chain trigger | After company intelligence job completes → enqueue buying committee (promote on complete) |

## APIs

- `POST /api/platform/growth/buying-committee-intelligence/jobs` — enqueue
- `GET/POST /api/platform/growth/browser-intake/buying-committee-intelligence` — extension visibility + enqueue
- Sync debug: `POST .../buying-committee-intelligence/run` (7.7A, infrastructure panel optional)

## Operator visibility

- `loadBuyingCommitteeIntelligenceOperatorStatus` — job state, `discovery_status`, `can_discover`, evidence run
- Infrastructure panel: queue by default, sync debug checkbox
- Browser extension CRM tab: buying committee intelligence row + queue button

## Call queue filters

`buying_committee_intelligence_filter`: `has_verified_committee`, `missing_verified_committee`, `discovery_pending`, `discovery_failed`

## Lead rollup

`loadBuyingCommitteeIntelligenceLeadRollup` — used by call queue filters

## Audit events

`buying_committee_intelligence_job_enqueued`, `_job_completed`, `_job_failed` via `logGrowthEngine`

## QA

- Marker: `growth-buying-committee-intelligence-runtime-7.7b-v1`
- Tests: `pnpm test:growth-buying-committee-intelligence-7.7b`

## Hard rules (unchanged from 7.7A)

No AI people, no blind title guessing, no paid enrichment, no intent/engagement scoring. Orchestrator unchanged; runtime only schedules bounded work.

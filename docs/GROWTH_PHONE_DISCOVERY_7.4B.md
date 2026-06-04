# Growth Engine Phase 7.4B — Phone Discovery Runtime Integration

Async runtime for canonical phone discovery (mirrors 7.3B email discovery runtime).

**Depends on:** Phase 7.4A (`phone_discovery_runs`, candidates, evidence, orchestrator).

## Safety (unchanged from 7.4A)

- No outbound dialing, SMS automation, or AI-generated phones
- No phone guessing or new paid providers
- Promotion only for `verified` + confidence ≥ 0.85
- No cross-person phone reassignment; one primary per person
- `person_company_roles` preflight on every run

## Runtime surface

| Piece | Path |
|-------|------|
| Job queue migration | `supabase/migrations/20270714120000_growth_engine_phone_discovery_jobs_7_4b.sql` |
| Queue + worker logic | `lib/growth/phone-discovery/phone-discovery-queue.ts` |
| Stale job recovery | `lib/growth/phone-discovery/phone-discovery-stale-jobs.ts` |
| Triggers | `lib/growth/phone-discovery/phone-discovery-triggers.ts` |
| Cron | `POST /api/cron/growth-phone-discovery-worker` (Vercel `*/10 * * * *`) |
| Enqueue API | `POST /api/platform/growth/phone-discovery/jobs` |
| Browser intake | `POST /api/platform/growth/browser-intake/phone-discovery` |
| Lead drawer status | `GET /api/platform/growth/leads/[leadId]/phone-discovery` |
| Call queue filter | `phone_discovery_filter` on `GET /api/platform/growth/call-queue` |

## Triggers

1. **Person persist** — after canonical person + `person_company_roles` (non-blocking enqueue).
2. **Company contact refresh** — capped batch per company after enrichment.
3. **Manual / infrastructure panel** — `trigger_source: infrastructure_panel`.
4. **Browser extension** — `trigger_source: browser_extension`.
5. **Lead drawer** — `GrowthPhoneDiscoveryOperatorCard` queues jobs.

## Idempotency

- Unique index: one active (`pending`/`running`) job per `company_id` + `person_id`.
- Skip enqueue when verified phone exists or active job exists.
- Stale `running` jobs (>30m) marked `failed` with `stale_running_job_recovered_v1`.

## Tests

```bash
pnpm test:growth-phone-discovery-7.4b
pnpm test:growth-phone-discovery-7.4a
```

QA marker: `growth-phone-discovery-runtime-7.4b-v1`

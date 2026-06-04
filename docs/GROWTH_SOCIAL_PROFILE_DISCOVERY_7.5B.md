# Growth Engine Phase 7.5B — Social Profile Discovery Runtime

Async job queue and operator surfaces for social profile discovery (foundation in 7.5A).

**Foundation:** See `docs/GROWTH_SOCIAL_PROFILE_DISCOVERY_7.5A.md`.

## Runtime components

| Component | Path |
|-----------|------|
| Jobs table | `growth.social_profile_discovery_jobs` |
| Queue | `lib/growth/social-profile-discovery/social-profile-discovery-queue.ts` |
| Stale recovery | `social-profile-discovery-stale-jobs.ts` |
| Cron | `growth-social-profile-discovery-worker` (`*/10 * * * *`, max 2 jobs/run) |
| Triggers | Person persist, company contact enrich (person batch + company job) |

## APIs

- `POST /api/platform/growth/social-profile-discovery/jobs`
- `GET/POST /api/platform/growth/browser-intake/social-profile-discovery`
- `GET /api/platform/growth/leads/[leadId]/social-profile-discovery`
- `GET /api/platform/growth/social-profile-discovery/operator-status` (job-aware)
- `POST /api/platform/growth/social-profile-discovery/run` (sync debug, unchanged)

## Operator surfaces

- `GrowthSocialProfileDiscoveryOperatorCard` — lead drawer + decision makers
- `GrowthSocialProfileDiscoveryPanel` — infrastructure (queue default, sync debug)
- Browser extension CRM tab — `social_profile_discovery_contacts`

## Call queue

`GET /api/platform/growth/call-queue?social_profile_discovery_filter=` — `has_verified_profile`, `missing_verified_profile`, `discovery_pending`, `discovery_failed`

## Audit events

`social_profile_discovery_job_enqueued`, `social_profile_discovery_job_completed`, `social_profile_discovery_job_failed`, plus existing `social_profile_discovery_run` events.

## 7.5A hardening (included)

- Company staging: `linkedin_company_url` read from `metadata` only (no invalid column select)
- Staging verification: `verified` requires `staging_trusted` + confidence ≥ 0.85

## Tests

- `pnpm test:growth-social-profile-discovery-7.5b`
- `pnpm test:growth-social-profile-discovery-7.5a`

QA: `growth-social-profile-discovery-runtime-7.5b-v1`

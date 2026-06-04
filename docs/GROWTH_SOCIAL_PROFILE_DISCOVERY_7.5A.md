# Growth Engine Phase 7.5A — Social Profile Discovery Foundation

Canonical-scoped social profile discovery: `growth.companies` + optional `growth.persons` → candidates → deterministic verification → optional `growth.person_profiles` / `growth.company_profiles` promotion.

**Runtime (7.5B):** Jobs queue, cron worker, browser extension intake, lead drawer hooks — not in 7.5A.

## Supported profile types

| Type | Person scope | Company scope |
|------|--------------|---------------|
| `linkedin_person` | Yes | No |
| `linkedin_company` | No | Yes |
| `twitter` | Yes | Yes |
| `facebook` | Yes | Yes |
| `instagram` | Yes | Yes |

## Sources (deterministic)

| Source | Module | Notes |
|--------|--------|-------|
| Website | `discoverWebsiteContacts` | Structured social links + company LinkedIn references; person name match |
| Staging | `company_contacts`, `contact_candidates`, `lead_decision_makers` | `canonical_person_id` / `canonical_company_id` linked rows |
| Canonical channel | `person_profiles`, `company_profiles` | Re-evaluate existing canonical rows |

No AI URL generation, no username guessing, no authenticated scraping, no paid enrichment.

## Verification states

| Status | Meaning |
|--------|---------|
| `verified` | Website social link or trusted staging at confidence ≥ 0.85 |
| `probable` | Canonical channel re-read or weaker website evidence |
| `unverified` | Valid normalized URL, insufficient subject proof |
| `invalid` | Normalization or key mismatch |

Provider: `growth_deterministic_social_profile_verify`.

## Promotion gates

- Person scope: `person_company_roles` required (`assertSocialProfileDiscoveryPreflight`)
- Company scope: `person_id` must be null
- `verification_status = verified`
- `confidence >= 0.85` (`GROWTH_SOCIAL_PROFILE_DISCOVERY_PROMOTION_MIN_CONFIDENCE`)
- No cross-owner `normalized_profile_key` reassignment
- Max `15` verification passes per run (`GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_VERIFY_PER_RUN`)

## Migration

`supabase/migrations/20270715120000_growth_engine_social_profile_discovery_7_5a.sql`

Tables: `social_profile_discovery_runs`, `social_profile_discovery_candidates`, `social_profile_discovery_evidence`, `company_profiles`.

Extends `person_profiles` with `verification_status` and expanded `profile_type` check.

## API

- `POST /api/platform/growth/social-profile-discovery/run` — `{ company_id, person_id?, discovery_scope?, promote? }`
- `GET /api/platform/growth/social-profile-discovery/runs/[runId]` — candidates + evidence
- `GET /api/platform/growth/social-profile-discovery/operator-status` — rollup (run-based, no job queue)

## Admin UI

- `GrowthSocialProfileDiscoveryPanel` on `/admin/growth/infrastructure` (sync run only)

## Tests

`pnpm test:growth-social-profile-discovery-7.5a`

QA marker: `growth-social-profile-discovery-7.5a-v1`

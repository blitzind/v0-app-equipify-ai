# Growth Engine Phase 7.4A — Phone Discovery

Canonical-scoped phone discovery: `growth.companies` + `growth.persons` → candidates → deterministic verification → optional `growth.person_phones` promotion.

**Runtime (7.4B):** See `docs/GROWTH_PHONE_DISCOVERY_7.4B.md` — `phone_discovery_jobs`, cron worker, browser extension, lead drawer, enrichment hooks.

## Sources (deterministic)

| Source | Module | Notes |
|--------|--------|-------|
| Website | `discoverWebsiteContacts` | Tel links, schema.org, contact/team pages; person name match |
| Staging | `company_contacts`, `contact_candidates`, `lead_decision_makers` | `canonical_person_id` linked rows; `full_name` for match |
| Canonical channel | `person_phones` | Re-evaluate existing canonical rows |
| PDL | `searchPdlPeopleByCompany` | Person name match; **probable** at best |

No pattern generation, no AI guessing, no new paid providers.

## Verification states

| Status | Meaning |
|--------|---------|
| `verified` | Website tel/schema + name match, or trusted staging/canonical row at confidence ≥ 0.85 |
| `probable` | PDL or website evidence below verified threshold |
| `unverified` | Valid format, weak person-company proof |
| `invalid` | Normalization or `verifyPhoneNumber` format failure |

Provider: `growth_deterministic_phone_verify` (`verifyPhoneDiscoveryDraft` → `verifyPhoneNumber`).

## Promotion gates

- `person_company_roles` row required (`assertPersonCompanyRoleForDiscovery`)
- `verification_status = verified`
- `confidence >= 0.85` (`GROWTH_PHONE_DISCOVERY_PROMOTION_MIN_CONFIDENCE`)
- No cross-person `normalized_phone` reassignment
- Verified row not overwritten by lower-confidence or non-verified candidate
- `promotion_history` appended in `person_phones.metadata`
- Max `20` verification passes per run (`GROWTH_PHONE_DISCOVERY_MAX_VERIFY_PER_RUN`)

## Migration

`supabase/migrations/20270713120000_growth_engine_phone_discovery_7_4a.sql`

Tables: `phone_discovery_runs`, `phone_discovery_candidates`, `phone_discovery_evidence`.

## API

- `POST /api/platform/growth/phone-discovery/run` — `{ company_id, person_id, promote? }`
- `GET /api/platform/growth/phone-discovery/runs/[runId]` — candidates + evidence
- `GET /api/platform/growth/phone-discovery/operator-status` — rollup for operator card

## Admin UI

- `GrowthPhoneDiscoveryPanel` on `/admin/growth/infrastructure` (sync run only)
- `GrowthPhoneDiscoveryOperatorCard` — Discover Phone / View Evidence (embed in 7.4B surfaces)

## Tests

`pnpm test:growth-phone-discovery-7.4a`

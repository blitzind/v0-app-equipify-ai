# Growth Engine Phase 7.3A — Email Discovery

Canonical-scoped email discovery: `growth.companies` + `growth.persons` → candidates → ZeroBounce → optional `growth.person_emails` promotion.

## Sources (deterministic)

| Source | Module | Notes |
|--------|--------|-------|
| Website | `discoverWebsiteContacts` | Person name match on extracted contacts |
| Staging | `company_contacts`, `contact_candidates`, `lead_decision_makers` | `canonical_person_id` linked rows only |
| Pattern | `generateWorkEmailPatterns` | Candidates only until verified |
| PDL | `searchPdlPeopleByCompany` | Company domain + name match |

## Promotion gates

- `person_company_roles` row required for company_id + person_id
- `verification_status = verified` (ZeroBounce `valid` → verified)
- `confidence >= 0.85` (`GROWTH_EMAIL_DISCOVERY_PROMOTION_MIN_CONFIDENCE`)
- No cross-person `normalized_email` ownership reassignment
- Single `is_primary` email per person after promotion
- Max `12` ZeroBounce calls per run (`GROWTH_EMAIL_DISCOVERY_MAX_VERIFY_PER_RUN`)

## Migration

`supabase/migrations/20270711120000_growth_engine_email_discovery_7_3a.sql`

## API

- `POST /api/platform/growth/email-discovery/run` — `{ company_id, person_id, promote?, require_production_safe_verification? }`
- `GET /api/platform/growth/email-discovery/runs/[runId]` — candidates + evidence rows

## Admin UI

`GrowthEmailDiscoveryPanel` on `/admin/growth/infrastructure`

## Tests

`pnpm test:growth-email-discovery-7.3a`

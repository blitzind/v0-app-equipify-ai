# Growth Engine Phase 7.2B — Canonical Person Layer

Additive canonical person foundation in the `growth` schema. Staging contact tables remain ingestion buffers; `growth.persons` is the system of record.

## What was added

| Artifact | Purpose |
|----------|---------|
| `growth.persons` | Canonical person SoR |
| `growth.person_emails` | Normalized email channels |
| `growth.person_phones` | Normalized phone channels |
| `growth.person_profiles` | LinkedIn and other profile URLs |
| `growth.person_company_roles` | Person ↔ `growth.companies` employment |
| `growth.person_source_lineage` | Source table/id, provider, discovery source |
| `growth.person_merge_events` | Survivor/merged lineage (future merges) |
| `canonical_person_id` on staging | Nullable FK on `contact_candidates`, `company_contacts`, `lead_decision_makers` |

| Module | Path |
|--------|------|
| Types | `lib/growth/canonical-persons/canonical-person-types.ts` |
| Normalize | `lib/growth/canonical-persons/canonical-person-normalize.ts` |
| Resolver | `lib/growth/canonical-persons/canonical-person-resolver.ts` |
| Repository (Next.js) | `lib/growth/canonical-persons/canonical-person-repository.ts` |
| Repository (CLI/core) | `lib/growth/canonical-persons/canonical-person-repository-core.ts` |
| Backfill | `lib/growth/canonical-persons/canonical-person-backfill.ts` |
| Completion | `lib/growth/canonical-persons/canonical-person-backfill-completion.ts` |
| Runtime API | `app/api/platform/growth/canonical-persons/backfill/route.ts` |
| API helpers | `lib/growth/canonical-persons/canonical-person-backfill-api.ts` |
| Script (CLI) | `scripts/backfill-growth-canonical-persons-7.2b.ts` |
| Admin UI | `components/growth/growth-canonical-person-backfill-panel.tsx` |

Migration: `supabase/migrations/20270709120000_growth_engine_canonical_persons_7_2b.sql`

## Resolver order (deterministic, no AI)

1. Normalized email (global)
2. Normalized LinkedIn profile key
3. Normalized phone (10-digit US-style)
4. Normalized name + `canonical_company_id` (requires company linkage)
5. Create new canonical person

Name-only and cross-company name matching are never used for automatic merges.

## Backfill sources (order)

1. `contact_candidates`
2. `company_contacts`
3. `lead_decision_makers`

## Certification

Same model as 7.2A:

- `pending_total === 0` across all three staging tables
- `verification.passed === true`
- `certification === "pass"` (or `conditional_pass` if errors occurred with zero pending)

## CLI

```bash
pnpm tsx scripts/backfill-growth-canonical-persons-7.2b.ts
GROWTH_CANONICAL_PERSON_APPLY_CONFIRM=yes pnpm tsx scripts/backfill-growth-canonical-persons-7.2b.ts --apply
```

## Tests

```bash
pnpm test:growth-canonical-persons-7.2b
```

## Out of scope (7.2B)

- Email / phone / LinkedIn discovery pipelines (7.3+)
- Mandatory person graph for existing ingestion paths
- BlitzPay, Stripe, billing, merchant onboarding

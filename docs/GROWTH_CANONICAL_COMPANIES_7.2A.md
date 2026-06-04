# Growth Engine Phase 7.2A — Canonical Company Layer

Additive canonical company foundation in the `growth` schema. Staging tables remain ingestion buffers; `growth.companies` is the system of record.

## What was added

| Artifact | Purpose |
|----------|---------|
| `growth.companies` | Canonical company SoR |
| `growth.company_domains` | Normalized + exact domain aliases (unique `normalized_domain`) |
| `growth.company_source_lineage` | Source table/id, provider, run, metadata |
| `growth.company_merge_events` | Survivor/merged lineage (future merges) |
| `canonical_company_id` on staging | Nullable FK on external/real_world/discovery candidates + `company_contacts` |

| Module | Path |
|--------|------|
| Types | `lib/growth/canonical-companies/canonical-company-types.ts` |
| Normalize | `lib/growth/canonical-companies/canonical-company-normalize.ts` |
| Resolver | `lib/growth/canonical-companies/canonical-company-resolver.ts` |
| Repository (Next.js) | `lib/growth/canonical-companies/canonical-company-repository.ts` (`server-only` re-export) |
| Repository (CLI/core) | `lib/growth/canonical-companies/canonical-company-repository-core.ts` |
| Production env | `lib/growth/canonical-companies/load-growth-production-supabase-env.ts` |
| Backfill | `lib/growth/canonical-companies/canonical-company-backfill.ts` |
| Runtime API | `app/api/platform/growth/canonical-companies/backfill/route.ts` |
| API helpers | `lib/growth/canonical-companies/canonical-company-backfill-api.ts` |
| Script (CLI) | `scripts/backfill-growth-canonical-companies-7.2a.ts` |

Migration: `supabase/migrations/20270708120000_growth_engine_canonical_companies_7_2a.sql`

## Resolver order (deterministic, no AI)

1. Normalized domain (`normalizeDomain` + website host)
2. Exact domain alias (`company_domains` / exact host)
3. Normalized company name + city (review-tier match)
4. Normalized company name + state (review-tier match)
5. Create new canonical company

Name-only keys never merge two companies that already have different domains.

## What remains legacy

- `external_company_candidates`, `real_world_company_candidates`, `discovery_candidates` unchanged except nullable `canonical_company_id`
- `company_contacts.company_id` still points at staging candidate UUIDs
- Prospect Search index not required to use canonical IDs (deferred)
- No person graph, email/phone discovery, or outbound changes

## Out of scope (7.2A)

- `growth.persons` / contact channels
- BlitzPay, Stripe, billing, `public.customer_contacts`, native dialer
- Prospect Search refactor
- Mandatory canonical ID on runtime discovery paths

## Production Runtime Execution

Preferred path: platform admin session against the deployed Growth Engine (uses deployment `SUPABASE_SERVICE_ROLE_KEY` — never returned in responses).

**Endpoint:** `POST /api/platform/growth/canonical-companies/backfill`

**Authorization:**

- Signed-in user email on `EQUIPIFY_PLATFORM_ADMIN_EMAILS`
- `GROWTH_ENGINE_ENABLED=true` on the deployment

**Dry run:**

```bash
curl -X POST "$ORIGIN/api/platform/growth/canonical-companies/backfill" \
  -H "Content-Type: application/json" \
  -H "Cookie: <platform-admin-session>" \
  -d '{"mode":"dry_run"}'
```

**Apply** (exact confirmation required):

```bash
curl -X POST "$ORIGIN/api/platform/growth/canonical-companies/backfill" \
  -H "Content-Type: application/json" \
  -H "Cookie: <platform-admin-session>" \
  -d '{"mode":"apply","confirm":"APPLY_GROWTH_CANONICAL_COMPANIES_7_2A"}'
```

**UI:** `/admin/growth/infrastructure` — Canonical companies (7.2A) panel (dry run / apply).

Schema pre-check returns `{ "ok": false, "reason": "schema_not_ready" }` with HTTP 503 when migration tables are missing.

## Production credentials (CLI fallback)

The backfill script does **not** read `.env.local`. Set in the shell:

```bash
export NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Or use non-empty values in `.env.production.local`, `.env.vercel.production`, or `.vercel/.env.production.local`. When `supabase/.temp/project-ref` exists, the URL must match that linked project (unless `--local`).

## Dry-run (default)

```bash
pnpm tsx scripts/backfill-growth-canonical-companies-7.2a.ts
```

Prints a safety banner (host, project ref, schema `growth`, mode) to stderr, then JSON stats: resolution counts, merge groups by domain, errors. **No writes.**

## Apply mode

1. Apply migration to target Supabase project.
2. Confirm dry-run output.
3. Run:

```bash
GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM=yes pnpm tsx scripts/backfill-growth-canonical-companies-7.2a.ts --apply
```

Idempotent via `company_source_lineage (source_table, source_id)` and `company_domains.normalized_domain`.

## Tests

```bash
pnpm test:growth-canonical-companies-7.2a
```

## Rollback

- Migration is additive; rollback = stop writing canonical rows and leave columns null.
- Do not drop staging tables.
- To remove canonical layer: drop FK columns and new tables only after confirming no dependents (7.2B+).

## CRM note

Backfill does **not** read `public.prospects` / `public.customers`. CRM overlap remains in Prospect Search only (7.1D boundary).

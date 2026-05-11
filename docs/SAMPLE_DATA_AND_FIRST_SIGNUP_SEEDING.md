# Sample data & first-signup seeding

This document describes how Equipify seeds **industry-aware demo data** during onboarding and how **Settings → Sample data** reuses the same engine.

## Entry points

| Path | Behavior |
|------|----------|
| **Onboarding** (`POST /api/onboarding/provision` with `seedDemo !== false`) | Service-role client runs `seedDemoForIndustry` once per org unless seed already succeeded with sample customers present. |
| **Settings → Sample data** (`POST /api/demo-data/import`) | Same `seedDemoForIndustry` with `import: true` — workspace must have **no non-sample customers** and **no sample rows** (run reset first). |

Orchestration: `lib/demo-seeding/seed-engine.ts`  
Implementation: `lib/demo-seeding/seed-demo-content.ts`  
Industry targets & helpers: `lib/demo-seeding/industry-sample-packs.ts`  
Profiles: `lib/demo-seeding/profiles.ts` (wraps `lib/workspace-industry-registry.ts`)  
Reset (sample-marked rows only): `lib/demo-data/reset-sample-data.ts`

## What gets seeded (by module)

All rows are **`organization_id` scoped** and use **`is_sample = true`** (or equivalent markers) where the table supports it.

| Module | Notes |
|--------|--------|
| **Customers & contacts** | `DEMO-Cxx` external codes; primary locations; optional parent/child rename using `demoCompanyName`. |
| **Equipment** | Categories/manufacturers from the industry profile; `location_label` from industry site labels. |
| **Work orders** | Mixed statuses for boards/schedules; repair log uses neutral demo copy. |
| **Maintenance plans** | From profile plan name examples. |
| **Calibration templates** | `getStarterTemplatesForIndustry` — all industries. |
| **Calibration records** | **Biomedical / rich profile only** (meaningful QA-shaped payloads). |
| **Technicians (auth + roster)** | Demo tech users + `technicians` rows; job titles from biomedical list or industry skill mix. |
| **Technician skill tags** | From profile specialties (`technician_skill_tags.is_sample = true`). **Requires migration** `20260812200001_technician_skill_tags_is_sample.sql`. |
| **Prospects** | Pipeline mix; clearly labeled sample leads. |
| **Vendors** | Biomedical uses OEM-style list; other industries use **generic regional distributors** labeled with the sector name. |
| **Catalog** | Biomedical keeps dense SKU list; others rotate **parts/services** from equipment examples + service categories. |
| **Quotes / invoices / POs** | Always seeded for **all** industries (volumes scale by `getSampleModuleTargets`). Line items and notes state **sample / demo**. |
| **Inventory** | `inventory_locations` with codes `EQ-DEMO-LOC-*` (plus legacy `PBS-SEED-*` for older biomedical runs); **on-hand stock** on main warehouse for a slice of catalog lines. |
| **Communications** | `communication_events` on customer timelines, `metadata.equipify_demo_seed: true` (and/or `pbs_demo_seed` legacy path in reset). |
| **AI Ops** | `ai_ops_recommendation_lifecycle` + `ai_ops_recommendation_events` with `recommendation_key` prefix **`demo_seed_`** so reset can delete them. |

### Settings → Equipment types

The **Equipment types** screen (`lib/equipment-type-store.tsx`) uses **in-browser preset types** for UI demos; it is **not** persisted per organization in Postgres today. Seeded **equipment `category`** values still reflect the industry registry for realistic lists.

## Industry mapping

- Canonical keys: `WORKSPACE_INDUSTRY_KEYS` in `lib/workspace-industry-registry.ts`.  
- Normalization & aliases: `normalizeIndustryKey` in `lib/demo-seeding/profiles.ts`.  
- Per-industry **customer names, equipment examples, WO titles, PM examples, skill tags**: `DEMO_INDUSTRY_PROFILES` (medical has a bespoke dense profile; others use registry-derived `starterProfileFromDefinition`).  
- **Financial / ops bundle sizes**: `getSampleModuleTargets(industry)` in `industry-sample-packs.ts` (biomedical = larger “rich” bundle).

## Idempotency

- **Onboarding**: If `demo_seed_status === succeeded` and sample customers exist → seed is **skipped**.  
- **Partial / failed runs**: Engine attempts `resetSampleDataForOrganization` then re-seeds.  
- **Settings import**: Requires **empty** workspace (no real customers; no leftover sample rows).  
- **Quotes**: `seed_key` column keeps duplicate imports predictable if extended in future.

## Reset behavior

`POST /api/demo-data/reset` with confirmation phrase **`REMOVE SAMPLE DATA`** (all caps, single space; shared constant `REMOVE_SAMPLE_DATA_CONFIRMATION_PHRASE` in `lib/demo-data/remove-sample-confirmation.ts`) deletes only:

- Rows with `is_sample = true` on applicable tables.  
- `inventory_locations` whose `code` matches **`PBS-SEED%`** or **`EQ-DEMO-LOC%`**.  
- `communication_events` with `pbs_demo_seed` / `equipify_demo_seed` in `metadata`, plus events tied to sample entity IDs.  
- `ai_ops_recommendation_events` and `ai_ops_recommendation_lifecycle` where `recommendation_key` **`like demo_seed%`**.  
- `technician_skill_tags` where **`is_sample = true`**.

Non-sample customers, billing, subscriptions, and workspace settings are **not** removed.

## Permissions

- **Import / reset**: `lib/demo-data/access.ts` — workspace **owner or admin** (platform admins when impersonating).  
- Seed runs with the **service role** client from Route Handlers so inserts succeed under RLS while still enforcing org scope in application logic.

## Supabase migrations

Apply new migrations locally / hosted:

```bash
cd equipify-app
npx supabase db push
```

**Required for skill-tag sample reset:** `supabase/migrations/20260812200001_technician_skill_tags_is_sample.sql`

## Manual QA (short)

1. New signup (any industry except skipping `seedDemo`) → dashboard shows customers, WOs, **quotes/invoices**, **catalog**, **inventory** locations with stock where applicable.  
2. **Communications** on a customer with a seeded WO → sample threads visible.  
3. **AI Ops** → sample recommendation cards present; reset removes them.  
4. **Settings → Sample data** → reset phrase, then import another industry → counts toast / network response includes new modules.  
5. Repeat onboarding seed path → **no duplicate** customers when status already succeeded.

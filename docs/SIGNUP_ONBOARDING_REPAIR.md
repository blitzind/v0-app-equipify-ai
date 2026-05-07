# Signup / Onboarding Provisioning Repair

Date: 2026-05-07

This document explains the fix for three intertwined onboarding bugs:

1. New signups failing with `created_by cannot be set without an authenticated user`.
2. Sample data appearing partially after a new account logged in.
3. Forms / templates not feeling industry-specific after onboarding.

## Root cause

`equipment` and `maintenance_plans` had `created_by` triggers that overwrote
`new.created_by := auth.uid()` and threw if the result was null. The
onboarding API runs sample-data seeding through the **service-role Supabase
client** (so it can write across many org-scoped tables), which has no
`auth.uid()` — so the first equipment insert always failed.

The same trigger pattern on `work_orders` was already patched in
`20260502130000_maintenance_automation.sql` to allow a service-role insert that
supplies `new.created_by` explicitly. The matching patches on `equipment` and
`maintenance_plans` were missing.

The user-visible cascade:

- Customers (no trigger) inserted successfully → ~25 sample customers in DB.
- Equipment insert → trigger threw → seed function rejected, route returned
  HTTP 400 with the trigger's raw message.
- On retry, the seed engine bailed out because customers already existed,
  leaving the workspace permanently in a half-seeded state.

Industry awareness was a separate gap: only the `medical_equipment` "rich"
branch seeded any calibration / inspection templates. Other industries got
the customer/equipment/work-order seed but no templates, so the workspace
felt generic.

## Fixes

### Migration `20260507130000_signup_provisioning_repair.sql`

- Patches `set_equipment_created_by` and `set_maintenance_plans_created_by`
  to mirror the work-orders pattern: prefer `auth.uid()`, fall back to the
  explicit `new.created_by` for service-role inserts, and only throw if both
  are null.
- Adds onboarding lifecycle metadata to `organizations`:
  - `industry text` — canonical workspace industry. Drives
    industry-aware defaults regardless of seed state.
  - `demo_seed_status text` — `pending | running | succeeded | failed`.
  - `demo_seed_started_at timestamptz`
  - `demo_seed_completed_at timestamptz`
  - `demo_seed_error text` — sanitized failure message from the most recent
    seed attempt (kept short, never the raw stack).
- Backfills `demo_seed_status = 'succeeded'` for organizations that already
  have sample customers, and copies `demo_seed_industry` into `industry`
  where present.

### Seed engine (`lib/demo-seeding/seed-engine.ts`)

- Persists the canonical industry to `organizations.industry` immediately at
  the start of the run, before any potentially-failing inserts. This means
  even a failed seed leaves the workspace correctly tagged for industry-aware
  defaults.
- Reads `demo_seed_status`:
  - `succeeded` → fast skip.
  - `failed`, stale `running` (>10 min), or any sample-customer rows from a
    previous partial run → call `resetSampleDataForOrganization` to wipe
    every `is_sample = true` row, then run a fresh seed. Idempotent and safe.
- Marks `running → succeeded` (or `failed`) around the actual seed call, with
  structured `console.info` / `console.error` events
  (`[demo-seed] seed_succeeded`, `[demo-seed] seed_failed`, etc.) including
  org id, industry, and counts.

### Industry-aware templates (`lib/demo-seeding/industry-templates.ts`)

- New foundation file mapping every supported industry key to a small set of
  starter calibration / inspection templates with realistic field shapes
  (sections, pass/fail items, numbers, notes). Adding a new industry or
  expanding an existing template only requires editing this file.
- The seed-content engine now seeds these templates for **every** industry
  (previously only `medical_equipment`). Calibration *records* still only
  seed for the rich biomedical path — non-medical industries still get
  authoring-ready templates without misleading auto-filled values.

### API route (`app/api/onboarding/provision/route.ts`)

- All errors are routed through `lib/onboarding/error-mapping.ts` which:
  - Logs the raw error server-side with structured fields
    (`[onboarding/provision] seed_failed`, etc.).
  - Returns a sanitized, polished message to the client. Raw DB strings such
    as `created_by cannot be set without an authenticated user`,
    `permission denied for table …`, or `relation … does not exist` are
    converted to friendly text.
- The canonical industry is now persisted to `organizations.industry` as
  soon as the org exists, even before the demo seed begins. This means
  industry-aware defaults still apply if seeding is skipped or fails.
- The seeder is invoked with the service-role client (unchanged), but is now
  safe under the patched triggers and is fully idempotent.

## Selected industry storage

| Column                              | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `organizations.industry`            | Canonical industry for the workspace. Set during onboarding, mutable later. |
| `organizations.demo_seed_industry`  | Industry the most recent demo seed bundle was generated for.             |

Both columns are `text` (no enum constraint) so the front-end can keep
`lib/demo-seeding/profiles.ts` as the single source of truth for valid keys.

## Idempotency model

Onboarding is treated as a state machine on `demo_seed_status`:

- `pending` → eligible for fresh seed.
- `running` → another worker is seeding; if older than 10 minutes, treat as
  stale and recover.
- `succeeded` → skip.
- `failed` → reset sample rows, re-run.

Because `resetSampleDataForOrganization` only deletes `is_sample = true`
rows, real customer data added in between attempts is never touched. Auth
users created for sample technicians are reused on subsequent runs via email
lookup in `seedTechnicianAuthMembers`, so there are no orphaned identities.

## Verifying with a brand-new user

1. Wipe local Supabase state if testing locally:
   ```bash
   npx supabase db reset
   ```
2. Start the dev server (`pnpm dev`) and visit
   `http://localhost:3000/signup`.
3. Complete the three onboarding steps — choose an industry that is **not**
   `medical_equipment` (e.g. HVAC-R) so you can see the new template
   foundation in action.
4. After landing in the dashboard, verify:
   - `Customers`, `Equipment`, `Work Orders`, `Maintenance Plans` are all
     populated with the chosen industry's profile.
   - `Settings → Forms / Templates` shows the industry's starter calibration
     templates.
   - `organizations.industry` is set to the chosen industry (DB inspection
     or via the admin context).
5. To test idempotency, simulate a partial failure by deleting some sample
   rows manually and replaying onboarding — the seed engine cleans up via
   `resetSampleDataForOrganization` before re-running.
6. To verify the trigger patch is live, run as a service-role client:
   ```sql
   insert into equipment (organization_id, customer_id, name, equipment_code, created_by, is_sample)
   values ('<org-uuid>', '<customer-uuid>', 'Trigger Sanity Test', 'TST-1', '<user-uuid>', true);
   ```
   The insert should succeed when called from the service role while still
   throwing when neither `auth.uid()` nor `new.created_by` is provided.

## Files changed

- `supabase/migrations/20260507130000_signup_provisioning_repair.sql` (new)
- `lib/demo-seeding/seed-engine.ts`
- `lib/demo-seeding/seed-demo-content.ts`
- `lib/demo-seeding/industry-templates.ts` (new)
- `lib/onboarding/error-mapping.ts` (new)
- `app/api/onboarding/provision/route.ts`
- `docs/SIGNUP_ONBOARDING_REPAIR.md` (this file)

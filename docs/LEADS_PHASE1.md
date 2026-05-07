# Leads + Follow-Up — Phase 1

Lightweight Prospects/Leads pipeline so service companies can track inbound
opportunities, follow up consistently, and convert good prospects into
customers without spinning up a separate CRM. Strictly additive — no
existing schema, RLS, customer logic, or communications systems were
rewritten.

## Goals

1. Capture inbound opportunities (company, contact, source, value).
2. Move them through a clear pipeline (`new → contacted → follow_up → quoted → won/lost`).
3. Make overdue / today / upcoming follow-ups visible at a glance.
4. Convert won prospects into customers using the existing Customers
   architecture, while preserving pre-conversion history.
5. Log follow-up touches through the existing `communication_events`
   logger so they show up on the future timeline.
6. Lay groundwork for Growth tools (campaigns, reviews, referrals,
   automations, AI follow-up suggestions).

## Files added

| Path | Purpose |
|---|---|
| `supabase/migrations/20260730120000_prospects_phase1.sql` | New `prospects` table, indexes, RLS, triggers; widens `communication_events.related_entity_type_check` to include `'prospect'`. |
| `lib/prospects/types.ts` | Status + bucket + row types shared by API and UI. |
| `lib/prospects/format.ts` | Pure formatting + bucket helpers (no React/Supabase). |
| `lib/prospects/server-helpers.ts` | Server-only validators (`optionalString`, `parseOptionalIso`, `parseOptionalCents`) + `PROSPECT_SELECT_COLUMNS`. |
| `app/api/organizations/[organizationId]/prospects/route.ts` | `GET` list (member-gated) and `POST` create (`canManageProspects`). |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/route.ts` | `PATCH` partial update + `DELETE` archive (`canManageProspects`). |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/follow-up/route.ts` | `POST` follow-up — writes a `communication_events` row + bumps `last_contacted_at` / `next_follow_up_at` / status. |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/convert/route.ts` | `POST` convert — runs the standard plan/billing gate, inserts customer + primary contact, stamps `converted_customer_id` / `converted_at`, sets prospect status to `won`, logs a customer-timeline event. |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/timeline/route.ts` | `GET` read-only timeline (member-gated). |
| `app/(dashboard)/prospects/page.tsx` | Prospects list page with KPI strip, status / follow-up / archive filters, table, and drawer. |
| `components/prospects/prospect-form-dialog.tsx` | Create/edit dialog. |
| `components/prospects/log-follow-up-dialog.tsx` | Log a follow-up touch via the existing communications logger. |
| `components/prospects/convert-prospect-dialog.tsx` | Convert prospect → customer confirmation dialog. |
| `components/prospects/prospect-drawer.tsx` | Detail drawer (overview, contact, notes, timeline, actions). |

## Files modified

| Path | Change |
|---|---|
| `lib/permissions/model.ts` | New `canManageProspects` capability granted to owner/admin/manager only. |
| `lib/permissions/capabilities.ts` | New `prospects` surface + metadata for `canManageProspects`. |
| `lib/notifications/types.ts` | `RelatedEntityType` extended with `'prospect'`. |
| `components/app-sidebar.tsx` | Replaced the "Prospects" coming-soon placeholder with the live `/prospects` route. |
| `lib/admin/master-context.generated.ts` | Auto-regenerated to include the new routes + migration. |

## Migration

`supabase/migrations/20260730120000_prospects_phase1.sql`

- `create table if not exists public.prospects` — additive, all-`if-not-exists`.
- Re-uses existing `set_updated_at` and `prevent_organization_id_change`
  helpers (no duplicate functions).
- RLS enabled with the same `is_org_member` / `has_org_role` patterns used
  by `customers` so policies and the new server-side `requireOrgPermission`
  guards are double layered.
- `communication_events_related_entity_type_check` is dropped and recreated
  with `'prospect'` added — guarded by `do $$` block so it's idempotent.
- No existing rows are touched; downgrade is `drop table public.prospects`
  + recreate the original constraint.

## Architectural decisions

1. **Separate `prospects` table, not a `kind` column on `customers`.**
   - Keeps the customers table clean for billing, QuickBooks sync, and
     hierarchy logic (none of which should care about leads).
   - Lets us preserve full pre-conversion history alongside the customer.
   - Avoids RLS regressions on the heavily-policied `customers` table.

2. **Conversion uses the existing customers + customer_contacts insert
   path on the server** rather than reimplementing it. The plan/billing
   gate (`requireCanCreateRecord(..., "customer")`) is invoked the same
   way `AddCustomerModal` does it client-side, so plan limits stay
   consistent. The prospect is stamped with `converted_customer_id` /
   `converted_at` and its status is set to `won` — pre-conversion notes,
   pipeline history, and the follow-up timeline remain intact.

3. **Follow-ups reuse `communication_events` (not a new `prospect_notes`
   table).** This is the same logger used by work order, quote, and
   invoice email surfaces, so the future Communications timeline picks
   prospect events up for free. We extended the
   `related_entity_type_check` with `'prospect'` so deep-linking works
   without storing IDs only in `metadata`.

4. **Permissions are conservative.** New capability `canManageProspects`
   is granted to owner/admin/manager; techs/viewers cannot mutate the
   pipeline. Read access matches RLS (org membership) so the entire team
   can see the funnel read-only — useful for ops syncs.

5. **Page mounted at `/prospects`** (top-level under "Contacts" group), not
   `/customers/prospects`. The sidebar already had a "Prospects" placeholder
   in that group, and a sibling page keeps the customers route surface
   stable. Customer detail and prospect detail stay as separate concerns —
   a converted prospect's drawer links over to `/customers/[id]`.

6. **Follow-up bucketing is computed client-side** from `next_follow_up_at`
   so the dashboard counts respect each user's local "end of day". The
   list endpoint exposes a server-side filter parameter for status; bucket
   filtering happens in the table because it's purely a UI concern.

7. **Soft-archive over hard-delete.** `DELETE` stamps `archived_at` so the
   pipeline stays auditable and a converted prospect's history can never
   silently disappear.

## Permission summary

| Role     | View prospects | Create / edit / log follow-up | Convert to customer | Archive |
|----------|----------------|-------------------------------|---------------------|---------|
| owner    | ✅             | ✅                            | ✅                  | ✅      |
| admin    | ✅             | ✅                            | ✅                  | ✅      |
| manager  | ✅             | ✅                            | ✅                  | ✅      |
| tech     | ✅ (read-only) | ❌                            | ❌                  | ❌      |
| viewer   | ✅ (read-only) | ❌                            | ❌                  | ❌      |

UI gates:

- `RestrictedNotice` with `capability="canManageProspects"` is shown to
  read-only viewers above the table.
- `New prospect`, `Log follow-up`, `Edit`, `Convert`, and `Archive`
  buttons are hidden when `canManage === false`.
- All mutating API routes use `requireOrgPermission("canManageProspects")`
  so client-side gating cannot be bypassed.

## Verification

- `pnpm build` ✅
- `pnpm update:master-context` ✅ (`139 API routes, 100 migrations`)
- `ReadLints` on every touched file → no errors

Manual smoke test:

1. Visit `/prospects` as an owner/admin/manager.
2. Create a prospect — appears in the table; KPI counts update.
3. Click row → drawer opens.
4. `Log follow-up` (channel = Note) → timeline updates, `last_contacted_at`
   bumps, status auto-advances `new → contacted` on first touch.
5. `Convert to customer` → customer is created, prospect is stamped
   `converted` + status `won`, drawer shows link to the customer.
6. Switch list filter to `Archived` → soft-archived prospects appear.
7. Switch user to a `tech` role → prospects link is still visible,
   restricted notice shows, table is read-only.

## TODOs / Future Growth roadmap hooks

- **Bulk import**: spreadsheet/CSV upload for legacy lead lists
  (re-use existing import center patterns under `/settings/imports`).
- **Campaigns**: scheduled outreach driving multiple `communication_events`
  per prospect; the new `'prospect'` relation type makes this drop-in.
- **Reviews & referrals**: post-conversion review/referral asks logged on
  the converted customer's timeline (already supported via
  `related_entity_type='customer'`).
- **AI follow-up suggestions**: feed `prospects` rows into the existing
  `lib/ai/operational-assistants` registry; "next best follow-up" can
  reuse `communication_events` as context.
- **Workflow automations**: hook the Phase-2 automation engine to changes
  in `prospects.status` to trigger templated emails/SMS.
- **Prospect detail page** (`/prospects/[id]`) for permalinkable URLs and
  deeper Growth tooling — the drawer is enough for Phase 1.
- **Lead source taxonomy / tags**: replace free-text `lead_source` with
  managed dropdowns once we know the most common values.
- **Quote linkage**: when a prospect is sent a quote, optionally pre-fill
  the quote with prospect contact info; mark prospect status `quoted`
  automatically.

## Deploy notes

- Apply `supabase/migrations/20260730120000_prospects_phase1.sql` against
  the production database. The migration is fully idempotent (every DDL
  is `if not exists` / `drop if exists` + recreate inside `do $$`), so
  it's safe to re-run.
- No env vars or feature flags required.
- No QuickBooks or portal route changes — those continue to behave
  exactly as before.

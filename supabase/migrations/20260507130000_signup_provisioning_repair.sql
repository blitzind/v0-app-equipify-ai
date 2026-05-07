-- Signup / onboarding provisioning repair.
--
-- Background:
--   The seed engine (`lib/demo-seeding/seed-engine.ts`) is invoked from the
--   onboarding API using a service-role Supabase client so it can write across
--   tables that have org-scoped RLS. Service-role JWTs do not have a user, so
--   `auth.uid()` returns NULL inside trigger functions.
--
--   `set_work_orders_created_by` was already patched in
--   `20260502130000_maintenance_automation.sql` to allow service-role inserts
--   that supply `new.created_by` explicitly. The matching triggers on
--   `equipment` and `maintenance_plans` were never patched, so onboarding
--   failed at the first equipment insert with:
--     `created_by cannot be set without an authenticated user`
--
--   This migration aligns those two trigger functions with the work-orders
--   pattern, and adds a small set of provisioning-state columns on
--   organizations so onboarding can detect partial failures and resume safely.
--
-- All operations are idempotent.

-- -----------------------------------------------------------------------------
-- 1. set_equipment_created_by — allow explicit created_by for service-role inserts
-- -----------------------------------------------------------------------------
create or replace function public.set_equipment_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is not null then
      -- Service-role / automation inserts (e.g. onboarding sample seeding)
      -- supply the workspace owner's user id explicitly.
      null;
    else
      raise exception 'created_by cannot be determined';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable once created';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.set_equipment_created_by() from public, anon, authenticated;
alter function public.set_equipment_created_by() owner to postgres;

-- -----------------------------------------------------------------------------
-- 2. set_maintenance_plans_created_by — same treatment as work_orders/equipment
-- -----------------------------------------------------------------------------
create or replace function public.set_maintenance_plans_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is not null then
      null;
    else
      raise exception 'created_by cannot be determined';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable once created';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.set_maintenance_plans_created_by() from public, anon, authenticated;
alter function public.set_maintenance_plans_created_by() owner to postgres;

-- -----------------------------------------------------------------------------
-- 3. organizations: canonical industry + onboarding provisioning state.
--
--    `industry`               — canonical workspace industry (used by
--                               industry-aware defaults, even if seeding fails).
--    `demo_seed_status`       — one of: pending | running | succeeded | failed.
--    `demo_seed_completed_at` — when the most recent seed finished.
--    `demo_seed_started_at`   — when the most recent seed began.
--    `demo_seed_error`        — sanitized error from the most recent failed seed.
--
--    `demo_seed_industry` (already exists) keeps tracking the industry the seed
--    bundle was generated for; `industry` is the canonical workspace industry.
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists industry text,
  add column if not exists demo_seed_status text not null default 'pending'
    check (demo_seed_status in ('pending', 'running', 'succeeded', 'failed')),
  add column if not exists demo_seed_started_at timestamptz,
  add column if not exists demo_seed_completed_at timestamptz,
  add column if not exists demo_seed_error text;

comment on column public.organizations.industry is
  'Canonical workspace industry (lib/demo-seeding/profiles). Drives industry-aware defaults.';
comment on column public.organizations.demo_seed_status is
  'Onboarding seed lifecycle: pending | running | succeeded | failed.';
comment on column public.organizations.demo_seed_started_at is
  'Most recent demo seed start time (used to recover stale runs).';
comment on column public.organizations.demo_seed_completed_at is
  'Most recent demo seed completion time (succeeded only).';
comment on column public.organizations.demo_seed_error is
  'Sanitized error message captured on most recent failed demo seed run.';

create index if not exists idx_organizations_demo_seed_status
  on public.organizations (demo_seed_status)
  where demo_seed_status in ('running', 'failed');

-- -----------------------------------------------------------------------------
-- 4. Backfill: organizations that already have sample data succeed; others stay pending.
-- -----------------------------------------------------------------------------
update public.organizations o
set
  demo_seed_status = 'succeeded',
  demo_seed_completed_at = coalesce(o.demo_seed_completed_at, o.updated_at, now()),
  industry = coalesce(o.industry, o.demo_seed_industry)
where o.demo_seed_status = 'pending'
  and exists (
    select 1 from public.customers c
    where c.organization_id = o.id
      and c.is_sample = true
  );

update public.organizations o
set industry = coalesce(o.industry, o.demo_seed_industry)
where o.industry is null
  and o.demo_seed_industry is not null;

-- -----------------------------------------------------------------------------
-- 5. RLS: industry/demo_seed_* columns inherit the existing organization policies
--    (no separate policy is needed). Update-side checks are already enforced by
--    the org_admin policy in `20260501125600_multi_tenant_foundation.sql`.
-- -----------------------------------------------------------------------------

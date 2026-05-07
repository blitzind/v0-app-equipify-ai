-- Customer Hierarchy + Billing/Service Address — Phase 1
--
-- Goal: support real commercial service accounts with parent/child structure
-- (e.g. "Acme Hospital System" → 12 sub-locations) and clarify billing vs.
-- service addresses for invoicing.
--
-- Strict rules:
-- - Additive only. No existing column is altered, no behavior is changed for
--   existing rows. All new columns are nullable / safely defaulted.
-- - QuickBooks compatibility preserved. Sync paths read existing fields; new
--   billing fields are read-only at first.
-- - RLS unchanged. New columns inherit existing policies (`is_org_member`,
--   `has_org_role`).
-- - Same-org guarantee for parent links: enforced by a composite foreign key
--   `(organization_id, parent_customer_id)` -> `customers (organization_id, id)`
--   (matches the same-org pattern already used for customer_contacts and
--   customer_locations).
-- - Self-reference forbidden by a check constraint.
-- - Multi-level cycles forbidden by a `before insert/update` trigger that
--   walks the parent chain (depth-limited to 6 hops — operational accounts
--   never need deeper hierarchy than that).

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid,text[])';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Parent / child relationship (single-link adjacency model)
-- -----------------------------------------------------------------------------

alter table public.customers
  add column if not exists parent_customer_id uuid;

-- Same-org composite FK. We reference (organization_id, id) and add ON DELETE
-- SET NULL so that deleting a parent customer (rare, RLS-gated) leaves child
-- rows intact and merely orphaned, matching how `archived_at` is normally used.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_parent_same_org_fkey'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_parent_same_org_fkey
      foreign key (organization_id, parent_customer_id)
      references public.customers (organization_id, id)
      on delete set null;
  end if;
end;
$$;

-- Self-reference is invalid.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_parent_not_self_chk'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_parent_not_self_chk
      check (parent_customer_id is null or parent_customer_id <> id);
  end if;
end;
$$;

create index if not exists idx_customers_parent
  on public.customers (organization_id, parent_customer_id)
  where parent_customer_id is not null;

comment on column public.customers.parent_customer_id is
  'Phase 1 hierarchy: optional parent customer in the same organization. Use for parent/child accounts (e.g. parent organization with many service locations). Same-org enforced via composite FK to (organization_id, id).';

-- -----------------------------------------------------------------------------
-- 2. Cycle guard (depth-limited)
-- -----------------------------------------------------------------------------

create or replace function public.customers_prevent_parent_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  cur uuid := new.parent_customer_id;
  hops int := 0;
begin
  if new.parent_customer_id is null then
    return new;
  end if;

  while cur is not null and hops < 6 loop
    if cur = new.id then
      raise exception 'Customer hierarchy cycle detected (parent chain leads back to %).', new.id
        using errcode = '23514';
    end if;
    select parent_customer_id into cur
      from public.customers
      where id = cur and organization_id = new.organization_id;
    hops := hops + 1;
  end loop;

  if hops >= 6 then
    raise exception 'Customer hierarchy depth limit exceeded (max 6 levels).'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.customers_prevent_parent_cycle() from public, anon, authenticated;
alter function public.customers_prevent_parent_cycle() owner to postgres;

drop trigger if exists trg_customers_prevent_parent_cycle on public.customers;
create trigger trg_customers_prevent_parent_cycle
before insert or update of parent_customer_id on public.customers
for each row execute function public.customers_prevent_parent_cycle();

-- -----------------------------------------------------------------------------
-- 3. Billing address fields
-- -----------------------------------------------------------------------------
--
-- We store billing address inline on the customer record (not as a separate
-- customer_locations row) because:
--   * billing addresses are typically singular per customer for AR/AP and
--     QuickBooks bill-to mapping;
--   * existing customer_locations rows always represent service/site addresses
--     in this codebase — adding a "kind" column there would force a much
--     larger migration and break consumers (work orders, equipment, dispatch).
--
-- When `billing_address_same_as_service` is true (default), invoices fall back
-- to the customer's default `customer_locations` row. When false, the
-- `billing_*` columns are the source of truth. This default keeps existing
-- billing flows identical for legacy rows that have no billing data.

alter table public.customers
  add column if not exists billing_address_same_as_service boolean not null default true,
  add column if not exists billing_attention text,
  add column if not exists billing_email citext,
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_notes text;

comment on column public.customers.billing_address_same_as_service is
  'When true (default), invoices/POs fall back to the customer''s default service location for the bill-to address. Set false to enable an explicit billing address.';
comment on column public.customers.billing_attention is
  'Optional "Attn:" line for billing (e.g. "Accounts Payable").';
comment on column public.customers.billing_email is
  'Optional billing recipient email (separate from primary contact).';

-- -----------------------------------------------------------------------------
-- 4. Read-only convenience view: hierarchy roll-up counts
-- -----------------------------------------------------------------------------
--
-- Operational helper for surfacing parent/child counts in the customer drawer
-- and detail page without forcing each consumer to write the same aggregate
-- query. RLS is enforced naturally because the view selects from
-- `public.customers` and the caller's session inherits its row-level filters.

-- NOTE: `customer_locations.is_archived` was retired by
-- `20260609140000_archive_timestamp_only.sql` (and re-asserted by
-- `20260610150000_customer_locations_archive_columns_ensure.sql`). The
-- timestamp column `archived_at` is now the canonical archive indicator —
-- consistent with how the app already filters customer_locations everywhere
-- (`.is("archived_at", null)`).
create or replace view public.customer_hierarchy_summary as
select
  c.organization_id,
  c.id as customer_id,
  c.parent_customer_id,
  (select count(*)::int from public.customers ch
     where ch.organization_id = c.organization_id
       and ch.parent_customer_id = c.id
       and ch.archived_at is null) as child_count,
  (select count(*)::int from public.customer_locations cl
     where cl.organization_id = c.organization_id
       and cl.customer_id = c.id
       and cl.archived_at is null) as location_count
from public.customers c;

revoke all on public.customer_hierarchy_summary from public, anon;
grant select on public.customer_hierarchy_summary to authenticated;

comment on view public.customer_hierarchy_summary is
  'Phase 1 hierarchy roll-up: per-customer child_count and location_count. Read-only convenience for drawer/detail UI; RLS inherited from public.customers.';

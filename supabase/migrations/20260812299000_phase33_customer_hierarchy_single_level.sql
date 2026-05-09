-- Phase 33 — Enforce single-level parent/child customer hierarchy (product scope).
--
-- Rules:
--   - A sub-account may only link to a *root* parent (parent.parent_customer_id is null).
--   - An account that already has active sub-accounts cannot become a sub-account.
--   - Existing multi-level rows (if any) are untouched until edited; this only guards writes.
--
-- Composes with customers_prevent_parent_cycle() (cycle + depth guard).

create or replace function public.customers_enforce_single_level_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  parent_parent uuid;
begin
  if new.parent_customer_id is null then
    return new;
  end if;

  select c.parent_customer_id into parent_parent
  from public.customers c
  where c.organization_id = new.organization_id
    and c.id = new.parent_customer_id;

  if parent_parent is not null then
    raise exception 'Sub-accounts can only link to a root parent account (single-level hierarchy).'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.customers ch
    where ch.organization_id = new.organization_id
      and ch.parent_customer_id = new.id
      and ch.archived_at is null
  ) then
    raise exception 'Remove or reassign sub-accounts before linking this account under a parent.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.customers_enforce_single_level_hierarchy() from public, anon, authenticated;
alter function public.customers_enforce_single_level_hierarchy() owner to postgres;

drop trigger if exists trg_customers_enforce_single_level_hierarchy on public.customers;
create trigger trg_customers_enforce_single_level_hierarchy
before insert or update of parent_customer_id on public.customers
for each row execute function public.customers_enforce_single_level_hierarchy();

comment on function public.customers_enforce_single_level_hierarchy() is
  'Phase 33: product hierarchy is one level (root parent → sub-accounts only).';

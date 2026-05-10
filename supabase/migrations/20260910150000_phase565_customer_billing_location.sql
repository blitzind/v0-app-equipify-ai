-- Phase 56.5 — Optional bill-to linkage to a specific customer_locations row.
--
-- When billing_address_same_as_service is true and billing_location_id is set,
-- invoices use that location for bill-to street/city/state/postal. When null,
-- behavior matches Phase 1 (default / primary service location).
--
-- Additive only; existing rows keep billing_location_id NULL.

alter table public.customers
  add column if not exists billing_location_id uuid null
    references public.customer_locations (id)
    on delete set null;

create index if not exists customers_billing_location_id_idx
  on public.customers (billing_location_id)
  where billing_location_id is not null;

comment on column public.customers.billing_location_id is
  'When billing_address_same_as_service is true, bill-to street address comes from this customer_locations row when set; otherwise from the default service location. Ignored when billing_address_same_as_service is false.';

-- Enforce same org, same customer, and non-archived location (no cross-tenant or cross-customer refs).
create or replace function public.customers_enforce_billing_location_scope()
returns trigger
language plpgsql
as $$
begin
  if new.billing_location_id is null then
    return new;
  end if;
  if exists (
    select 1
    from public.customer_locations cl
    where cl.id = new.billing_location_id
      and cl.organization_id = new.organization_id
      and cl.customer_id = new.id
      and cl.archived_at is null
  ) then
    return new;
  end if;
  raise exception 'billing_location_id must reference an active customer_locations row for this customer'
    using errcode = '23514';
end;
$$;

alter function public.customers_enforce_billing_location_scope() owner to postgres;
revoke all on function public.customers_enforce_billing_location_scope() from public, anon, authenticated;

drop trigger if exists trg_customers_enforce_billing_location on public.customers;
create trigger trg_customers_enforce_billing_location
before insert or update of billing_location_id, organization_id, id
on public.customers
for each row
execute function public.customers_enforce_billing_location_scope();

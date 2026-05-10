-- Phase 41 — Service contracts & SLA targets (org-scoped, RLS).

create table if not exists public.org_service_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  customer_location_id uuid references public.customer_locations (id) on delete set null,
  equipment_id uuid references public.equipment (id) on delete set null,
  contract_name text not null check (char_length(trim(contract_name)) > 0),
  contract_number text,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'expired', 'cancelled')),
  coverage_type text not null default 'full_service'
    check (
      coverage_type in (
        'full_service',
        'labor_only',
        'parts_and_labor',
        'inspection_only',
        'emergency',
        'pm_only',
        'other'
      )
    ),
  sla_response_hours integer
    check (sla_response_hours is null or sla_response_hours > 0),
  sla_resolution_hours integer
    check (sla_resolution_hours is null or sla_resolution_hours > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_service_contracts_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade,
  constraint org_service_contracts_date_order check (end_date >= start_date)
);

create index if not exists idx_org_service_contracts_org_customer
  on public.org_service_contracts (organization_id, customer_id);

create index if not exists idx_org_service_contracts_org_status
  on public.org_service_contracts (organization_id, status);

create index if not exists idx_org_service_contracts_org_dates
  on public.org_service_contracts (organization_id, start_date, end_date);

comment on table public.org_service_contracts is
  'Operational service contracts with optional site/equipment scope and SLA hour targets.';

alter table public.org_service_contracts enable row level security;
alter table public.org_service_contracts force row level security;

revoke all on table public.org_service_contracts from public, anon;

grant select, insert, update, delete on table public.org_service_contracts to authenticated;
grant select, insert, update, delete on table public.org_service_contracts to service_role;

drop policy if exists "org_service_contracts_select_member" on public.org_service_contracts;
create policy "org_service_contracts_select_member"
on public.org_service_contracts
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "org_service_contracts_write_dispatch" on public.org_service_contracts;
create policy "org_service_contracts_write_dispatch"
on public.org_service_contracts
for all
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_service_contracts_set_updated_at on public.org_service_contracts;
    create trigger trg_org_service_contracts_set_updated_at
    before update on public.org_service_contracts
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

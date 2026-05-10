-- Phase 43 — Equipment warranty lifecycle records (org-scoped, RLS).

create table if not exists public.org_equipment_warranties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  equipment_id uuid not null,
  warranty_provider text not null check (char_length(trim(warranty_provider)) > 0),
  start_date date,
  end_date date not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'void')),
  coverage_summary text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_equipment_warranties_equipment_fkey
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id)
    on delete cascade,
  constraint org_equipment_warranties_date_order check (start_date is null or end_date >= start_date)
);

create index if not exists idx_org_equipment_warranties_org_equipment
  on public.org_equipment_warranties (organization_id, equipment_id);

create index if not exists idx_org_equipment_warranties_org_status
  on public.org_equipment_warranties (organization_id, status);

create index if not exists idx_org_equipment_warranties_org_end_date
  on public.org_equipment_warranties (organization_id, end_date);

comment on table public.org_equipment_warranties is
  'Operational manufacturer or third-party warranty coverage windows per asset; complements equipment-level warranty date fields.';

alter table public.org_equipment_warranties enable row level security;
alter table public.org_equipment_warranties force row level security;

revoke all on table public.org_equipment_warranties from public, anon;

grant select, insert, update, delete on table public.org_equipment_warranties to authenticated;
grant select, insert, update, delete on table public.org_equipment_warranties to service_role;

drop policy if exists "org_equipment_warranties_select_member" on public.org_equipment_warranties;
create policy "org_equipment_warranties_select_member"
on public.org_equipment_warranties
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "org_equipment_warranties_write_dispatch" on public.org_equipment_warranties;
create policy "org_equipment_warranties_write_dispatch"
on public.org_equipment_warranties
for all
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_equipment_warranties_set_updated_at on public.org_equipment_warranties;
    create trigger trg_org_equipment_warranties_set_updated_at
    before update on public.org_equipment_warranties
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

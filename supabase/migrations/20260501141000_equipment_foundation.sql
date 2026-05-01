-- Equipment/assets foundation (tenant-scoped)
-- Creates public.equipment with composite tenant FK to customers and RLS.

do $$
begin
  if to_regclass('public.customers') is null then
    raise exception 'Missing dependency: table public.customers must exist before this migration.';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.contype in ('p', 'u')
      and array_position(c.conkey, (select attnum from pg_attribute where attrelid = t.oid and attname = 'organization_id' and not attisdropped)) is not null
      and array_position(c.conkey, (select attnum from pg_attribute where attrelid = t.oid and attname = 'id' and not attisdropped)) is not null
  ) then
    raise exception 'Missing dependency: public.customers must have a primary/unique composite key including (organization_id, id).';
  end if;

  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: function public.is_org_member(uuid) must exist before this migration.';
  end if;

  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: function public.has_org_role(uuid,text[]) must exist before this migration.';
  end if;
end;
$$;

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  equipment_code text,
  name text not null check (char_length(trim(name)) > 0),
  manufacturer text,
  category text,
  serial_number text,
  status text not null default 'active'
    check (status in ('active', 'needs_service', 'out_of_service', 'in_repair')),
  install_date date,
  warranty_expires_at date,
  last_service_at date,
  next_due_at date,
  location_label text,
  notes text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_archived_consistency
    check (
      (is_archived = true and archived_at is not null) or
      (is_archived = false and archived_at is null)
    ),
  constraint equipment_org_customer_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete restrict
);

-- Useful indexes
create index if not exists idx_equipment_org_archived_status
  on public.equipment (organization_id, is_archived, status);

create index if not exists idx_equipment_org_customer_archived
  on public.equipment (organization_id, customer_id, is_archived);

create index if not exists idx_equipment_org_next_due
  on public.equipment (organization_id, next_due_at);

create unique index if not exists idx_equipment_org_code_unique
  on public.equipment (organization_id, nullif(trim(equipment_code), ''))
  where nullif(trim(equipment_code), '') is not null;

create unique index if not exists idx_equipment_org_serial_unique
  on public.equipment (organization_id, nullif(trim(serial_number), ''))
  where nullif(trim(serial_number), '') is not null;

-- Use existing set_updated_at trigger function if available; create fallback if not.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = public, pg_catalog
    as $fn$
    begin
      new.updated_at := now();
      return new;
    end;
    $fn$;

    revoke all on function public.set_updated_at() from public, anon, authenticated;
    alter function public.set_updated_at() owner to postgres;
  end if;
end;
$$;

drop trigger if exists trg_equipment_set_updated_at on public.equipment;
create trigger trg_equipment_set_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

-- Prevent organization_id changes after insert.
create or replace function public.prevent_organization_id_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable once created';
  end if;
  if new.customer_id is distinct from old.customer_id then
    raise exception 'customer_id is immutable once created';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_organization_id_change() from public, anon, authenticated;
alter function public.prevent_organization_id_change() owner to postgres;

drop trigger if exists trg_equipment_immutable_org on public.equipment;
create trigger trg_equipment_immutable_org
before update on public.equipment
for each row execute function public.prevent_organization_id_change();

create or replace function public.set_equipment_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if new.created_by is null then
      raise exception 'created_by cannot be set without an authenticated user';
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

drop trigger if exists trg_equipment_set_created_by on public.equipment;
create trigger trg_equipment_set_created_by
before insert or update on public.equipment
for each row execute function public.set_equipment_created_by();

-- Privileges: archive-only model (no hard delete grants)
revoke all on table public.equipment from public, anon;
grant select, insert, update on table public.equipment to authenticated;

-- RLS
alter table public.equipment enable row level security;
alter table public.equipment force row level security;

drop policy if exists "equipment_select_member" on public.equipment;
create policy "equipment_select_member"
on public.equipment
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "equipment_insert_owner_admin_manager" on public.equipment;
create policy "equipment_insert_owner_admin_manager"
on public.equipment
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "equipment_update_owner_admin_manager" on public.equipment;
create policy "equipment_update_owner_admin_manager"
on public.equipment
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

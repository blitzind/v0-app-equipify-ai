-- Work orders foundation (tenant-scoped)
-- Creates public.work_orders with composite FKs to customers and equipment, RLS, and archive semantics.
--
-- UI -> DB value mapping (application layer should normalize before insert/update):
--   status:   Open -> open | Scheduled -> scheduled | In Progress -> in_progress |
--             Completed -> completed | Invoiced -> invoiced
--   priority: Low -> low | Normal -> normal | High -> high | Critical -> critical
--   type:     Repair -> repair | PM -> pm | Inspection -> inspection |
--             Install -> install | Emergency -> emergency

do $$
begin
  if to_regclass('public.customers') is null then
    raise exception 'Missing dependency: table public.customers must exist before this migration.';
  end if;

  if to_regclass('public.equipment') is null then
    raise exception 'Missing dependency: table public.equipment must exist before this migration.';
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
    raise exception 'Missing dependency: public.customers must have a primary or unique constraint on (organization_id, id).';
  end if;

  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: function public.is_org_member(uuid) must exist before this migration.';
  end if;

  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: function public.has_org_role(uuid,text[]) must exist before this migration.';
  end if;
end;
$$;

-- PostgreSQL requires a unique constraint on the referenced columns for composite FKs.
-- Equipment uses id as PK only; add composite uniqueness for (organization_id, id) if missing.
create unique index if not exists idx_equipment_org_id_composite
  on public.equipment (organization_id, id);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  equipment_id uuid not null,
  title text not null check (char_length(trim(title)) > 0),
  status text not null default 'open'
    check (status in ('open', 'scheduled', 'in_progress', 'completed', 'invoiced')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  type text not null default 'repair'
    check (type in ('repair', 'pm', 'inspection', 'install', 'emergency')),
  scheduled_on date,
  scheduled_time time without time zone,
  completed_at timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  invoice_number text,
  total_labor_cents bigint not null default 0 check (total_labor_cents >= 0),
  total_parts_cents bigint not null default 0 check (total_parts_cents >= 0),
  repair_log jsonb not null default '{}'::jsonb,
  notes text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_orders_archived_consistency
    check (
      (is_archived = true and archived_at is not null) or
      (is_archived = false and archived_at is null)
    ),
  constraint work_orders_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete restrict,
  constraint work_orders_equipment_org_fkey
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id)
    on delete restrict
);

comment on table public.work_orders is
  'Tenant-scoped work orders. Status/priority/type values are lowercase/snake_case in DB; map UI labels in the app (see file header).';

comment on column public.work_orders.status is
  'open | scheduled | in_progress | completed | invoiced — maps from UI Open, Scheduled, In Progress, Completed, Invoiced';

comment on column public.work_orders.priority is
  'low | normal | high | critical — maps from UI Low, Normal, High, Critical';

comment on column public.work_orders.type is
  'repair | pm | inspection | install | emergency — maps from UI Repair, PM, Inspection, Install, Emergency';

-- Optional: unique invoice_number per organization when non-blank (trimmed); blank strings ignored as duplicates like equipment_code.
create unique index if not exists idx_work_orders_org_invoice_number_unique
  on public.work_orders (organization_id, nullif(trim(invoice_number), ''))
  where nullif(trim(invoice_number), '') is not null;

-- Useful indexes
create index if not exists idx_work_orders_org_archived_status
  on public.work_orders (organization_id, is_archived, status);

create index if not exists idx_work_orders_org_scheduled_on
  on public.work_orders (organization_id, scheduled_on);

create index if not exists idx_work_orders_org_customer
  on public.work_orders (organization_id, customer_id);

create index if not exists idx_work_orders_org_equipment
  on public.work_orders (organization_id, equipment_id);

create index if not exists idx_work_orders_org_assigned_user
  on public.work_orders (organization_id, assigned_user_id)
  where assigned_user_id is not null;

create index if not exists idx_work_orders_org_created_at
  on public.work_orders (organization_id, created_at desc);

create index if not exists idx_work_orders_org_archived_scheduled
  on public.work_orders (organization_id, is_archived, scheduled_on);

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

drop trigger if exists trg_work_orders_set_updated_at on public.work_orders;
create trigger trg_work_orders_set_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

-- Equipment row for (organization_id, equipment_id) must belong to work_orders.customer_id.
create or replace function public.work_orders_validate_customer_equipment_pair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  equip_customer_id uuid;
begin
  select e.customer_id into equip_customer_id
  from public.equipment e
  where e.organization_id = new.organization_id
    and e.id = new.equipment_id;

  if equip_customer_id is null then
    -- Missing equipment row or org mismatch: defer to composite FK error if invalid.
    return new;
  end if;

  if equip_customer_id is distinct from new.customer_id then
    raise exception 'work_orders.customer_id must match equipment.customer_id for this organization';
  end if;

  return new;
end;
$$;

revoke all on function public.work_orders_validate_customer_equipment_pair() from public, anon, authenticated;
alter function public.work_orders_validate_customer_equipment_pair() owner to postgres;

drop trigger if exists trg_work_orders_validate_customer_equipment_pair on public.work_orders;
create trigger trg_work_orders_validate_customer_equipment_pair
before insert or update on public.work_orders
for each row execute function public.work_orders_validate_customer_equipment_pair();

-- assigned_user_id must reference an active organization member when set.
create or replace function public.work_orders_validate_assigned_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.assigned_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.assigned_user_id
      and om.status = 'active'
  ) then
    raise exception 'assigned_user_id must be an active member of the organization';
  end if;

  return new;
end;
$$;

revoke all on function public.work_orders_validate_assigned_member() from public, anon, authenticated;
alter function public.work_orders_validate_assigned_member() owner to postgres;

drop trigger if exists trg_work_orders_validate_assigned_member on public.work_orders;
create trigger trg_work_orders_validate_assigned_member
before insert or update on public.work_orders
for each row execute function public.work_orders_validate_assigned_member();

-- Prevent organization_id, customer_id, and equipment_id changes after insert.
create or replace function public.prevent_work_orders_identity_change()
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
  if new.equipment_id is distinct from old.equipment_id then
    raise exception 'equipment_id is immutable once created';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_work_orders_identity_change() from public, anon, authenticated;
alter function public.prevent_work_orders_identity_change() owner to postgres;

drop trigger if exists trg_work_orders_immutable_identity on public.work_orders;
create trigger trg_work_orders_immutable_identity
before update on public.work_orders
for each row execute function public.prevent_work_orders_identity_change();

-- Prevent created_by spoofing; enforce auth.uid() on insert; block updates.
create or replace function public.set_work_orders_created_by()
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

revoke all on function public.set_work_orders_created_by() from public, anon, authenticated;
alter function public.set_work_orders_created_by() owner to postgres;

drop trigger if exists trg_work_orders_set_created_by on public.work_orders;
create trigger trg_work_orders_set_created_by
before insert or update on public.work_orders
for each row execute function public.set_work_orders_created_by();

-- Privileges: soft-archive model (no delete grants)
revoke all on table public.work_orders from public, anon;
grant select, insert, update on table public.work_orders to authenticated;

-- RLS
alter table public.work_orders enable row level security;
alter table public.work_orders force row level security;

drop policy if exists "work_orders_select_member" on public.work_orders;
create policy "work_orders_select_member"
on public.work_orders
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "work_orders_insert_owner_admin_manager" on public.work_orders;
create policy "work_orders_insert_owner_admin_manager"
on public.work_orders
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "work_orders_update_owner_admin_manager" on public.work_orders;
create policy "work_orders_update_owner_admin_manager"
on public.work_orders
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

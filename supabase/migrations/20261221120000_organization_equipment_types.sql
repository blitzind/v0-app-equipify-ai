-- Per-organization equipment type catalog (Settings → Equipment Types, Add Equipment, reports).
-- Seed rows (`is_seed`) can be replaced via in-app "Reset to industry defaults"; custom rows are soft-archived.

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: function public.is_org_member(uuid) must exist.';
  end if;

  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: function public.has_org_role(uuid,text[]) must exist.';
  end if;

  if to_regprocedure('public.prevent_organization_id_change()') is null then
    raise exception 'Missing dependency: function public.prevent_organization_id_change() must exist.';
  end if;
end;
$$;

create table if not exists public.organization_equipment_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  color text not null default '#2563eb',
  icon text not null default 'Wrench',
  sort_order int not null default 0,
  is_seed boolean not null default false,
  seed_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organization_equipment_types_org_active_sort
  on public.organization_equipment_types (organization_id, sort_order, name)
  where archived_at is null;

create unique index if not exists idx_organization_equipment_types_org_name_active_unique
  on public.organization_equipment_types (organization_id, lower(trim(name)))
  where archived_at is null;

create unique index if not exists idx_organization_equipment_types_org_seed_key_active_unique
  on public.organization_equipment_types (organization_id, seed_key)
  where seed_key is not null and archived_at is null;

drop trigger if exists trg_organization_equipment_types_immutable_org on public.organization_equipment_types;
create trigger trg_organization_equipment_types_immutable_org
before update on public.organization_equipment_types
for each row execute function public.prevent_organization_id_change();

drop trigger if exists trg_organization_equipment_types_set_updated_at on public.organization_equipment_types;
create trigger trg_organization_equipment_types_set_updated_at
before update on public.organization_equipment_types
for each row execute function public.set_updated_at();

comment on table public.organization_equipment_types is
  'Workspace-scoped equipment categories for dropdowns and reporting; synced with organizations.industry for default seeds.';
comment on column public.organization_equipment_types.is_seed is
  'True for industry template rows (reset replaces active seeds by archiving then re-inserting).';
comment on column public.organization_equipment_types.seed_key is
  'Stable key per org for idempotent seeding (e.g. industry:slug); null for user-created types.';

revoke all on table public.organization_equipment_types from public, anon;
grant select, insert, update, delete on table public.organization_equipment_types to authenticated;

alter table public.organization_equipment_types enable row level security;

drop policy if exists "organization_equipment_types_select_member" on public.organization_equipment_types;
create policy "organization_equipment_types_select_member"
on public.organization_equipment_types
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_equipment_types_insert_admin" on public.organization_equipment_types;
create policy "organization_equipment_types_insert_admin"
on public.organization_equipment_types
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "organization_equipment_types_update_admin" on public.organization_equipment_types;
create policy "organization_equipment_types_update_admin"
on public.organization_equipment_types
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

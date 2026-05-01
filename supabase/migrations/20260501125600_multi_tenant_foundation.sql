-- Multi-tenant foundation for Equipify.ai
-- Creates organizations, profiles, organization_members, RLS policies,
-- profile-on-signup trigger, and org bootstrap RPC.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug citext not null unique check (char_length(trim(slug::text)) > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  full_name text,
  avatar_url text,
  default_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'tech', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists idx_organizations_created_by
  on public.organizations (created_by);

create index if not exists idx_profiles_default_org
  on public.profiles (default_organization_id);

create unique index if not exists idx_profiles_email_unique
  on public.profiles (email)
  where email is not null;

create index if not exists idx_org_members_user_id
  on public.organization_members (user_id);

create index if not exists idx_org_members_org_role
  on public.organization_members (organization_id, role);

create index if not exists idx_org_members_active_user
  on public.organization_members (organization_id, user_id)
  where status = 'active';

revoke all on table public.organizations from public, anon;
revoke all on table public.profiles from public, anon;
revoke all on table public.organization_members from public, anon;

grant select, update, delete on table public.organizations to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;

-- -----------------------------------------------------------------------------
-- Helper functions used by RLS
-- -----------------------------------------------------------------------------

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
alter function public.is_org_member(uuid) owner to postgres;
alter function public.has_org_role(uuid, text[]) owner to postgres;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

-- organizations
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "org_insert_authenticated" on public.organizations;

drop policy if exists "org_update_admin_owner" on public.organizations;
create policy "org_update_admin_owner"
on public.organizations
for update
to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

drop policy if exists "org_delete_owner_only" on public.organizations;
create policy "org_delete_owner_only"
on public.organizations
for delete
to authenticated
using (public.has_org_role(id, array['owner']));

-- profiles
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- organization_members
drop policy if exists "org_members_select_member" on public.organization_members;
create policy "org_members_select_member"
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_members_insert_admin_owner" on public.organization_members;
create policy "org_members_insert_admin_owner"
on public.organization_members
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "org_members_update_admin_owner" on public.organization_members;
create policy "org_members_update_admin_owner"
on public.organization_members
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "org_members_delete_admin_owner" on public.organization_members;
create policy "org_members_delete_admin_owner"
on public.organization_members
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin'])
);

-- -----------------------------------------------------------------------------
-- Trigger: auto-create profile for new auth user
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_user_profile() from public;
alter function public.handle_new_user_profile() owner to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- -----------------------------------------------------------------------------
-- RPC: create organization + owner membership atomically
-- -----------------------------------------------------------------------------

create or replace function public.create_organization_with_owner(
  org_name text,
  org_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_org_slug citext;
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(org_name), trim(org_slug)::citext, v_uid)
  returning id, name, slug into v_org_id, v_org_name, v_org_slug;

  insert into public.organization_members (organization_id, user_id, role, status, invited_by)
  values (v_org_id, v_uid, 'owner', 'active', v_uid)
  on conflict (organization_id, user_id) do nothing;

  update public.profiles
  set default_organization_id = coalesce(default_organization_id, v_org_id),
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object(
    'id', v_org_id,
    'name', v_org_name,
    'slug', v_org_slug::text
  );
end;
$$;

revoke all on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;
alter function public.create_organization_with_owner(text, text) owner to postgres;

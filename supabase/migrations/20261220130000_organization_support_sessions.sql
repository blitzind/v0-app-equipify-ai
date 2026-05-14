-- Short-lived rows that let a signed-in user satisfy tenant RLS for a single organization
-- without an organization_members row (platform support / "Login as" from Platform Admin).

create table if not exists public.organization_support_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_organization_support_sessions_user_expires
  on public.organization_support_sessions (user_id, expires_at desc);

comment on table public.organization_support_sessions is
  'Platform-admin workspace access: created only via service-role API; extends is_org_member/has_org_role while active.';

alter table public.organization_support_sessions enable row level security;

grant select, delete on public.organization_support_sessions to authenticated;

drop policy if exists "organization_support_sessions_select_own" on public.organization_support_sessions;
create policy "organization_support_sessions_select_own"
  on public.organization_support_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "organization_support_sessions_delete_own" on public.organization_support_sessions;
create policy "organization_support_sessions_delete_own"
  on public.organization_support_sessions
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Core membership helpers: active member OR unexpired support session on active org
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
    inner join public.organizations o on o.id = om.organization_id
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and o.status = 'active'
  )
  or exists (
    select 1
    from public.organization_support_sessions s
    inner join public.organizations o on o.id = s.organization_id
    where s.organization_id = org_id
      and s.user_id = auth.uid()
      and s.expires_at > now()
      and o.status = 'active'
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
    inner join public.organizations o on o.id = om.organization_id
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and o.status = 'active'
      and om.role = any(allowed_roles)
  )
  or (
    exists (
      select 1
      from public.organization_support_sessions s
      inner join public.organizations o on o.id = s.organization_id
      where s.organization_id = org_id
        and s.user_id = auth.uid()
        and s.expires_at > now()
        and o.status = 'active'
    )
    and not (
      coalesce(array_length(allowed_roles, 1), 0) = 1
      and allowed_roles[1] = 'owner'
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Storage: organization logos (policies inlined organization_members; add support path)
-- -----------------------------------------------------------------------------
drop policy if exists "organization_logos_insert_org_admins" on storage.objects;
create policy "organization_logos_insert_org_admins"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organization-logos'
    and length(trim(split_part(name, '/', 1))) > 0
    and (
      exists (
        select 1
        from public.organization_members om
        inner join public.organizations o on o.id = om.organization_id
        where om.organization_id::text = split_part(name, '/', 1)
          and om.user_id = (select auth.uid())
          and om.status = 'active'
          and o.status = 'active'
          and om.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.organization_support_sessions s
        inner join public.organizations o on o.id = s.organization_id
        where s.organization_id::text = split_part(name, '/', 1)
          and s.user_id = (select auth.uid())
          and s.expires_at > now()
          and o.status = 'active'
      )
    )
  );

drop policy if exists "organization_logos_update_org_admins" on storage.objects;
create policy "organization_logos_update_org_admins"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and (
      exists (
        select 1
        from public.organization_members om
        inner join public.organizations o on o.id = om.organization_id
        where om.organization_id::text = split_part(name, '/', 1)
          and om.user_id = (select auth.uid())
          and om.status = 'active'
          and o.status = 'active'
          and om.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.organization_support_sessions s
        inner join public.organizations o on o.id = s.organization_id
        where s.organization_id::text = split_part(name, '/', 1)
          and s.user_id = (select auth.uid())
          and s.expires_at > now()
          and o.status = 'active'
      )
    )
  )
  with check (
    bucket_id = 'organization-logos'
    and (
      exists (
        select 1
        from public.organization_members om
        inner join public.organizations o on o.id = om.organization_id
        where om.organization_id::text = split_part(name, '/', 1)
          and om.user_id = (select auth.uid())
          and om.status = 'active'
          and o.status = 'active'
          and om.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.organization_support_sessions s
        inner join public.organizations o on o.id = s.organization_id
        where s.organization_id::text = split_part(name, '/', 1)
          and s.user_id = (select auth.uid())
          and s.expires_at > now()
          and o.status = 'active'
      )
    )
  );

drop policy if exists "organization_logos_delete_org_admins" on storage.objects;
create policy "organization_logos_delete_org_admins"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and (
      exists (
        select 1
        from public.organization_members om
        inner join public.organizations o on o.id = om.organization_id
        where om.organization_id::text = split_part(name, '/', 1)
          and om.user_id = (select auth.uid())
          and om.status = 'active'
          and o.status = 'active'
          and om.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.organization_support_sessions s
        inner join public.organizations o on o.id = s.organization_id
        where s.organization_id::text = split_part(name, '/', 1)
          and s.user_id = (select auth.uid())
          and s.expires_at > now()
          and o.status = 'active'
      )
    )
  );

-- -----------------------------------------------------------------------------
-- organizations: SELECT (policy used inline membership, not is_org_member)
-- -----------------------------------------------------------------------------
drop policy if exists "org_select_member" on public.organizations;

create policy "org_select_member"
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
    or exists (
      select 1
      from public.organization_support_sessions s
      where s.organization_id = organizations.id
        and s.user_id = auth.uid()
        and s.expires_at > now()
    )
  );

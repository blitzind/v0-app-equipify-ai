-- Canonical invite rows for team onboarding (replaces legacy public.invites).

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'tech' check (role in ('admin', 'manager', 'tech', 'viewer')),
  invited_by uuid references public.profiles(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_invites_token on public.organization_invites (token);
create index if not exists idx_organization_invites_org on public.organization_invites (organization_id);
create index if not exists idx_organization_invites_org_email on public.organization_invites (organization_id, email);
create index if not exists idx_organization_invites_expires_at on public.organization_invites (expires_at);

alter table public.organization_invites enable row level security;

-- Migrate legacy public.invites when present, then drop legacy table.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'invites'
  ) then
    insert into public.organization_invites (
      id, organization_id, email, role, invited_by, token, status, expires_at, accepted_at, created_at
    )
    select
      i.id,
      i.organization_id,
      lower(trim(i.email)),
      i.role,
      null::uuid,
      i.token,
      case
        when i.accepted_at is not null then 'accepted'
        when i.expires_at < now() then 'expired'
        else 'pending'
      end,
      i.expires_at,
      i.accepted_at,
      i.created_at
    from public.invites i
    on conflict (id) do nothing;

    drop table public.invites cascade;
  end if;
end $$;

drop policy if exists "organization_invites_select_active_member" on public.organization_invites;
create policy "organization_invites_select_active_member"
  on public.organization_invites for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_invites.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "organization_invites_insert_owner_admin" on public.organization_invites;
create policy "organization_invites_insert_owner_admin"
  on public.organization_invites for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_invites.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );

drop policy if exists "organization_invites_update_owner_admin" on public.organization_invites;
create policy "organization_invites_update_owner_admin"
  on public.organization_invites for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_invites.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_invites.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );

drop policy if exists "organization_invites_delete_owner_admin" on public.organization_invites;
create policy "organization_invites_delete_owner_admin"
  on public.organization_invites for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_invites.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );

comment on table public.organization_invites is 'Email invitations to join an organization (token-based accept flow).';

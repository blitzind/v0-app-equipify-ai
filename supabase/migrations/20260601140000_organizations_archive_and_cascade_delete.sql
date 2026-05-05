-- Organization lifecycle: active | archived (soft-delete for platform admin).
-- Tighten FKs so DELETE FROM organizations cascades tenant data (platform admin hard delete).

-- -----------------------------------------------------------------------------
-- organizations.status
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists status text;

update public.organizations
set status = 'active'
where status is null;

alter table public.organizations
  alter column status set default 'active',
  alter column status set not null;

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status in ('active', 'archived'));

comment on column public.organizations.status is
  'active = normal operations; archived = read-only at app layer, no writes or login.';

create index if not exists idx_organizations_status on public.organizations (status);

-- -----------------------------------------------------------------------------
-- RLS: members can SELECT their org even when archived (for status + middleware).
-- Operational tables still use is_org_member() which requires active org.
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
);

-- -----------------------------------------------------------------------------
-- is_org_member / has_org_role: require active organization
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
  );
$$;

-- -----------------------------------------------------------------------------
-- Billing insert guard: archived orgs cannot create operational rows
-- -----------------------------------------------------------------------------
create or replace function public.can_org_create_records(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select
        o.status = 'active'
        and (
          s.status = 'active'
          or (
            s.status = 'trialing'
            and s.trial_ends_at is not null
            and s.trial_ends_at > now()
          )
          or s.status = 'past_due'
          or s.status = 'incomplete'
        )
      from public.organization_subscriptions s
      inner join public.organizations o on o.id = s.organization_id
      where s.organization_id = org_id
    ),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- FK: allow deleting an organization to cascade heavy tenant graphs
-- -----------------------------------------------------------------------------
alter table public.work_orders
  drop constraint if exists work_orders_organization_id_fkey;

alter table public.work_orders
  add constraint work_orders_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

alter table public.maintenance_plans
  drop constraint if exists maintenance_plans_organization_id_fkey;

alter table public.maintenance_plans
  add constraint maintenance_plans_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

alter table public.maintenance_plan_automation_events
  drop constraint if exists maintenance_plan_automation_events_organization_id_fkey;

alter table public.maintenance_plan_automation_events
  add constraint maintenance_plan_automation_events_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

-- Members: always see own row (for archived-org detection); see full roster when org is active.
drop policy if exists "org_members_select_member" on public.organization_members;

create policy "org_members_select_member"
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

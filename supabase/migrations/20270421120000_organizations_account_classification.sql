-- Organization account classification for platform metrics exclusion.
-- Platform admins (service role) may mark demo/internal/test/unbillable orgs so they are omitted from business KPIs.

alter table public.organizations
  add column if not exists account_type text,
  add column if not exists exclude_from_platform_metrics boolean,
  add column if not exists exclusion_reason text,
  add column if not exists excluded_at timestamptz,
  add column if not exists excluded_by uuid references auth.users (id) on delete set null;

update public.organizations
set
  account_type = coalesce(account_type, 'customer'),
  exclude_from_platform_metrics = coalesce(exclude_from_platform_metrics, false)
where account_type is null or exclude_from_platform_metrics is null;

alter table public.organizations
  alter column account_type set default 'customer',
  alter column account_type set not null,
  alter column exclude_from_platform_metrics set default false,
  alter column exclude_from_platform_metrics set not null;

alter table public.organizations
  drop constraint if exists organizations_account_type_check;

alter table public.organizations
  add constraint organizations_account_type_check
  check (account_type in ('customer', 'demo', 'internal', 'test', 'unbillable'));

comment on column public.organizations.account_type is
  'Platform-admin classification: customer (default) or non-customer types excluded from business metrics.';

comment on column public.organizations.exclude_from_platform_metrics is
  'When true, omit this organization from platform/admin business KPIs and rollups.';

comment on column public.organizations.exclusion_reason is
  'Optional platform-admin note explaining why this org is excluded from metrics.';

comment on column public.organizations.excluded_at is
  'When the org was last marked excluded from platform metrics.';

comment on column public.organizations.excluded_by is
  'Platform admin user who last marked this org excluded from platform metrics.';

create index if not exists idx_organizations_platform_metrics_exclusion
  on public.organizations (exclude_from_platform_metrics)
  where exclude_from_platform_metrics = true;

-- Prevent tenant org admins from mutating metrics classification fields (service role only).
create or replace function public.organizations_protect_metrics_classification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.account_type is distinct from old.account_type
     or new.exclude_from_platform_metrics is distinct from old.exclude_from_platform_metrics
     or new.exclusion_reason is distinct from old.exclusion_reason
     or new.excluded_at is distinct from old.excluded_at
     or new.excluded_by is distinct from old.excluded_by then
    raise exception 'organization_metrics_classification_protected';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_organizations_protect_metrics_classification on public.organizations;
create trigger trg_organizations_protect_metrics_classification
before update on public.organizations
for each row execute function public.organizations_protect_metrics_classification();

-- GE-AIOS-BUSINESS-PROFILE-1A — Organization Business Profile (draft → approved workflow).

create table if not exists growth.organization_business_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected')),
  company_name text not null,
  website text not null,
  profile_json jsonb not null default '{}'::jsonb,
  draft_input_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_business_profile_company_name_length
    check (char_length(trim(company_name)) between 1 and 256),
  constraint organization_business_profile_website_length
    check (char_length(trim(website)) between 3 and 2048)
);

comment on table growth.organization_business_profiles is
  'AI OS Business Profile drafts and approved profiles per organization (GE-AIOS-BUSINESS-PROFILE-1A). Only approved profiles may guide downstream discovery.';

create index if not exists idx_growth_organization_business_profiles_org_status
  on growth.organization_business_profiles (organization_id, status);

create index if not exists idx_growth_organization_business_profiles_org_created
  on growth.organization_business_profiles (organization_id, created_at desc);

drop trigger if exists trg_growth_organization_business_profiles_set_updated_at
  on growth.organization_business_profiles;
create trigger trg_growth_organization_business_profiles_set_updated_at
before update on growth.organization_business_profiles
for each row execute function public.set_updated_at();

revoke all on table growth.organization_business_profiles from public, anon, authenticated;
grant select, insert, update, delete on table growth.organization_business_profiles to service_role;

alter table growth.organization_business_profiles enable row level security;
alter table growth.organization_business_profiles force row level security;

drop policy if exists growth_organization_business_profiles_service_role
  on growth.organization_business_profiles;

create policy growth_organization_business_profiles_service_role
  on growth.organization_business_profiles
  for all
  to service_role
  using (true)
  with check (true);

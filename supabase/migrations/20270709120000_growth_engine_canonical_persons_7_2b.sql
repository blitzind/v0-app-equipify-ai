-- Growth Engine Phase 7.2B — Canonical person layer (additive, growth schema only).

do $$
begin
  if to_regclass('growth.companies') is null then
    raise exception 'Missing dependency: growth.companies';
  end if;
  if to_regclass('growth.contact_candidates') is null then
    raise exception 'Missing dependency: growth.contact_candidates';
  end if;
  if to_regclass('growth.company_contacts') is null then
    raise exception 'Missing dependency: growth.company_contacts';
  end if;
  if to_regclass('growth.lead_decision_makers') is null then
    raise exception 'Missing dependency: growth.lead_decision_makers';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.persons — canonical person system of record
-- -----------------------------------------------------------------------------

create table if not exists growth.persons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  first_name text,
  last_name text,
  full_name text not null default '',
  normalized_name text not null default '',

  primary_title text,
  primary_department text,
  primary_seniority text,
  location text,

  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  resolution_method text not null default 'new'
    check (resolution_method in (
      'normalized_email',
      'normalized_linkedin',
      'normalized_phone',
      'name_company',
      'new',
      'manual'
    )),

  status text not null default 'active'
    check (status in ('active', 'merged', 'suppressed')),
  merged_into_person_id uuid references growth.persons (id) on delete set null,

  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists persons_normalized_name_idx
  on growth.persons (normalized_name)
  where status = 'active';

create index if not exists persons_status_idx
  on growth.persons (status, updated_at desc);

create index if not exists persons_merged_into_idx
  on growth.persons (merged_into_person_id)
  where merged_into_person_id is not null;

-- -----------------------------------------------------------------------------
-- growth.person_emails
-- -----------------------------------------------------------------------------

create table if not exists growth.person_emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references growth.persons (id) on delete cascade,
  email text not null default '',
  normalized_email text not null default '',
  email_type text not null default 'unknown'
    check (email_type in ('work', 'personal', 'unknown')),
  is_primary boolean not null default false,
  verification_status text not null default 'unverified'
    check (verification_status in (
      'not_present', 'unverified', 'observed', 'insufficient_evidence', 'operator_verified', 'rejected'
    )),
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),

  source_table text,
  source_id text,
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists person_emails_normalized_email_unique
  on growth.person_emails (normalized_email)
  where normalized_email <> '';

create index if not exists person_emails_person_idx
  on growth.person_emails (person_id, is_primary desc);

-- -----------------------------------------------------------------------------
-- growth.person_phones
-- -----------------------------------------------------------------------------

create table if not exists growth.person_phones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references growth.persons (id) on delete cascade,
  phone text not null default '',
  normalized_phone text not null default '',
  phone_type text not null default 'unknown'
    check (phone_type in ('mobile', 'business', 'unknown')),
  is_primary boolean not null default false,
  verification_status text not null default 'unverified'
    check (verification_status in (
      'not_present', 'unverified', 'observed', 'insufficient_evidence', 'operator_verified', 'rejected'
    )),
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),

  source_table text,
  source_id text,
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists person_phones_normalized_phone_unique
  on growth.person_phones (normalized_phone)
  where normalized_phone <> '';

create index if not exists person_phones_person_idx
  on growth.person_phones (person_id, is_primary desc);

-- -----------------------------------------------------------------------------
-- growth.person_profiles
-- -----------------------------------------------------------------------------

create table if not exists growth.person_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references growth.persons (id) on delete cascade,
  profile_type text not null default 'linkedin'
    check (profile_type in ('linkedin', 'twitter', 'github', 'other')),
  profile_url text not null default '',
  normalized_profile_key text not null default '',
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),

  source_table text,
  source_id text,
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists person_profiles_normalized_key_unique
  on growth.person_profiles (normalized_profile_key)
  where normalized_profile_key <> '';

create index if not exists person_profiles_person_idx
  on growth.person_profiles (person_id);

-- -----------------------------------------------------------------------------
-- growth.person_company_roles
-- -----------------------------------------------------------------------------

create table if not exists growth.person_company_roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references growth.persons (id) on delete cascade,
  company_id uuid not null references growth.companies (id) on delete cascade,
  title text,
  department text,
  seniority text,
  role_type text not null default 'unknown'
    check (role_type in (
      'owner', 'economic_buyer', 'decision_maker', 'technical_buyer', 'champion', 'operator', 'unknown'
    )),
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),

  source_table text,
  source_id text,
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  unique (person_id, company_id, title)
);

create index if not exists person_company_roles_company_idx
  on growth.person_company_roles (company_id, person_id);

create index if not exists person_company_roles_name_company_idx
  on growth.person_company_roles (company_id);

-- -----------------------------------------------------------------------------
-- growth.person_source_lineage
-- -----------------------------------------------------------------------------

create table if not exists growth.person_source_lineage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  person_id uuid not null references growth.persons (id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  confidence numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,

  unique (source_table, source_id)
);

create index if not exists person_source_lineage_person_idx
  on growth.person_source_lineage (person_id, observed_at desc);

-- -----------------------------------------------------------------------------
-- growth.person_merge_events
-- -----------------------------------------------------------------------------

create table if not exists growth.person_merge_events (
  id uuid primary key default gen_random_uuid(),
  survivor_person_id uuid not null references growth.persons (id) on delete cascade,
  merged_person_id uuid not null references growth.persons (id) on delete cascade,
  merge_reason text not null default '',
  resolution_method text not null default 'normalized_email',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  unique (survivor_person_id, merged_person_id)
);

-- -----------------------------------------------------------------------------
-- Staging linkage (nullable, backward compatible)
-- -----------------------------------------------------------------------------

alter table growth.contact_candidates
  add column if not exists canonical_person_id uuid references growth.persons (id) on delete set null;

alter table growth.company_contacts
  add column if not exists canonical_person_id uuid references growth.persons (id) on delete set null;

alter table growth.lead_decision_makers
  add column if not exists canonical_person_id uuid references growth.persons (id) on delete set null;

create index if not exists contact_candidates_canonical_person_idx
  on growth.contact_candidates (canonical_person_id)
  where canonical_person_id is not null;

create index if not exists company_contacts_canonical_person_idx
  on growth.company_contacts (canonical_person_id)
  where canonical_person_id is not null;

create index if not exists lead_decision_makers_canonical_person_idx
  on growth.lead_decision_makers (canonical_person_id)
  where canonical_person_id is not null;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_persons_updated_at on growth.persons;
create trigger trg_growth_persons_updated_at
  before update on growth.persons
  for each row
  execute function public.set_updated_at();

drop trigger if exists trg_growth_person_emails_updated_at on growth.person_emails;
create trigger trg_growth_person_emails_updated_at
  before update on growth.person_emails
  for each row
  execute function public.set_updated_at();

drop trigger if exists trg_growth_person_phones_updated_at on growth.person_phones;
create trigger trg_growth_person_phones_updated_at
  before update on growth.person_phones
  for each row
  execute function public.set_updated_at();

drop trigger if exists trg_growth_person_profiles_updated_at on growth.person_profiles;
create trigger trg_growth_person_profiles_updated_at
  before update on growth.person_profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists trg_growth_person_company_roles_updated_at on growth.person_company_roles;
create trigger trg_growth_person_company_roles_updated_at
  before update on growth.person_company_roles
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- service_role access (Growth Engine platform only)
-- -----------------------------------------------------------------------------

revoke all on table growth.persons from public, anon, authenticated;
revoke all on table growth.person_emails from public, anon, authenticated;
revoke all on table growth.person_phones from public, anon, authenticated;
revoke all on table growth.person_profiles from public, anon, authenticated;
revoke all on table growth.person_company_roles from public, anon, authenticated;
revoke all on table growth.person_source_lineage from public, anon, authenticated;
revoke all on table growth.person_merge_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.persons to service_role;
grant select, insert, update, delete on table growth.person_emails to service_role;
grant select, insert, update, delete on table growth.person_phones to service_role;
grant select, insert, update, delete on table growth.person_profiles to service_role;
grant select, insert, update, delete on table growth.person_company_roles to service_role;
grant select, insert, update, delete on table growth.person_source_lineage to service_role;
grant select, insert, update, delete on table growth.person_merge_events to service_role;

alter table growth.persons enable row level security;
alter table growth.person_emails enable row level security;
alter table growth.person_phones enable row level security;
alter table growth.person_profiles enable row level security;
alter table growth.person_company_roles enable row level security;
alter table growth.person_source_lineage enable row level security;
alter table growth.person_merge_events enable row level security;

comment on table growth.persons is
  'Phase 7.2B canonical person system of record for Growth Engine contact graph.';
comment on table growth.person_source_lineage is
  'Maps staging ingestion rows to canonical persons with provider attribution.';

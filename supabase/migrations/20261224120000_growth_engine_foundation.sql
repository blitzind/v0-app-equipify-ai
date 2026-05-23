-- Growth Engine foundation (slice 1): internal lead inbox in `growth` schema.
--
-- Not customer Prospects (`public.prospects`). Service-role API access only in slice 1.
-- Strictly additive + idempotent.

create extension if not exists "citext";

if to_regprocedure('public.set_updated_at()') is null then
  raise exception 'Missing dependency: public.set_updated_at()';
end if;

create schema if not exists growth;

comment on schema growth is
  'Internal Equipify Growth Engine: lead sourcing, enrichment, outbound automation. Not exposed to customer orgs in slice 1.';

-- -----------------------------------------------------------------------------
-- growth.leads
-- -----------------------------------------------------------------------------

create table if not exists growth.leads (
  id uuid primary key default gen_random_uuid(),

  source_kind text not null
    check (source_kind in ('manual', 'import', 'web', 'referral', 'partner', 'other')),
  source_detail text,
  external_ref text,

  company_name text not null check (char_length(trim(company_name)) > 0),
  contact_name text,
  contact_email citext,
  contact_phone text,
  website text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  country text default 'US',

  status text not null default 'new'
    check (status in (
      'new', 'researching', 'enriched', 'qualified',
      'in_outreach', 'replied', 'call_ready', 'converted', 'disqualified', 'archived'
    )),

  promoted_organization_id uuid references public.organizations (id) on delete set null,
  promoted_prospect_id uuid references public.prospects (id) on delete set null,
  promoted_at timestamptz,

  score int check (score is null or (score >= 0 and score <= 100)),

  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_leads_status_created
  on growth.leads (status, created_at desc);

create index if not exists idx_growth_leads_assigned_status
  on growth.leads (assigned_to, status)
  where assigned_to is not null;

create unique index if not exists idx_growth_leads_external_ref_unique
  on growth.leads (source_kind, external_ref)
  where external_ref is not null;

create index if not exists idx_growth_leads_promoted_prospect
  on growth.leads (promoted_prospect_id)
  where promoted_prospect_id is not null;

comment on table growth.leads is
  'Internal Growth Engine leads (pre-tenant). Promote to public.prospects in a later slice.';

drop trigger if exists trg_growth_leads_set_updated_at on growth.leads;
create trigger trg_growth_leads_set_updated_at
before update on growth.leads
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privileges — service role only (slice 1)
-- -----------------------------------------------------------------------------

revoke all on schema growth from public, anon, authenticated;
revoke all on table growth.leads from public, anon, authenticated;

grant usage on schema growth to service_role;
grant select, insert, update, delete on table growth.leads to service_role;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table growth.leads enable row level security;
alter table growth.leads force row level security;

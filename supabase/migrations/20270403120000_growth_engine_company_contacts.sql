-- Growth Engine — Company Contacts (Apollo replacement layer).
-- Canonical contact store bridging company discovery → verification → decision maker confidence.

do $$
begin
  if to_regclass('growth.external_company_candidates') is null then
    raise exception 'Missing dependency: growth.external_company_candidates';
  end if;
end;
$$;

create table if not exists growth.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  growth_lead_id uuid references growth.leads (id) on delete set null,
  contact_candidate_id uuid references growth.contact_candidates (id) on delete set null,
  lead_decision_maker_id uuid references growth.lead_decision_makers (id) on delete set null,

  full_name text not null default '',
  first_name text,
  last_name text,

  title text,
  department text,

  email text,
  email_status text not null default 'unknown'
    check (email_status in ('unknown', 'discovered', 'verified', 'risky', 'invalid')),

  phone text,
  phone_status text not null default 'unknown'
    check (phone_status in ('unknown', 'business', 'mobile', 'invalid')),

  linkedin_url text,

  confidence_score numeric not null default 0,
  decision_maker_score numeric not null default 0,

  source_type text not null default 'manual'
    check (source_type in (
      'website',
      'team_page',
      'contact_page',
      'linkedin',
      'google_business',
      'manual',
      'crm',
      'public_record'
    )),

  source_evidence jsonb not null default '[]'::jsonb,

  contact_status text not null default 'candidate'
    check (contact_status in ('candidate', 'verified', 'suppressed', 'archived')),

  last_verified_at timestamptz,
  dedupe_hash text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_contacts_company_idx
  on growth.company_contacts (company_id, created_at desc);

create index if not exists company_contacts_confidence_idx
  on growth.company_contacts (company_id, confidence_score desc);

create index if not exists company_contacts_dm_score_idx
  on growth.company_contacts (company_id, decision_maker_score desc);

create index if not exists company_contacts_email_status_idx
  on growth.company_contacts (company_id, email_status);

create index if not exists company_contacts_phone_status_idx
  on growth.company_contacts (company_id, phone_status);

create index if not exists company_contacts_last_verified_idx
  on growth.company_contacts (last_verified_at desc nulls last);

create unique index if not exists company_contacts_dedupe_idx
  on growth.company_contacts (company_id, dedupe_hash)
  where dedupe_hash <> '';

create table if not exists growth.company_contact_refresh_queue (
  id uuid primary key default gen_random_uuid(),
  company_contact_id uuid not null references growth.company_contacts (id) on delete cascade,
  reason text not null default 'stale',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_contact_id, reason)
);

create index if not exists company_contact_refresh_queue_status_idx
  on growth.company_contact_refresh_queue (status, scheduled_for asc);

revoke all on table growth.company_contacts from public, anon, authenticated;
revoke all on table growth.company_contact_refresh_queue from public, anon, authenticated;
grant select, insert, update, delete on table growth.company_contacts to service_role;
grant select, insert, update, delete on table growth.company_contact_refresh_queue to service_role;

alter table growth.company_contacts enable row level security;
alter table growth.company_contact_refresh_queue enable row level security;

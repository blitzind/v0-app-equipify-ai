-- Growth Engine — Lead Inbox + Candidate Queue (Prompt 16).
-- Operational queue between Intent Bridge and Lead Engine. No auto-execution.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.lead_inbox
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_inbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  site_key text not null default '',
  candidate_type text not null
    check (candidate_type in ('anonymous', 'identified', 'returning', 'high_intent', 'existing_account')),
  candidate_priority text not null default 'normal'
    check (candidate_priority in ('urgent', 'high', 'normal', 'low')),
  intent_score int not null default 0 check (intent_score >= 0),
  intent_grade text not null default 'F'
    check (intent_grade in ('A', 'B', 'C', 'D', 'F')),
  candidate_confidence numeric(4, 3) not null default 0 check (candidate_confidence >= 0 and candidate_confidence <= 1),
  pipeline_entry text not null default 'icp_targeting'
    check (pipeline_entry in ('icp_targeting', 'company_discovery', 'contact_research')),
  pipeline_status text not null default 'not_started'
    check (pipeline_status in ('not_started', 'queued', 'running', 'completed', 'failed')),
  company_name text not null default '',
  domain text,
  contact_name text,
  email text,
  phone text,
  linkedin_url text,
  dedupe_hash text not null,
  candidate_reasoning jsonb not null default '[]'::jsonb,
  candidate_evidence jsonb not null default '[]'::jsonb,
  candidate_attribution jsonb not null default '[]'::jsonb,
  session_count int not null default 0 check (session_count >= 0),
  visit_count int not null default 0 check (visit_count >= 0),
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  owner_id uuid,
  status text not null default 'new'
    check (status in (
      'new',
      'reviewing',
      'approved',
      'enriching',
      'running_pipeline',
      'pipeline_complete',
      'disqualified',
      'duplicate',
      'archived'
    )),
  human_review_required boolean not null default true,
  lead_engine_run_id uuid,
  intent_session_id uuid,
  visitor_key text not null default '',
  existing_account_match jsonb not null default '{}'::jsonb,
  existing_lead_match jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (dedupe_hash),
  unique (intent_session_id)
);

create index if not exists lead_inbox_status_priority_idx
  on growth.lead_inbox (status, candidate_priority, intent_score desc, created_at desc);

create index if not exists lead_inbox_owner_status_idx
  on growth.lead_inbox (owner_id, status, updated_at desc);

create index if not exists lead_inbox_domain_idx
  on growth.lead_inbox (domain)
  where domain is not null and domain <> '';

create index if not exists lead_inbox_email_idx
  on growth.lead_inbox (email)
  where email is not null and email <> '';

revoke all on table growth.lead_inbox from public, anon, authenticated;

grant select, insert, update, delete on table growth.lead_inbox to service_role;

alter table growth.lead_inbox enable row level security;
alter table growth.lead_inbox force row level security;

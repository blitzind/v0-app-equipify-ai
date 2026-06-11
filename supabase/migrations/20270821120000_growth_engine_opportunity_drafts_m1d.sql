-- Growth Engine Opportunity Drafts (M1-D) — recommendation-only draft queue.

do $$
begin
  if to_regclass('growth.meetings') is null then
    raise exception 'Missing dependency: growth.meetings';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.opportunity_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  meeting_id uuid not null references growth.meetings (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  company_id uuid,
  account_playbook_id uuid references growth.account_playbooks (id) on delete set null,

  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected', 'stale')),

  company_name text not null default '',
  opportunity_summary text not null default '',
  opportunity_type text not null default '',
  estimated_value numeric(14, 2) not null default 0,
  confidence_score numeric(5, 4) not null default 0,
  recommended_stage text not null default 'discovery',
  key_stakeholders jsonb not null default '[]'::jsonb,
  buying_signals jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  reasoning text not null default '',
  opportunity_readiness_score numeric(5, 2) not null default 0,
  opportunity_readiness_status text not null default 'Weak'
    check (opportunity_readiness_status in ('Weak', 'Developing', 'Qualified', 'Opportunity Ready')),
  source_attribution jsonb not null default '{}'::jsonb,
  input_hash text,

  approved_at timestamptz,
  approved_by uuid,
  approved_email text,
  rejection_note text,

  opportunity_created boolean not null default false,
  crm_written boolean not null default false,
  deal_created boolean not null default false,
  calendar_written boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists opportunity_drafts_status_idx
  on growth.opportunity_drafts (status, created_at desc);

create index if not exists opportunity_drafts_meeting_idx
  on growth.opportunity_drafts (meeting_id, created_at desc);

create index if not exists opportunity_drafts_lead_idx
  on growth.opportunity_drafts (lead_id, created_at desc);

create unique index if not exists opportunity_drafts_meeting_draft_unique
  on growth.opportunity_drafts (meeting_id)
  where status = 'draft';

create table if not exists growth.opportunity_draft_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  meeting_id uuid references growth.meetings (id) on delete set null,
  opportunity_draft_id uuid references growth.opportunity_drafts (id) on delete set null,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial', 'skipped')),

  drafts_created integer not null default 0,
  drafts_skipped_duplicate integer not null default 0,
  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  opportunity_created boolean not null default false,
  crm_written boolean not null default false,
  deal_created boolean not null default false,
  calendar_written boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists opportunity_draft_runs_execution_idx
  on growth.opportunity_draft_runs (execution_id, created_at desc);

grant select, insert, update, delete on growth.opportunity_drafts to service_role;
grant select, insert, update, delete on growth.opportunity_draft_runs to service_role;

alter table growth.opportunity_drafts enable row level security;
alter table growth.opportunity_draft_runs enable row level security;

comment on table growth.opportunity_drafts is
  'Opportunity Draft Engine (M1-D) — human-gated opportunity drafts; no CRM or opportunity creation.';

comment on table growth.opportunity_draft_runs is
  'Opportunity Draft Engine execution telemetry — recommendation-only.';

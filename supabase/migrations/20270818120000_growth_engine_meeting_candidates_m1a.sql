-- Growth Engine Meeting Candidates (M1-A) — Apollo → Meeting Intelligence bridge queue.
-- No autonomous scheduling, calendar writes, or outreach.

do $$
begin
  if to_regclass('growth.account_playbooks') is null then
    raise exception 'Missing dependency: growth.account_playbooks';
  end if;
  if to_regclass('growth.apollo_sequence_execution_candidates') is null then
    raise exception 'Missing dependency: growth.apollo_sequence_execution_candidates';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.meeting_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  lead_id uuid not null references growth.leads (id) on delete cascade,
  company_id uuid,
  company_candidate_id uuid,
  account_playbook_id uuid references growth.account_playbooks (id) on delete set null,
  sequence_execution_id uuid references growth.apollo_sequence_execution_candidates (id) on delete set null,
  outbound_reply_id uuid references growth.outbound_replies (id) on delete set null,
  growth_meeting_id uuid references growth.meetings (id) on delete set null,
  booking_recommendation_id uuid references growth.booking_recommendations (id) on delete set null,

  status text not null default 'pending_review'
    check (status in (
      'pending_review',
      'approved',
      'rejected',
      'scheduled',
      'completed'
    )),

  company_name text not null default '',
  lead_status text not null default '',
  reply_intent text,
  qualification_snapshot jsonb not null default '{}'::jsonb,
  committee_role_summary jsonb not null default '[]'::jsonb,
  committee_coverage_score numeric(5, 2) not null default 0,
  committee_strategy text not null default '',
  meeting_readiness_score numeric(5, 2) not null default 0,
  confidence_score numeric(5, 4) not null default 0,
  meeting_readiness_snapshot jsonb not null default '{}'::jsonb,
  booking_recommendation_candidate jsonb,
  trigger_evidence jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,

  approved_at timestamptz,
  approved_by uuid,
  approved_email text,
  rejection_note text,

  outreach_sent boolean not null default false,
  calendar_written boolean not null default false,
  meeting_scheduled boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists meeting_candidates_status_idx
  on growth.meeting_candidates (status, created_at desc);

create index if not exists meeting_candidates_lead_idx
  on growth.meeting_candidates (lead_id, created_at desc);

create index if not exists meeting_candidates_sequence_execution_idx
  on growth.meeting_candidates (sequence_execution_id, created_at desc);

create index if not exists meeting_candidates_outbound_reply_idx
  on growth.meeting_candidates (outbound_reply_id, created_at desc);

create unique index if not exists meeting_candidates_reply_pending_unique
  on growth.meeting_candidates (outbound_reply_id)
  where status = 'pending_review' and outbound_reply_id is not null;

create unique index if not exists meeting_candidates_lead_sequence_pending_unique
  on growth.meeting_candidates (lead_id, sequence_execution_id)
  where status = 'pending_review' and sequence_execution_id is not null;

create table if not exists growth.meeting_candidate_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  sequence_execution_candidate_id uuid references growth.apollo_sequence_execution_candidates (id) on delete set null,
  meeting_candidate_id uuid references growth.meeting_candidates (id) on delete set null,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial', 'skipped')),

  candidates_created integer not null default 0,
  candidates_skipped_duplicate integer not null default 0,
  candidates_skipped_no_trigger integer not null default 0,
  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  outreach_sent boolean not null default false,
  calendar_written boolean not null default false,
  meeting_scheduled boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists meeting_candidate_runs_execution_idx
  on growth.meeting_candidate_runs (execution_id, created_at desc);

grant select, insert, update, delete on growth.meeting_candidates to service_role;
grant select, insert, update, delete on growth.meeting_candidate_runs to service_role;

alter table growth.meeting_candidates enable row level security;
alter table growth.meeting_candidate_runs enable row level security;

comment on table growth.meeting_candidates is
  'Apollo Meeting Bridge (M1-A) — human-gated meeting candidates before Meeting Intelligence promotion.';

comment on table growth.meeting_candidate_runs is
  'Apollo Meeting Bridge execution telemetry — no scheduling or calendar side effects.';

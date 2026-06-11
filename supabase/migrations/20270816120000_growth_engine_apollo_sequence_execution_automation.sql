-- Growth Engine Apollo Sequence Execution Automation — materialize plans into native sequence objects, no send.

do $$
begin
  if to_regclass('growth.apollo_multichannel_sequence_candidates') is null then
    raise exception 'Missing dependency: growth.apollo_multichannel_sequence_candidates';
  end if;
end;
$$;

create table if not exists growth.apollo_sequence_execution_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  multichannel_sequence_candidate_id uuid not null references growth.apollo_multichannel_sequence_candidates (id) on delete cascade,
  voice_drop_candidate_id uuid not null,
  enrollment_candidate_id uuid not null,
  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  growth_lead_id uuid references growth.leads (id) on delete set null,

  sequence_enrollment_id uuid references growth.sequence_enrollments (id) on delete set null,

  status text not null default 'pending_draft_approval'
    check (status in (
      'pending_draft_approval',
      'execution_ready',
      'draft_rejected',
      'draft_regenerated'
    )),

  sequence_materialization jsonb not null default '{}'::jsonb,
  sequence_steps jsonb not null default '[]'::jsonb,
  draft_records jsonb not null default '[]'::jsonb,
  execution_jobs jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,
  operator_summary jsonb not null default '{}'::jsonb,

  drafts_approved_at timestamptz,
  drafts_approved_by uuid,
  drafts_approved_email text,
  draft_rejection_note text,

  outreach_sent boolean not null default false,
  voice_drop_sent boolean not null default false,
  email_sent boolean not null default false,
  sms_sent boolean not null default false,
  call_placed boolean not null default false,
  draft_created boolean not null default true,
  jobs_scheduled boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_sequence_execution_candidates_status_idx
  on growth.apollo_sequence_execution_candidates (status, created_at desc);

create index if not exists apollo_sequence_execution_candidates_multichannel_idx
  on growth.apollo_sequence_execution_candidates (multichannel_sequence_candidate_id, created_at desc);

create unique index if not exists apollo_sequence_execution_candidates_multichannel_unique
  on growth.apollo_sequence_execution_candidates (multichannel_sequence_candidate_id)
  where status in ('pending_draft_approval', 'execution_ready');

create table if not exists growth.apollo_sequence_execution_automation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  multichannel_sequence_candidate_id uuid,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial')),

  candidates_created integer not null default 0,
  candidates_skipped_duplicate integer not null default 0,
  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  outreach_sent boolean not null default false,
  voice_drop_sent boolean not null default false,
  email_sent boolean not null default false,
  sms_sent boolean not null default false,
  call_placed boolean not null default false,
  draft_created boolean not null default true,
  jobs_scheduled boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_sequence_execution_automation_runs_execution_idx
  on growth.apollo_sequence_execution_automation_runs (execution_id, created_at desc);

revoke all on table growth.apollo_sequence_execution_candidates from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_sequence_execution_candidates to service_role;
alter table growth.apollo_sequence_execution_candidates enable row level security;

revoke all on table growth.apollo_sequence_execution_automation_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_sequence_execution_automation_runs to service_role;
alter table growth.apollo_sequence_execution_automation_runs enable row level security;

comment on table growth.apollo_sequence_execution_candidates is
  'Apollo sequence execution materialization queue — native enrollments, steps, drafts, and pending-approval jobs only.';

comment on table growth.apollo_sequence_execution_automation_runs is
  'Apollo sequence execution automation audit — materialization only, no outreach.';

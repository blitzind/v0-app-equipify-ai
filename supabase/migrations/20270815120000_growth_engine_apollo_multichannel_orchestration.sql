-- Growth Engine Apollo Multi-Channel Sequence Orchestration — plans only, no send/schedule jobs.

do $$
begin
  if to_regclass('growth.apollo_voice_drop_candidates') is null then
    raise exception 'Missing dependency: growth.apollo_voice_drop_candidates';
  end if;
end;
$$;

create table if not exists growth.apollo_multichannel_sequence_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  voice_drop_candidate_id uuid not null references growth.apollo_voice_drop_candidates (id) on delete cascade,
  enrollment_candidate_id uuid not null,
  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  growth_lead_id uuid references growth.leads (id) on delete set null,

  status text not null default 'pending_sequence_approval'
    check (status in (
      'pending_sequence_approval',
      'sequence_approved',
      'sequence_rejected',
      'recommendation_regenerated'
    )),

  qualification_score numeric(5, 2) not null default 0,
  fit_score numeric(5, 2),
  orchestration_confidence numeric(5, 2) not null default 0,

  contact_snapshot jsonb not null default '{}'::jsonb,
  channel_availability jsonb not null default '{}'::jsonb,
  channel_intelligence jsonb not null default '{}'::jsonb,
  orchestration_result jsonb not null default '{}'::jsonb,
  sequence_template jsonb not null default '{}'::jsonb,
  scheduling_plan jsonb not null default '{}'::jsonb,
  operator_summary jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,

  sequence_approved_at timestamptz,
  sequence_approved_by uuid,
  sequence_approved_email text,
  sequence_rejection_note text,

  outreach_sent boolean not null default false,
  voice_drop_sent boolean not null default false,
  draft_created boolean not null default false,
  jobs_scheduled boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_multichannel_sequence_candidates_status_idx
  on growth.apollo_multichannel_sequence_candidates (status, created_at desc);

create index if not exists apollo_multichannel_sequence_candidates_voice_drop_idx
  on growth.apollo_multichannel_sequence_candidates (voice_drop_candidate_id, created_at desc);

create unique index if not exists apollo_multichannel_sequence_candidates_voice_drop_unique
  on growth.apollo_multichannel_sequence_candidates (voice_drop_candidate_id)
  where status = 'pending_sequence_approval';

create table if not exists growth.apollo_multichannel_orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  voice_drop_candidate_id uuid,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial')),

  candidates_created integer not null default 0,
  candidates_skipped_duplicate integer not null default 0,
  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  outreach_sent boolean not null default false,
  voice_drop_sent boolean not null default false,
  draft_created boolean not null default false,
  jobs_scheduled boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_multichannel_orchestration_runs_execution_idx
  on growth.apollo_multichannel_orchestration_runs (execution_id, created_at desc);

revoke all on table growth.apollo_multichannel_sequence_candidates from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_multichannel_sequence_candidates to service_role;
alter table growth.apollo_multichannel_sequence_candidates enable row level security;

revoke all on table growth.apollo_multichannel_orchestration_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_multichannel_orchestration_runs to service_role;
alter table growth.apollo_multichannel_orchestration_runs enable row level security;

comment on table growth.apollo_multichannel_sequence_candidates is
  'Multi-Channel Ready queue. Orchestration plans await explicit operator approval — no send, drafts, or job scheduling.';

comment on table growth.apollo_multichannel_orchestration_runs is
  'Apollo multi-channel orchestration audit — recommendation + scheduling plan generation only.';

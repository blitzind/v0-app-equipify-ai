-- Growth Engine Apollo Voice Drop Automation — queue + intelligence only.
-- No voicemail delivery, calls, SMS, email, or sequence drafts.

do $$
begin
  if to_regclass('growth.apollo_enrollment_candidates') is null then
    raise exception 'Missing dependency: growth.apollo_enrollment_candidates';
  end if;
end;
$$;

create table if not exists growth.apollo_voice_drop_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  enrollment_candidate_id uuid not null references growth.apollo_enrollment_candidates (id) on delete cascade,
  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  contact_candidate_id uuid references growth.contact_candidates (id) on delete set null,
  growth_lead_id uuid references growth.leads (id) on delete set null,

  status text not null default 'pending_voice_drop_approval'
    check (status in (
      'pending_voice_drop_approval',
      'voice_drop_approved',
      'voice_drop_rejected',
      'intelligence_rerun_requested'
    )),

  qualification_score numeric(5, 2) not null default 0,
  voice_drop_score numeric(5, 2) not null default 0,
  recommendation_confidence numeric(5, 2) not null default 0,

  contact_snapshot jsonb not null default '{}'::jsonb,
  channel_evaluation jsonb not null default '{}'::jsonb,
  channel_recommendations jsonb not null default '{}'::jsonb,
  multichannel_strategy jsonb not null default '{}'::jsonb,
  voice_drop_intelligence jsonb not null default '{}'::jsonb,
  voice_drop_script jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,

  voice_drop_approved_at timestamptz,
  voice_drop_approved_by uuid,
  voice_drop_approved_email text,
  voice_drop_rejection_note text,

  voice_drop_sent boolean not null default false,
  outreach_sent boolean not null default false,
  draft_created boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_voice_drop_candidates_status_idx
  on growth.apollo_voice_drop_candidates (status, created_at desc);

create index if not exists apollo_voice_drop_candidates_enrollment_idx
  on growth.apollo_voice_drop_candidates (enrollment_candidate_id, created_at desc);

create unique index if not exists apollo_voice_drop_candidates_enrollment_unique
  on growth.apollo_voice_drop_candidates (enrollment_candidate_id)
  where status = 'pending_voice_drop_approval';

create table if not exists growth.apollo_voice_drop_automation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  enrollment_candidate_id uuid,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial')),

  candidates_created integer not null default 0,
  candidates_skipped_duplicate integer not null default 0,
  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  voice_drop_sent boolean not null default false,
  outreach_sent boolean not null default false,
  draft_created boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_voice_drop_automation_runs_execution_idx
  on growth.apollo_voice_drop_automation_runs (execution_id, created_at desc);

revoke all on table growth.apollo_voice_drop_candidates from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_voice_drop_candidates to service_role;
alter table growth.apollo_voice_drop_candidates enable row level security;

revoke all on table growth.apollo_voice_drop_automation_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_voice_drop_automation_runs to service_role;
alter table growth.apollo_voice_drop_automation_runs enable row level security;

comment on table growth.apollo_voice_drop_candidates is
  'Voice Drops Ready queue. Generated from enrollment-approved candidates — no live outreach until explicit downstream execution.';

comment on table growth.apollo_voice_drop_automation_runs is
  'Apollo voice drop automation audit — intelligence + script generation only.';

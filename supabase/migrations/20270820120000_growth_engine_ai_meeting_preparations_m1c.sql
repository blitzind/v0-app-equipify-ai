-- Growth Engine AI Meeting Preparations (M1-C) — review-only prep artifacts.

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

create table if not exists growth.ai_meeting_preparations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  meeting_id uuid not null references growth.meetings (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  account_playbook_id uuid references growth.account_playbooks (id) on delete set null,
  meeting_candidate_id uuid references growth.meeting_candidates (id) on delete set null,
  source_attribution jsonb not null default '{}'::jsonb,

  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected', 'stale')),

  executive_brief text not null default '',
  meeting_objective text not null default '',
  suggested_agenda jsonb not null default '[]'::jsonb,
  stakeholder_analysis jsonb not null default '[]'::jsonb,
  likely_objections jsonb not null default '[]'::jsonb,
  discovery_questions jsonb not null default '[]'::jsonb,
  competitive_risks jsonb not null default '[]'::jsonb,
  recommended_outcome text not null default '',
  confidence_score numeric(5, 4) not null default 0,
  reasoning text not null default '',
  input_hash text,

  approved_at timestamptz,
  approved_by uuid,
  approved_email text,
  rejection_note text,

  outreach_sent boolean not null default false,
  calendar_written boolean not null default false,
  meeting_scheduled boolean not null default false,
  opportunity_created boolean not null default false,
  autonomous_reply_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_meeting_preparations_status_idx
  on growth.ai_meeting_preparations (status, created_at desc);

create index if not exists ai_meeting_preparations_meeting_idx
  on growth.ai_meeting_preparations (meeting_id, created_at desc);

create index if not exists ai_meeting_preparations_lead_idx
  on growth.ai_meeting_preparations (lead_id, created_at desc);

create unique index if not exists ai_meeting_preparations_meeting_draft_unique
  on growth.ai_meeting_preparations (meeting_id)
  where status = 'draft';

grant select, insert, update, delete on growth.ai_meeting_preparations to service_role;

alter table growth.ai_meeting_preparations enable row level security;

comment on table growth.ai_meeting_preparations is
  'AI-assisted meeting prep artifacts (M1-C) — human review only; no outreach, booking, or calendar writes.';

-- Extend ai_copilot_generations audit type for meeting prep logging.
alter table growth.ai_copilot_generations
  drop constraint if exists ai_copilot_generations_generation_type_check;

alter table growth.ai_copilot_generations
  add constraint ai_copilot_generations_generation_type_check
  check (generation_type in (
    'cold_email', 'follow_up_email', 'response_draft', 'reengagement_email', 'executive_email',
    'breakup_email', 'call_opening', 'call_objection_response', 'call_summary', 'next_message',
    'call_risk_brief', 'meeting_prep'
  ));

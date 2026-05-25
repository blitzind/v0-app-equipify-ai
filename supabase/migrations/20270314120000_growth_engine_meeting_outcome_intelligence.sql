-- Growth Engine slice 6.33A: meeting outcome intelligence + follow-up recommendations.
-- Deterministic scoring — operator controlled, no autonomous sends or CRM movement.

do $$
begin
  if to_regclass('growth.meetings') is null then
    raise exception 'Missing dependency: growth.meetings';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

create table if not exists growth.meeting_outcome_intelligence_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  meeting_id uuid not null references growth.meetings (id) on delete cascade,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  score_version text not null default 'meeting-outcome-v1',
  meeting_outcome_score int not null default 0
    check (meeting_outcome_score >= 0 and meeting_outcome_score <= 100),
  meeting_quality_score int not null default 0
    check (meeting_quality_score >= 0 and meeting_quality_score <= 100),
  next_step_confidence int not null default 0
    check (next_step_confidence >= 0 and next_step_confidence <= 100),
  follow_up_recommendation text not null default 'needs_follow_up'
    check (follow_up_recommendation in (
      'strong_opportunity',
      'needs_follow_up',
      'risk_of_stall',
      'no_show_recovery',
      'executive_escalation_recommended',
      'send_proposal_recommendation',
      'book_next_meeting_recommendation'
    )),
  buying_signal_count int not null default 0 check (buying_signal_count >= 0),
  objection_count int not null default 0 check (objection_count >= 0),
  champion_detected boolean not null default false,
  decision_maker_present boolean not null default false,
  timeline_detected boolean not null default false,
  budget_signal boolean not null default false,
  urgency_signal boolean not null default false,
  no_show_risk_pattern boolean not null default false,
  momentum_trend text not null default 'stable'
    check (momentum_trend in ('building', 'stable', 'slipping', 'at_risk')),
  recommended_next_step text not null default '',
  safe_summary text not null default '',
  score_inputs jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_meeting_outcome_scores_lead
  on growth.meeting_outcome_intelligence_scores (lead_id, computed_at desc);

create index if not exists idx_growth_meeting_outcome_scores_meeting
  on growth.meeting_outcome_intelligence_scores (meeting_id, computed_at desc);

create index if not exists idx_growth_meeting_outcome_scores_recommendation
  on growth.meeting_outcome_intelligence_scores (follow_up_recommendation, computed_at desc);

alter table growth.meetings
  add column if not exists latest_meeting_outcome_score_id uuid
    references growth.meeting_outcome_intelligence_scores (id) on delete set null;

alter table growth.meetings
  add column if not exists meeting_outcome_score int
    check (meeting_outcome_score is null or (meeting_outcome_score >= 0 and meeting_outcome_score <= 100));

alter table growth.meetings
  add column if not exists meeting_quality_score int
    check (meeting_quality_score is null or (meeting_quality_score >= 0 and meeting_quality_score <= 100));

alter table growth.meetings
  add column if not exists meeting_outcome_recommendation text;

alter table growth.meeting_outcome_intelligence_scores enable row level security;

create policy growth_meeting_outcome_intelligence_scores_service_role
  on growth.meeting_outcome_intelligence_scores
  for all
  to service_role
  using (true)
  with check (true);

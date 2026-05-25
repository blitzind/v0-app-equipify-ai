-- Growth Engine slice 6.29A: predictive deal intelligence scores.
-- Deterministic scoring + operator recommendations. No autonomous CRM movement.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.opportunities') is null then
    raise exception 'Missing dependency: growth.opportunities';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.deal_intelligence_scores
-- -----------------------------------------------------------------------------

create table if not exists growth.deal_intelligence_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid references growth.opportunities (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  score_version text not null default 'predictive-deal-v1',
  score_status text not null
    check (score_status in ('active', 'stale', 'failed')),
  close_probability int
    check (close_probability is null or (close_probability >= 0 and close_probability <= 100)),
  deal_risk_score int
    check (deal_risk_score is null or (deal_risk_score >= 0 and deal_risk_score <= 100)),
  forecast_confidence int
    check (forecast_confidence is null or (forecast_confidence >= 0 and forecast_confidence <= 100)),
  momentum_score int
    check (momentum_score is null or (momentum_score >= 0 and momentum_score <= 100)),
  engagement_score int
    check (engagement_score is null or (engagement_score >= 0 and engagement_score <= 100)),
  meeting_score int
    check (meeting_score is null or (meeting_score >= 0 and meeting_score <= 100)),
  reply_score int
    check (reply_score is null or (reply_score >= 0 and reply_score <= 100)),
  research_fit_score int
    check (research_fit_score is null or (research_fit_score >= 0 and research_fit_score <= 100)),
  followup_discipline_score int
    check (followup_discipline_score is null or (followup_discipline_score >= 0 and followup_discipline_score <= 100)),
  stage_health_score int
    check (stage_health_score is null or (stage_health_score >= 0 and stage_health_score <= 100)),
  risk_level text
    check (risk_level is null or risk_level in ('low', 'medium', 'high', 'critical')),
  predicted_close_window text
    check (predicted_close_window is null or predicted_close_window in ('this_week', 'next_14_days', 'this_month', 'next_quarter', 'unknown')),
  recommended_operator_action text
    check (
      recommended_operator_action is null
      or recommended_operator_action in (
        'call_prospect',
        'send_followup',
        'schedule_meeting',
        'update_opportunity',
        'review_research',
        'manual_review',
        'wait'
      )
    ),
  score_inputs jsonb not null default '{}'::jsonb,
  risk_factors jsonb not null default '[]'::jsonb,
  positive_signals jsonb not null default '[]'::jsonb,
  explanation text,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_deal_intelligence_scores_organization_id
  on growth.deal_intelligence_scores (organization_id);

create index if not exists idx_growth_deal_intelligence_scores_lead_id
  on growth.deal_intelligence_scores (lead_id, computed_at desc);

create index if not exists idx_growth_deal_intelligence_scores_opportunity_id
  on growth.deal_intelligence_scores (opportunity_id, computed_at desc);

create index if not exists idx_growth_deal_intelligence_scores_owner_user_id
  on growth.deal_intelligence_scores (owner_user_id, computed_at desc);

create index if not exists idx_growth_deal_intelligence_scores_risk_level
  on growth.deal_intelligence_scores (risk_level, computed_at desc);

create index if not exists idx_growth_deal_intelligence_scores_close_probability
  on growth.deal_intelligence_scores (close_probability desc, computed_at desc);

create index if not exists idx_growth_deal_intelligence_scores_computed_at
  on growth.deal_intelligence_scores (computed_at desc);

create unique index if not exists idx_growth_deal_intelligence_scores_opportunity_active
  on growth.deal_intelligence_scores (opportunity_id)
  where score_status = 'active' and opportunity_id is not null;

create unique index if not exists idx_growth_deal_intelligence_scores_lead_active_no_opp
  on growth.deal_intelligence_scores (lead_id)
  where score_status = 'active' and opportunity_id is null;

drop trigger if exists trg_growth_deal_intelligence_scores_set_updated_at on growth.deal_intelligence_scores;
create trigger trg_growth_deal_intelligence_scores_set_updated_at
before update on growth.deal_intelligence_scores
for each row execute function public.set_updated_at();

comment on table growth.deal_intelligence_scores is
  'Deterministic predictive deal intelligence for Growth Engine (slice 6.29A).';

-- -----------------------------------------------------------------------------
-- Opportunity cache columns
-- -----------------------------------------------------------------------------

alter table growth.opportunities
  add column if not exists latest_deal_intelligence_score_id uuid references growth.deal_intelligence_scores (id) on delete set null,
  add column if not exists deal_close_probability int,
  add column if not exists deal_risk_level text,
  add column if not exists deal_predicted_close_window text,
  add column if not exists deal_recommended_action text;

-- -----------------------------------------------------------------------------
-- Privileges — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.deal_intelligence_scores from public, anon, authenticated;
grant select, insert, update, delete on table growth.deal_intelligence_scores to service_role;

alter table growth.deal_intelligence_scores enable row level security;
alter table growth.deal_intelligence_scores force row level security;

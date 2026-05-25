-- Growth Engine slice 6.30A: true call intelligence scorecards.
-- Deterministic scoring from live coaching signals. No audio storage.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.realtime_call_sessions') is null then
    raise exception 'Missing dependency: growth.realtime_call_sessions';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.call_intelligence_scorecards
-- -----------------------------------------------------------------------------

create table if not exists growth.call_intelligence_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  meeting_id uuid references growth.meetings (id) on delete set null,
  realtime_session_id uuid references growth.realtime_call_sessions (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  score_version text not null default 'true-call-v1',
  overall_score int
    check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  conversation_quality_score int
    check (conversation_quality_score is null or (conversation_quality_score >= 0 and conversation_quality_score <= 100)),
  discovery_score int
    check (discovery_score is null or (discovery_score >= 0 and discovery_score <= 100)),
  objection_handling_score int
    check (objection_handling_score is null or (objection_handling_score >= 0 and objection_handling_score <= 100)),
  buying_signal_score int
    check (buying_signal_score is null or (buying_signal_score >= 0 and buying_signal_score <= 100)),
  next_step_score int
    check (next_step_score is null or (next_step_score >= 0 and next_step_score <= 100)),
  talk_listen_balance_score int
    check (talk_listen_balance_score is null or (talk_listen_balance_score >= 0 and talk_listen_balance_score <= 100)),
  competitor_risk_score int
    check (competitor_risk_score is null or (competitor_risk_score >= 0 and competitor_risk_score <= 100)),
  confidence_score int
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  risk_level text
    check (risk_level is null or risk_level in ('low', 'medium', 'high', 'critical')),
  outcome text
    check (outcome is null or outcome in ('positive', 'neutral', 'negative', 'unknown')),
  detected_objections jsonb not null default '[]'::jsonb,
  buying_signals jsonb not null default '[]'::jsonb,
  competitor_mentions jsonb not null default '[]'::jsonb,
  discovery_gaps jsonb not null default '[]'::jsonb,
  next_step_commitments jsonb not null default '[]'::jsonb,
  coaching_opportunities jsonb not null default '[]'::jsonb,
  safe_summary text,
  recommended_next_action text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  computed_at timestamptz not null default now()
);

create index if not exists idx_growth_call_intelligence_scorecards_organization_id
  on growth.call_intelligence_scorecards (organization_id);

create index if not exists idx_growth_call_intelligence_scorecards_lead_id
  on growth.call_intelligence_scorecards (lead_id, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_opportunity_id
  on growth.call_intelligence_scorecards (opportunity_id, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_meeting_id
  on growth.call_intelligence_scorecards (meeting_id, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_realtime_session_id
  on growth.call_intelligence_scorecards (realtime_session_id, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_owner_user_id
  on growth.call_intelligence_scorecards (owner_user_id, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_risk_level
  on growth.call_intelligence_scorecards (risk_level, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_overall_score
  on growth.call_intelligence_scorecards (overall_score desc, computed_at desc);

create index if not exists idx_growth_call_intelligence_scorecards_computed_at
  on growth.call_intelligence_scorecards (computed_at desc);

create unique index if not exists idx_growth_call_intelligence_scorecards_session_unique
  on growth.call_intelligence_scorecards (realtime_session_id)
  where realtime_session_id is not null;

comment on table growth.call_intelligence_scorecards is
  'Deterministic call intelligence scorecards (slice 6.30A). Safe labels only — no transcript text.';

revoke all on table growth.call_intelligence_scorecards from public, anon, authenticated;
grant select, insert, update, delete on table growth.call_intelligence_scorecards to service_role;

alter table growth.call_intelligence_scorecards enable row level security;
alter table growth.call_intelligence_scorecards force row level security;

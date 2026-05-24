-- Growth Engine Slice 6.13B — Live Coaching session insights rollup (recomputable from timeline).

do $$
begin
  if to_regclass('growth.realtime_call_sessions') is null then
    raise exception 'Missing dependency: growth.realtime_call_sessions';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.realtime_call_session_insights (
  session_id uuid primary key references growth.realtime_call_sessions (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  session_duration_ms int not null default 0 check (session_duration_ms >= 0),
  provider_id text,
  transcript_finalized_count int not null default 0 check (transcript_finalized_count >= 0),
  guidance_generated_count int not null default 0 check (guidance_generated_count >= 0),
  objection_count int not null default 0 check (objection_count >= 0),
  buying_signal_count int not null default 0 check (buying_signal_count >= 0),
  discovery_gap_count int not null default 0 check (discovery_gap_count >= 0),
  competitor_pressure_count int not null default 0 check (competitor_pressure_count >= 0),
  provider_interruptions int not null default 0 check (provider_interruptions >= 0),
  reconnect_attempts int not null default 0 check (reconnect_attempts >= 0),
  retry_attempts int not null default 0 check (retry_attempts >= 0),
  fallback_count int not null default 0 check (fallback_count >= 0),
  average_transcript_latency_ms int not null default 0 check (average_transcript_latency_ms >= 0),
  max_transcript_latency_ms int not null default 0 check (max_transcript_latency_ms >= 0),
  session_health_score int not null default 0
    check (session_health_score >= 0 and session_health_score <= 100),
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_realtime_call_session_insights_lead_computed
  on growth.realtime_call_session_insights (lead_id, computed_at desc);

create index if not exists idx_realtime_call_session_insights_risk_computed
  on growth.realtime_call_session_insights (risk_level, computed_at desc);

revoke all on table growth.realtime_call_session_insights from public, anon, authenticated;
grant select, insert, update on table growth.realtime_call_session_insights to service_role;
alter table growth.realtime_call_session_insights enable row level security;
alter table growth.realtime_call_session_insights force row level security;

-- Growth Engine slice 6.11A: Realtime transcript provider connections.

do $$
begin
  if to_regclass('growth.realtime_call_sessions') is null then
    raise exception 'Missing dependency: growth.realtime_call_sessions';
  end if;
  if to_regclass('growth.copilot_settings') is null then
    raise exception 'Missing dependency: growth.copilot_settings';
  end if;
end;
$$;

create table if not exists growth.realtime_provider_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('deepgram', 'assemblyai', 'openai_realtime', 'custom')),
  label text not null,
  status text not null default 'inactive'
    check (status in ('inactive', 'connecting', 'connected', 'error')),
  config_json jsonb not null default '{}'::jsonb,
  credentials_encrypted text,
  health_status text not null default 'unknown'
    check (health_status in ('unknown', 'healthy', 'degraded', 'unhealthy')),
  last_health_check timestamptz,
  last_error text,
  capability_snapshot jsonb not null default '{}'::jsonb,
  average_latency_ms int not null default 0 check (average_latency_ms >= 0),
  transcript_quality_score int not null default 0 check (transcript_quality_score >= 0 and transcript_quality_score <= 100),
  provider_failover_count int not null default 0 check (provider_failover_count >= 0),
  provider_disconnect_count int not null default 0 check (provider_disconnect_count >= 0),
  provider_recovery_attempt_count int not null default 0 check (provider_recovery_attempt_count >= 0),
  provider_recovery_success_count int not null default 0 check (provider_recovery_success_count >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_realtime_provider_connections_provider_status
  on growth.realtime_provider_connections (provider, status);

create index if not exists idx_realtime_provider_connections_health
  on growth.realtime_provider_connections (health_status, updated_at desc);

revoke all on table growth.realtime_provider_connections from public, anon, authenticated;
grant select, insert, update, delete on table growth.realtime_provider_connections to service_role;
alter table growth.realtime_provider_connections enable row level security;
alter table growth.realtime_provider_connections force row level security;

alter table growth.realtime_call_sessions
  add column if not exists realtime_provider_connection_id uuid
    references growth.realtime_provider_connections (id) on delete set null,
  add column if not exists provider_id text,
  add column if not exists transcript_source text not null default 'manual'
    check (transcript_source in ('manual', 'stub', 'provider')),
  add column if not exists transcript_quality_score int not null default 0
    check (transcript_quality_score >= 0 and transcript_quality_score <= 100),
  add column if not exists guidance_latency_ms int not null default 0
    check (guidance_latency_ms >= 0),
  add column if not exists session_provider_failover_count int not null default 0
    check (session_provider_failover_count >= 0);

alter table growth.copilot_settings
  add column if not exists live_coaching_active_provider_connection_id uuid
    references growth.realtime_provider_connections (id) on delete set null,
  add column if not exists live_coaching_fallback_provider text not null default 'stub',
  add column if not exists live_coaching_speaker_separation_enabled boolean not null default false,
  add column if not exists live_coaching_keyword_events_enabled boolean not null default false,
  add column if not exists live_coaching_transcript_confidence_threshold int not null default 70
    check (live_coaching_transcript_confidence_threshold >= 0 and live_coaching_transcript_confidence_threshold <= 100),
  add column if not exists live_coaching_custom_keywords jsonb not null default '[]'::jsonb,
  add column if not exists live_coaching_industry_profile jsonb not null default '{}'::jsonb,
  add column if not exists live_coaching_critical_guidance_threshold int not null default 85
    check (live_coaching_critical_guidance_threshold >= 0 and live_coaching_critical_guidance_threshold <= 100),
  add column if not exists live_coaching_normal_guidance_threshold int not null default 70
    check (live_coaching_normal_guidance_threshold >= 0 and live_coaching_normal_guidance_threshold <= 100);

-- Growth Engine Slice 6.13A — Live Coaching session timeline + replay diagnostics (metrics only).

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

create table if not exists growth.realtime_call_session_timeline_events (
  id uuid primary key,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  session_id uuid not null references growth.realtime_call_sessions (id) on delete cascade,
  sequence_number int not null check (sequence_number >= 0),
  event_type text not null check (
    event_type in (
      'session_started',
      'mic_permission_granted',
      'mic_permission_denied',
      'provider_connecting',
      'provider_connected',
      'provider_degraded',
      'provider_disconnected',
      'provider_fallback_activated',
      'transcript_chunk_received',
      'transcript_finalized',
      'guidance_generated',
      'objection_detected',
      'buying_signal_detected',
      'competitor_pressure_detected',
      'discovery_gap_detected',
      'momentum_change',
      'execution_score_change',
      'provider_retry',
      'circuit_breaker_triggered',
      'session_paused',
      'session_resumed',
      'session_stopped',
      'session_completed',
      'session_discarded'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  provider_id text,
  detail jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number),
  unique (session_id, dedupe_key)
);

create index if not exists idx_realtime_call_session_timeline_events_session_created
  on growth.realtime_call_session_timeline_events (session_id, created_at asc);

create index if not exists idx_realtime_call_session_timeline_events_lead_created
  on growth.realtime_call_session_timeline_events (lead_id, created_at desc);

create index if not exists idx_realtime_call_session_timeline_events_type_created
  on growth.realtime_call_session_timeline_events (event_type, created_at desc);

revoke all on table growth.realtime_call_session_timeline_events from public, anon, authenticated;
grant select, insert on table growth.realtime_call_session_timeline_events to service_role;
alter table growth.realtime_call_session_timeline_events enable row level security;
alter table growth.realtime_call_session_timeline_events force row level security;

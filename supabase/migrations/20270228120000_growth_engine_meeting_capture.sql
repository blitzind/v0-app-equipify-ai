-- Growth Engine Slice 6.21A — Browser system audio + meeting capture (no audio storage).

do $$
begin
  if to_regclass('growth.realtime_call_sessions') is null then
    raise exception 'Missing dependency: growth.realtime_call_sessions';
  end if;
  if to_regclass('growth.realtime_call_session_timeline_events') is null then
    raise exception 'Missing dependency: growth.realtime_call_session_timeline_events';
  end if;
  if to_regclass('growth.realtime_call_session_insights') is null then
    raise exception 'Missing dependency: growth.realtime_call_session_insights';
  end if;
end;
$$;

alter table growth.realtime_call_sessions
  add column if not exists meeting_capture_mode text,
  add column if not exists meeting_provider text,
  add column if not exists mixed_audio_enabled boolean not null default false,
  add column if not exists meeting_audio_active boolean not null default false,
  add column if not exists microphone_active boolean not null default false;

alter table growth.realtime_call_sessions
  drop constraint if exists realtime_call_sessions_meeting_capture_mode_check;

alter table growth.realtime_call_sessions
  add constraint realtime_call_sessions_meeting_capture_mode_check
  check (
    meeting_capture_mode is null
    or meeting_capture_mode in ('microphone', 'browser_tab', 'mixed_audio', 'meeting_mode')
  );

alter table growth.realtime_call_sessions
  drop constraint if exists realtime_call_sessions_meeting_provider_check;

alter table growth.realtime_call_sessions
  add constraint realtime_call_sessions_meeting_provider_check
  check (
    meeting_provider is null
    or meeting_provider in ('google_meet', 'zoom_web', 'microsoft_teams_web', 'generic_browser_audio')
  );

alter table growth.realtime_call_sessions
  drop constraint if exists realtime_call_sessions_transcript_source_check;

alter table growth.realtime_call_sessions
  add constraint realtime_call_sessions_transcript_source_check
  check (transcript_source in ('manual', 'stub', 'provider', 'browser_mic', 'meeting_audio'));

alter table growth.realtime_call_session_timeline_events
  drop constraint if exists realtime_call_session_timeline_events_event_type_check;

alter table growth.realtime_call_session_timeline_events
  add constraint realtime_call_session_timeline_events_event_type_check
  check (
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
      'session_discarded',
      'meeting_capture_started',
      'meeting_capture_stopped',
      'meeting_provider_detected',
      'mixed_audio_enabled',
      'meeting_audio_permission_denied',
      'meeting_capture_failed'
    )
  );

alter table growth.realtime_call_session_insights
  add column if not exists meeting_mode_used boolean not null default false,
  add column if not exists meeting_provider text,
  add column if not exists mixed_audio_used boolean not null default false,
  add column if not exists meeting_capture_failures int not null default 0
    check (meeting_capture_failures >= 0);

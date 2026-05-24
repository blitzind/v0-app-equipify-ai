-- Growth Engine Slice 6.12A — Browser audio capture bridge (no audio storage)

alter table growth.realtime_call_sessions
  add column if not exists browser_audio_capture_enabled boolean not null default false,
  add column if not exists browser_audio_capture_status text not null default 'inactive',
  add column if not exists browser_audio_started_at timestamptz,
  add column if not exists browser_audio_ended_at timestamptz,
  add column if not exists browser_audio_error text;

comment on column growth.realtime_call_sessions.browser_audio_capture_status is
  'inactive|requesting|active|paused|stopped|failed';

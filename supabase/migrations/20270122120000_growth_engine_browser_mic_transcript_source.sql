-- Growth Engine Slice 6.12B — allow browser_mic transcript source for live provider streaming

alter table growth.realtime_call_sessions
  drop constraint if exists realtime_call_sessions_transcript_source_check;

alter table growth.realtime_call_sessions
  add constraint realtime_call_sessions_transcript_source_check
  check (transcript_source in ('manual', 'stub', 'provider', 'browser_mic'));

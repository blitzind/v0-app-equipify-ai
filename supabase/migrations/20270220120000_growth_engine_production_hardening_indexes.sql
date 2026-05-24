-- Growth Engine Slice 6.14A — Production hardening indexes for live coaching queries.

create index if not exists idx_realtime_call_session_insights_computed_at
  on growth.realtime_call_session_insights (computed_at asc);

create index if not exists idx_realtime_call_session_insights_provider_computed
  on growth.realtime_call_session_insights (provider_id, computed_at desc);

create index if not exists idx_realtime_call_session_insights_risk_provider_computed
  on growth.realtime_call_session_insights (risk_level, provider_id, computed_at desc);

create index if not exists idx_realtime_call_session_timeline_events_session_sequence
  on growth.realtime_call_session_timeline_events (session_id, sequence_number asc);

create index if not exists idx_realtime_provider_lifecycle_events_session_created
  on growth.realtime_provider_lifecycle_events (session_id, created_at desc)
  where session_id is not null;

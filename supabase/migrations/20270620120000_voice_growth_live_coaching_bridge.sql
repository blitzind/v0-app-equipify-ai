-- Voice → Growth live coaching bridge: idempotent transcript + guidance dedupe keys.

do $$
begin
  if to_regclass('growth.realtime_call_transcript_events') is null then
    raise exception 'Missing dependency: growth.realtime_call_transcript_events';
  end if;
  if to_regclass('voice.voice_transcript_segments') is null then
    raise exception 'Missing dependency: voice.voice_transcript_segments';
  end if;
  if to_regclass('growth.live_guidance_events') is null then
    raise exception 'Missing dependency: growth.live_guidance_events';
  end if;
end;
$$;

alter table growth.realtime_call_transcript_events
  add column if not exists source_voice_segment_id uuid references voice.voice_transcript_segments (id) on delete cascade;

create unique index if not exists idx_realtime_call_transcript_events_voice_segment
  on growth.realtime_call_transcript_events (source_voice_segment_id)
  where source_voice_segment_id is not null;

alter table growth.live_guidance_events
  add column if not exists dedupe_key text;

create index if not exists idx_live_guidance_events_session_dedupe_active
  on growth.live_guidance_events (realtime_call_session_id, dedupe_key)
  where dismissed_at is null and accepted_at is null;

comment on column growth.realtime_call_transcript_events.source_voice_segment_id is
  'When set, row was bridged from voice.voice_transcript_segments (idempotent ingest).';

comment on column growth.live_guidance_events.dedupe_key is
  'Stable key for live guidance supersession and stale-card retirement.';

-- Growth Engine S2-D — Media asset playback analytics (events + rollups).
-- Local migration only until explicitly approved for production apply.
-- No public playback, notifications, sequence wake, or autonomous tracking without token.

do $$
begin
  if to_regclass('growth.media_assets') is null then
    raise exception 'Missing dependency: growth.media_assets (apply S1.5 migration first)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.media_asset_events
-- -----------------------------------------------------------------------------

create table if not exists growth.media_asset_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  asset_id uuid not null references growth.media_assets (id) on delete cascade,
  relationship_id uuid,
  event_type text not null
    check (event_type in (
      'video_viewed', 'video_play_started', 'video_progress', 'video_completed',
      'video_paused', 'video_replayed', 'video_cta_clicked'
    )),
  lead_id uuid,
  share_page_id uuid,
  template_id uuid,
  sequence_id uuid,
  session_id text not null,
  anonymous_id_hash text,
  event_timestamp timestamptz not null default now(),
  progress_seconds numeric(12, 3) check (progress_seconds is null or progress_seconds >= 0),
  progress_percent numeric(5, 2) check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  duration_seconds numeric(12, 3) check (duration_seconds is null or duration_seconds >= 0),
  cta_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-media-playback-analytics-s2d-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_media_asset_events_organization
  on growth.media_asset_events (organization_id, event_timestamp desc);

create index if not exists idx_growth_media_asset_events_asset_id
  on growth.media_asset_events (asset_id, event_timestamp desc);

create index if not exists idx_growth_media_asset_events_event_type
  on growth.media_asset_events (event_type, event_timestamp desc);

create index if not exists idx_growth_media_asset_events_session
  on growth.media_asset_events (session_id, event_timestamp desc);

comment on table growth.media_asset_events is
  'S2-D media playback analytics events — persistence only; no notifications or sequence side effects.';

-- -----------------------------------------------------------------------------
-- growth.media_asset_event_rollups
-- -----------------------------------------------------------------------------

create table if not exists growth.media_asset_event_rollups (
  asset_id uuid primary key references growth.media_assets (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  views bigint not null default 0 check (views >= 0),
  unique_views bigint not null default 0 check (unique_views >= 0),
  play_starts bigint not null default 0 check (play_starts >= 0),
  completions bigint not null default 0 check (completions >= 0),
  completion_rate numeric(6, 4) not null default 0 check (completion_rate >= 0 and completion_rate <= 1),
  average_watch_seconds numeric(12, 3) not null default 0 check (average_watch_seconds >= 0),
  cta_clicks bigint not null default 0 check (cta_clicks >= 0),
  last_event_at timestamptz,
  qa_marker text not null default 'growth-media-playback-analytics-s2d-v1',
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_media_asset_event_rollups_organization
  on growth.media_asset_event_rollups (organization_id, updated_at desc);

comment on table growth.media_asset_event_rollups is
  'S2-D denormalized playback rollups per media asset — recomputed on ingest.';

drop trigger if exists trg_growth_media_asset_event_rollups_updated_at on growth.media_asset_event_rollups;
create trigger trg_growth_media_asset_event_rollups_updated_at
  before update on growth.media_asset_event_rollups
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

alter table growth.media_asset_events enable row level security;
alter table growth.media_asset_events force row level security;

alter table growth.media_asset_event_rollups enable row level security;
alter table growth.media_asset_event_rollups force row level security;

revoke all on growth.media_asset_events from public, anon, authenticated;
revoke all on growth.media_asset_event_rollups from public, anon, authenticated;

grant select, insert, update, delete on growth.media_asset_events to service_role;
grant select, insert, update, delete on growth.media_asset_event_rollups to service_role;

drop policy if exists growth_media_asset_events_service_role on growth.media_asset_events;
create policy growth_media_asset_events_service_role
  on growth.media_asset_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists growth_media_asset_event_rollups_service_role on growth.media_asset_event_rollups;
create policy growth_media_asset_event_rollups_service_role
  on growth.media_asset_event_rollups
  for all
  to service_role
  using (true)
  with check (true);

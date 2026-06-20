-- Growth Engine GS-SENDR-2A — Personalized Media Runtime Foundation.
-- Operator-initiated metadata registry only. No workers, no autonomous generation.

do $$
begin
  if to_regclass('growth.runtime_guardrail_settings') is null then
    raise exception 'Missing dependency: growth.runtime_guardrail_settings (apply GS-RG-1 first)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Phase 1 — Media Asset Registry
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid not null,
  asset_type text not null
    check (asset_type in ('page', 'video', 'avatar_video', 'voice', 'calendar', 'cta', 'conversation_agent')),
  name text not null,
  slug text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_version_id uuid,
  legacy_media_asset_id uuid,
  legacy_share_page_id uuid,
  legacy_video_asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_media_assets_org
  on growth.growth_media_assets (organization_id, created_at desc)
  where deleted_at is null;

create table if not exists growth.growth_media_asset_versions (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references growth.growth_media_assets (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  is_immutable boolean not null default false,
  storage_metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_asset_id, version_number)
);

create table if not exists growth.growth_media_asset_access_logs (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references growth.growth_media_assets (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  access_kind text not null check (access_kind in ('read', 'write', 'publish', 'archive')),
  actor_user_id uuid,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_media_asset_access_logs_asset
  on growth.growth_media_asset_access_logs (media_asset_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Phase 2 — Landing Page Runtime
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_landing_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid not null,
  media_asset_id uuid references growth.growth_media_assets (id) on delete set null,
  lead_id uuid,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  variable_map jsonb not null default '{}'::jsonb,
  mobile_metadata jsonb not null default '{}'::jsonb,
  legacy_share_page_id uuid,
  deleted_at timestamptz,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_landing_pages_org
  on growth.growth_landing_pages (organization_id, status, created_at desc)
  where deleted_at is null;

create table if not exists growth.growth_landing_page_sections (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references growth.growth_landing_pages (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  section_type text not null
    check (section_type in ('hero', 'text', 'video', 'calendar', 'cta', 'faq', 'custom_html')),
  sort_order integer not null default 0 check (sort_order >= 0),
  content jsonb not null default '{}'::jsonb,
  variable_placeholders jsonb not null default '[]'::jsonb,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_landing_page_sections_page
  on growth.growth_landing_page_sections (landing_page_id, sort_order);

create table if not exists growth.growth_landing_page_publications (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references growth.growth_landing_pages (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_snapshot jsonb not null default '{}'::jsonb,
  published_by uuid,
  published_at timestamptz not null default now(),
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_landing_page_publications_page
  on growth.growth_landing_page_publications (landing_page_id, published_at desc);

-- -----------------------------------------------------------------------------
-- Phase 4 — Recorded Video Runtime (metadata only)
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_video_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid not null,
  media_asset_id uuid references growth.growth_media_assets (id) on delete set null,
  source_url text,
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  poster_url text,
  transcript_status text not null default 'none'
    check (transcript_status in ('none', 'pending', 'ready', 'failed')),
  captions_status text not null default 'none'
    check (captions_status in ('none', 'pending', 'ready', 'failed')),
  legacy_video_asset_id uuid,
  deleted_at timestamptz,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_video_assets_org
  on growth.growth_video_assets (organization_id, created_at desc)
  where deleted_at is null;

create table if not exists growth.growth_video_asset_events (
  id uuid primary key default gen_random_uuid(),
  video_asset_id uuid not null references growth.growth_video_assets (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id text not null,
  event_type text not null
    check (event_type in ('video_start', 'video_progress', 'video_complete')),
  progress_pct numeric check (progress_pct is null or (progress_pct >= 0 and progress_pct <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_video_asset_events_session
  on growth.growth_video_asset_events (video_asset_id, session_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Phase 5 — Conversational Agent Registry (metadata only)
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_conversation_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid not null,
  media_asset_id uuid references growth.growth_media_assets (id) on delete set null,
  name text not null,
  provider text not null default 'retell',
  published boolean not null default false,
  published_version_id uuid,
  booking_enabled boolean not null default false,
  deleted_at timestamptz,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.growth_conversation_agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references growth.growth_conversation_agents (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  system_prompt text,
  voice_provider text,
  voice_id text,
  knowledge_sources jsonb not null default '[]'::jsonb,
  booking_enabled boolean not null default false,
  is_immutable boolean not null default false,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, version_number)
);

-- -----------------------------------------------------------------------------
-- Phase 6 — Booking Runtime
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_booking_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid not null,
  media_asset_id uuid references growth.growth_media_assets (id) on delete set null,
  meeting_link text,
  meeting_type text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  timezone text,
  calendar_provider text check (calendar_provider is null or calendar_provider in ('google', 'outlook', 'manual')),
  legacy_booking_page_id uuid,
  deleted_at timestamptz,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_booking_assets_org
  on growth.growth_booking_assets (organization_id, owner_user_id)
  where deleted_at is null;

create table if not exists growth.growth_booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_asset_id uuid not null references growth.growth_booking_assets (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id text not null,
  event_type text not null
    check (event_type in ('calendar_open', 'booking_started', 'booking_completed')),
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_booking_events_asset
  on growth.growth_booking_events (booking_asset_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Phase 7 — Unified Engagement Events
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_engagement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id text not null,
  landing_page_id uuid references growth.growth_landing_pages (id) on delete set null,
  video_asset_id uuid references growth.growth_video_assets (id) on delete set null,
  booking_asset_id uuid references growth.growth_booking_assets (id) on delete set null,
  conversation_agent_id uuid references growth.growth_conversation_agents (id) on delete set null,
  event_type text not null
    check (event_type in (
      'page_view', 'scroll', 'video_start', 'video_progress', 'video_complete',
      'cta_click', 'calendar_open', 'booking_started', 'booking_completed',
      'agent_opened', 'agent_question', 'agent_completed'
    )),
  event_value jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_engagement_events_org_day
  on growth.growth_engagement_events (organization_id, created_at desc);

create index if not exists idx_growth_engagement_events_session
  on growth.growth_engagement_events (session_id, created_at desc);

create table if not exists growth.growth_engagement_event_rollups (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rollup_date date not null,
  event_type text not null,
  event_count bigint not null default 0 check (event_count >= 0),
  last_event_at timestamptz,
  qa_marker text not null default 'growth-personalized-media-runtime-gs-sendr-2a-v1',
  updated_at timestamptz not null default now(),
  primary key (organization_id, rollup_date, event_type)
);

-- -----------------------------------------------------------------------------
-- Kill switches
-- -----------------------------------------------------------------------------

insert into growth.runtime_guardrail_settings (key, enabled, value_json)
values
  ('media_assets_enabled', true, '{}'::jsonb),
  ('landing_pages_enabled', true, '{}'::jsonb),
  ('video_tracking_enabled', true, '{}'::jsonb),
  ('agent_tracking_enabled', true, '{}'::jsonb),
  ('booking_tracking_enabled', true, '{}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'growth_media_assets',
    'growth_media_asset_versions',
    'growth_media_asset_access_logs',
    'growth_landing_pages',
    'growth_landing_page_sections',
    'growth_landing_page_publications',
    'growth_video_assets',
    'growth_video_asset_events',
    'growth_conversation_agents',
    'growth_conversation_agent_versions',
    'growth_booking_assets',
    'growth_booking_events',
    'growth_engagement_events',
    'growth_engagement_event_rollups'
  ]
  loop
    execute format('alter table growth.%I enable row level security', tbl);
    execute format('alter table growth.%I force row level security', tbl);
    execute format('revoke all on growth.%I from public, anon, authenticated', tbl);
    execute format('grant all on growth.%I to service_role', tbl);
  end loop;
end;
$$;

-- Growth Engine A1 — Video Recording Studio foundation.
-- Human-gated workspace only — no autonomous outreach or enrollment execution.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.video_assets
-- -----------------------------------------------------------------------------

create table if not exists growth.video_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null default '',
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'archived', 'failed')),
  source_type text not null default 'upload'
    check (source_type in ('webcam', 'screen', 'screen_webcam', 'upload', 'ai_generated')),
  duration_seconds numeric(12, 3) check (duration_seconds is null or duration_seconds >= 0),
  storage_provider text
    check (storage_provider is null or storage_provider in ('supabase_storage', 's3', 'cloudflare_r2', 'custom')),
  storage_path text,
  thumbnail_path text,
  transcript_status text not null default 'not_started'
    check (transcript_status in ('not_started', 'pending', 'processing', 'ready', 'failed')),
  captions_status text not null default 'not_started'
    check (captions_status in ('not_started', 'pending', 'processing', 'ready', 'failed')),
  metadata_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-video-foundation-a1-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_video_assets_org_updated
  on growth.video_assets (organization_id, updated_at desc);

create index if not exists idx_growth_video_assets_org_status
  on growth.video_assets (organization_id, status, updated_at desc);

-- -----------------------------------------------------------------------------
-- growth.video_templates
-- -----------------------------------------------------------------------------

create table if not exists growth.video_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  thumbnail_path text,
  configuration_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-video-foundation-a1-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_video_templates_org_updated
  on growth.video_templates (organization_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- growth.video_views
-- -----------------------------------------------------------------------------

create table if not exists growth.video_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  video_asset_id uuid not null references growth.video_assets (id) on delete cascade,
  visitor_identifier text,
  session_id text,
  watched_seconds numeric(12, 3) not null default 0 check (watched_seconds >= 0),
  percent_watched numeric(5, 2) not null default 0 check (percent_watched >= 0 and percent_watched <= 100),
  cta_clicked boolean not null default false,
  meeting_booked boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-video-foundation-a1-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_video_views_asset_created
  on growth.video_views (video_asset_id, created_at desc);

create index if not exists idx_growth_video_views_org_created
  on growth.video_views (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_video_assets_updated_at on growth.video_assets;
create trigger trg_growth_video_assets_updated_at
  before update on growth.video_assets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_video_templates_updated_at on growth.video_templates;
create trigger trg_growth_video_templates_updated_at
  before update on growth.video_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + grants (Growth Engine service-role pattern)
-- -----------------------------------------------------------------------------

alter table growth.video_assets enable row level security;
alter table growth.video_assets force row level security;
alter table growth.video_templates enable row level security;
alter table growth.video_templates force row level security;
alter table growth.video_views enable row level security;
alter table growth.video_views force row level security;

grant select, insert, update, delete on growth.video_assets to service_role;
grant select, insert, update, delete on growth.video_templates to service_role;
grant select, insert, update, delete on growth.video_views to service_role;

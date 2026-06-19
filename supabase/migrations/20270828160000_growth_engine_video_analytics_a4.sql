-- Growth Engine A4 — Video analytics & engagement intelligence.
-- Aggregates A3 page events into engagement summaries — no autonomous follow-up.

do $$
begin
  if to_regclass('growth.video_assets') is null then
    raise exception 'Missing dependency: growth.video_assets';
  end if;
  if to_regclass('growth.video_pages') is null then
    raise exception 'Missing dependency: growth.video_pages';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.video_engagement_summaries
-- -----------------------------------------------------------------------------

create table if not exists growth.video_engagement_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  video_asset_id uuid not null references growth.video_assets (id) on delete cascade,
  video_page_id uuid not null references growth.video_pages (id) on delete cascade,
  visitor_identifier text,
  session_id text not null,
  total_views integer not null default 0 check (total_views >= 0),
  total_watch_seconds integer not null default 0 check (total_watch_seconds >= 0),
  highest_percent_watched numeric(5, 2) not null default 0 check (highest_percent_watched >= 0),
  total_cta_clicks integer not null default 0 check (total_cta_clicks >= 0),
  total_calendar_clicks integer not null default 0 check (total_calendar_clicks >= 0),
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  engagement_score integer not null default 0 check (engagement_score >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-video-analytics-a4-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, video_page_id, session_id)
);

create index if not exists idx_growth_video_engagement_summaries_org_updated
  on growth.video_engagement_summaries (organization_id, updated_at desc);

create index if not exists idx_growth_video_engagement_summaries_org_asset
  on growth.video_engagement_summaries (organization_id, video_asset_id, updated_at desc);

create index if not exists idx_growth_video_engagement_summaries_org_page
  on growth.video_engagement_summaries (organization_id, video_page_id, updated_at desc);

create index if not exists idx_growth_video_engagement_summaries_org_visitor
  on growth.video_engagement_summaries (organization_id, visitor_identifier, updated_at desc)
  where visitor_identifier is not null;

create index if not exists idx_growth_video_engagement_summaries_org_session
  on growth.video_engagement_summaries (organization_id, session_id, updated_at desc);

comment on table growth.video_engagement_summaries is
  'Session-level video page engagement rollups — AI-consumable scores and signals; no automation triggers.';

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_video_engagement_summaries_updated_at on growth.video_engagement_summaries;
create trigger trg_growth_video_engagement_summaries_updated_at
  before update on growth.video_engagement_summaries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + grants (Growth Engine service-role pattern)
-- -----------------------------------------------------------------------------

alter table growth.video_engagement_summaries enable row level security;
alter table growth.video_engagement_summaries force row level security;

revoke all on table growth.video_engagement_summaries from public, anon, authenticated;
grant select, insert, update, delete on growth.video_engagement_summaries to service_role;

create policy growth_video_engagement_summaries_service_role
  on growth.video_engagement_summaries for all to service_role using (true) with check (true);

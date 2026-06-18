-- Growth Engine A3 — Personalized video pages foundation.
-- Human-gated publishing — public pages render only when published.

do $$
begin
  if to_regclass('growth.video_assets') is null then
    raise exception 'Missing dependency: growth.video_assets';
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
-- growth.video_pages
-- -----------------------------------------------------------------------------

create table if not exists growth.video_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  video_asset_id uuid not null references growth.video_assets (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null,
  slug text not null,
  title text not null default '',
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  cta_label text,
  cta_url text,
  calendar_url text,
  branding_json jsonb not null default '{}'::jsonb,
  personalization_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  qa_marker text not null default 'growth-video-pages-a3-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists idx_growth_video_pages_org_status_updated
  on growth.video_pages (organization_id, status, updated_at desc);

create index if not exists idx_growth_video_pages_org_slug
  on growth.video_pages (organization_id, slug);

create index if not exists idx_growth_video_pages_asset
  on growth.video_pages (video_asset_id);

create index if not exists idx_growth_video_pages_published_slug
  on growth.video_pages (slug)
  where status = 'published';

comment on table growth.video_pages is
  'Branded shareable video pages — draft/published/archived; slug unique per organization.';

-- -----------------------------------------------------------------------------
-- growth.video_page_events
-- -----------------------------------------------------------------------------

create table if not exists growth.video_page_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  video_page_id uuid not null references growth.video_pages (id) on delete cascade,
  video_asset_id uuid not null references growth.video_assets (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'page_view', 'video_play', 'video_progress', 'video_complete', 'cta_click', 'calendar_click'
    )),
  visitor_identifier text,
  session_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_video_page_events_page_created
  on growth.video_page_events (video_page_id, created_at desc);

create index if not exists idx_growth_video_page_events_org_created
  on growth.video_page_events (organization_id, created_at desc);

create index if not exists idx_growth_video_page_events_asset_created
  on growth.video_page_events (video_asset_id, created_at desc);

comment on table growth.video_page_events is
  'Public-safe video page engagement events — no PII beyond optional hashed visitor id.';

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_video_pages_updated_at on growth.video_pages;
create trigger trg_growth_video_pages_updated_at
  before update on growth.video_pages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + grants (Growth Engine service-role pattern)
-- -----------------------------------------------------------------------------

alter table growth.video_pages enable row level security;
alter table growth.video_pages force row level security;
alter table growth.video_page_events enable row level security;
alter table growth.video_page_events force row level security;

revoke all on table growth.video_pages from public, anon, authenticated;
revoke all on table growth.video_page_events from public, anon, authenticated;

grant select, insert, update, delete on growth.video_pages to service_role;
grant select, insert, update, delete on growth.video_page_events to service_role;

create policy growth_video_pages_service_role
  on growth.video_pages for all to service_role using (true) with check (true);

create policy growth_video_page_events_service_role
  on growth.video_page_events for all to service_role using (true) with check (true);

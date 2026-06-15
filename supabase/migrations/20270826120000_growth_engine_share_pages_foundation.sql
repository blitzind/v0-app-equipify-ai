-- Growth Engine SR-2B-1 — Personalized Share Pages foundation.
-- Tokenized per-lead pages. Human-gated publish only — no autonomous outreach.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.share_pages
-- -----------------------------------------------------------------------------

create table if not exists growth.share_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  company_id uuid references growth.companies (id) on delete set null,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  enrollment_id uuid references growth.sequence_enrollments (id) on delete set null,
  sequence_step_id uuid,
  sequence_execution_job_id uuid references growth.sequence_execution_jobs (id) on delete set null,
  source_channel text not null default 'manual'
    check (source_channel in (
      'email', 'sms', 'voice', 'call', 'linkedin', 'sequence', 'manual', 'other'
    )),

  status text not null default 'draft'
    check (status in (
      'draft', 'pending_review', 'published', 'expired', 'revoked', 'archived'
    )),

  token_hash text not null,
  token_prefix text not null check (char_length(token_prefix) >= 6),
  preview_token_hash text not null,

  published_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  archived_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  max_views int check (max_views is null or max_views > 0),

  engagement_summary jsonb not null default '{}'::jsonb,

  personalization_snapshot jsonb not null default '{}'::jsonb,
  personalization_context_version int not null default 1 check (personalization_context_version >= 1),
  sources_used text[] not null default '{}'::text[],
  evidence_coverage_score numeric(5, 2) check (
    evidence_coverage_score is null or (evidence_coverage_score >= 0 and evidence_coverage_score <= 100)
  ),

  theme jsonb not null default '{}'::jsonb,
  headline text not null default '',
  subheadline text,
  hero_message text not null default '',
  why_reaching_out text,
  company_observations jsonb not null default '[]'::jsonb,
  cta_config jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  booking_page_id uuid references growth.booking_pages (id) on delete set null,

  hero_media_type text not null default 'none'
    check (hero_media_type in ('none', 'image', 'video')),
  hero_media_url text,
  hero_media_thumbnail_url text,
  voice_asset_id uuid,
  video_asset_id uuid,

  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  requires_human_review boolean not null default true,

  qa_marker text not null default 'share-pages-sr2-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint share_pages_token_hash_unique unique (token_hash),
  constraint share_pages_preview_token_hash_unique unique (preview_token_hash)
);

create index if not exists idx_growth_share_pages_token_hash
  on growth.share_pages (token_hash);

create index if not exists idx_growth_share_pages_token_prefix
  on growth.share_pages (token_prefix);

create index if not exists idx_growth_share_pages_lead_id
  on growth.share_pages (lead_id, updated_at desc);

create index if not exists idx_growth_share_pages_campaign_id
  on growth.share_pages (campaign_id, updated_at desc)
  where campaign_id is not null;

create index if not exists idx_growth_share_pages_enrollment_id
  on growth.share_pages (enrollment_id, updated_at desc)
  where enrollment_id is not null;

create index if not exists idx_growth_share_pages_sequence_execution_job_id
  on growth.share_pages (sequence_execution_job_id)
  where sequence_execution_job_id is not null;

create index if not exists idx_growth_share_pages_status
  on growth.share_pages (status, updated_at desc);

create index if not exists idx_growth_share_pages_source_channel
  on growth.share_pages (source_channel, updated_at desc);

create index if not exists idx_growth_share_pages_organization
  on growth.share_pages (organization_id, status, updated_at desc);

comment on table growth.share_pages is
  'Personalized per-lead share pages at /p/{token}. Human-gated publish only.';

-- -----------------------------------------------------------------------------
-- growth.share_page_views
-- -----------------------------------------------------------------------------

create table if not exists growth.share_page_views (
  id uuid primary key default gen_random_uuid(),
  share_page_id uuid not null references growth.share_pages (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  session_key text not null check (char_length(trim(session_key)) > 0),
  visitor_fingerprint_hash text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms bigint not null default 0 check (duration_ms >= 0),
  max_scroll_depth_pct int not null default 0 check (max_scroll_depth_pct >= 0 and max_scroll_depth_pct <= 100),
  page_url text not null default '',
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  device_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint share_page_views_page_session_unique unique (share_page_id, session_key)
);

create index if not exists idx_growth_share_page_views_page_started
  on growth.share_page_views (share_page_id, started_at desc);

create index if not exists idx_growth_share_page_views_lead_started
  on growth.share_page_views (lead_id, started_at desc);

-- -----------------------------------------------------------------------------
-- growth.share_page_events
-- -----------------------------------------------------------------------------

create table if not exists growth.share_page_events (
  id uuid primary key default gen_random_uuid(),
  share_page_id uuid not null references growth.share_pages (id) on delete cascade,
  share_page_view_id uuid references growth.share_page_views (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'SHARE_PAGE_VIEWED',
      'SHARE_PAGE_SESSION_STARTED',
      'SHARE_PAGE_SCROLL_25',
      'SHARE_PAGE_SCROLL_50',
      'SHARE_PAGE_SCROLL_75',
      'SHARE_PAGE_SCROLL_100',
      'SHARE_PAGE_CTA_CLICKED',
      'SHARE_PAGE_BOOKING_STARTED',
      'SHARE_PAGE_BOOKING_COMPLETED',
      'SHARE_PAGE_RESOURCE_OPENED'
    )),
  event_label text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_share_page_events_page_occurred
  on growth.share_page_events (share_page_id, occurred_at desc);

create index if not exists idx_growth_share_page_events_lead_occurred
  on growth.share_page_events (lead_id, occurred_at desc);

create index if not exists idx_growth_share_page_events_type_occurred
  on growth.share_page_events (event_type, occurred_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists set_share_pages_updated_at on growth.share_pages;
create trigger set_share_pages_updated_at
  before update on growth.share_pages
  for each row execute function public.set_updated_at();

drop trigger if exists set_share_page_views_updated_at on growth.share_page_views;
create trigger set_share_page_views_updated_at
  before update on growth.share_page_views
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service role only (Growth Engine pattern)
-- -----------------------------------------------------------------------------

alter table growth.share_pages enable row level security;
alter table growth.share_pages force row level security;
alter table growth.share_page_views enable row level security;
alter table growth.share_page_views force row level security;
alter table growth.share_page_events enable row level security;
alter table growth.share_page_events force row level security;

grant select, insert, update, delete on growth.share_pages to service_role;
grant select, insert, update, delete on growth.share_page_views to service_role;
grant select, insert, update, delete on growth.share_page_events to service_role;

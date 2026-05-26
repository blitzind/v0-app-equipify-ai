-- Growth Engine — Real-Time Intent Pixel foundation (Prompt 12).
-- Privacy-safe anonymous + identified tracking. No third-party enrichment.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.intent_pixel_sites
-- -----------------------------------------------------------------------------

create table if not exists growth.intent_pixel_sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  site_name text not null,
  domain_allowlist text[] not null default '{}',
  tracking_enabled boolean not null default true,
  consent_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intent_pixel_sites_enabled_idx
  on growth.intent_pixel_sites (tracking_enabled, site_key);

-- -----------------------------------------------------------------------------
-- growth.intent_visitor_sessions
-- -----------------------------------------------------------------------------

create table if not exists growth.intent_visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references growth.intent_pixel_sites (id) on delete cascade,
  visitor_key text not null,
  session_key text not null,
  is_identified boolean not null default false,
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'denied', 'granted', 'not_required')),
  first_touch_utm jsonb not null default '{}'::jsonb,
  last_touch_utm jsonb not null default '{}'::jsonb,
  first_referrer text,
  last_referrer text,
  first_landing_url text,
  last_page_url text,
  device_metadata jsonb not null default '{}'::jsonb,
  browser_metadata jsonb not null default '{}'::jsonb,
  pageview_count int not null default 0 check (pageview_count >= 0),
  total_time_on_site_ms bigint not null default 0 check (total_time_on_site_ms >= 0),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (site_id, session_key)
);

create index if not exists intent_visitor_sessions_site_visitor_idx
  on growth.intent_visitor_sessions (site_id, visitor_key, last_activity_at desc);

create index if not exists intent_visitor_sessions_site_started_idx
  on growth.intent_visitor_sessions (site_id, started_at desc);

-- -----------------------------------------------------------------------------
-- growth.intent_pageview_events
-- -----------------------------------------------------------------------------

create table if not exists growth.intent_pageview_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references growth.intent_pixel_sites (id) on delete cascade,
  session_id uuid not null references growth.intent_visitor_sessions (id) on delete cascade,
  page_url text not null,
  page_path text not null default '',
  page_title text not null default '',
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  duration_ms int not null default 0 check (duration_ms >= 0),
  captured_at timestamptz not null default now()
);

create index if not exists intent_pageview_events_session_idx
  on growth.intent_pageview_events (session_id, captured_at asc);

-- -----------------------------------------------------------------------------
-- growth.intent_conversion_events
-- -----------------------------------------------------------------------------

create table if not exists growth.intent_conversion_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references growth.intent_pixel_sites (id) on delete cascade,
  session_id uuid not null references growth.intent_visitor_sessions (id) on delete cascade,
  conversion_type text not null
    check (conversion_type in ('form_submit', 'booking', 'chat', 'login', 'lead_capture', 'custom')),
  conversion_label text not null default '',
  page_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists intent_conversion_events_session_idx
  on growth.intent_conversion_events (session_id, captured_at desc);

-- -----------------------------------------------------------------------------
-- growth.intent_identified_contacts — PII only from explicit capture sources
-- -----------------------------------------------------------------------------

create table if not exists growth.intent_identified_contacts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references growth.intent_pixel_sites (id) on delete cascade,
  session_id uuid not null references growth.intent_visitor_sessions (id) on delete cascade,
  capture_source text not null
    check (capture_source in ('form', 'booking', 'chat', 'login', 'lead_capture', 'enrichment')),
  email text,
  phone text,
  full_name text,
  linkedin_url text,
  company_name text,
  submitted_fields jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists intent_identified_contacts_session_idx
  on growth.intent_identified_contacts (session_id, captured_at desc);

-- Default internal sandbox site (no PII assumed from anonymous traffic)
insert into growth.intent_pixel_sites (site_key, site_name, domain_allowlist, consent_required)
values (
  'equipify-sandbox',
  'Equipify Intent Pixel Sandbox',
  array['localhost', '127.0.0.1', 'equipify.com', 'equipify.app'],
  true
)
on conflict (site_key) do nothing;

revoke all on table growth.intent_pixel_sites from public, anon, authenticated;
revoke all on table growth.intent_visitor_sessions from public, anon, authenticated;
revoke all on table growth.intent_pageview_events from public, anon, authenticated;
revoke all on table growth.intent_conversion_events from public, anon, authenticated;
revoke all on table growth.intent_identified_contacts from public, anon, authenticated;

grant select, insert, update, delete on table growth.intent_pixel_sites to service_role;
grant select, insert, update, delete on table growth.intent_visitor_sessions to service_role;
grant select, insert, update, delete on table growth.intent_pageview_events to service_role;
grant select, insert, update, delete on table growth.intent_conversion_events to service_role;
grant select, insert, update, delete on table growth.intent_identified_contacts to service_role;

alter table growth.intent_pixel_sites enable row level security;
alter table growth.intent_visitor_sessions enable row level security;
alter table growth.intent_pageview_events enable row level security;
alter table growth.intent_conversion_events enable row level security;
alter table growth.intent_identified_contacts enable row level security;

alter table growth.intent_pixel_sites force row level security;
alter table growth.intent_visitor_sessions force row level security;
alter table growth.intent_pageview_events force row level security;
alter table growth.intent_conversion_events force row level security;
alter table growth.intent_identified_contacts force row level security;

-- Growth Engine Slice 6.27B — Calendar sync controls + booking pages.

do $$
begin
  if to_regclass('growth.calendar_provider_connections') is null then
    raise exception 'Missing dependency: growth.calendar_provider_connections';
  end if;
  if to_regclass('growth.meetings') is null then
    raise exception 'Missing dependency: growth.meetings';
  end if;
end;
$$;

create table if not exists growth.calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references growth.calendar_provider_connections (id) on delete set null,
  trigger_type text not null default 'manual_force',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  events_fetched integer not null default 0,
  events_matched integer not null default 0,
  events_created integer not null default 0,
  events_updated integer not null default 0,
  events_synced integer not null default 0,
  conflicts_detected integer not null default 0,
  sync_error text,
  qa_marker text not null default 'calendar-sync-v1',
  created_at timestamptz not null default now(),
  constraint calendar_sync_runs_trigger_type_check
    check (trigger_type in ('manual_force', 'manual_pull')),
  constraint calendar_sync_runs_status_check
    check (status in ('running', 'completed', 'failed'))
);

create index if not exists idx_growth_calendar_sync_runs_user_started
  on growth.calendar_sync_runs (user_id, started_at desc);

create table if not exists growth.booking_pages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  calendar_connection_id uuid references growth.calendar_provider_connections (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  logo_url text,
  brand_color text not null default '#059669',
  meeting_type text,
  duration_minutes integer not null default 30,
  buffer_minutes integer not null default 0,
  availability_windows jsonb not null default '[]'::jsonb,
  timezone text not null default 'UTC',
  location_type text not null default 'google_meet',
  custom_location text,
  confirmation_message text,
  reminder_email_subject text,
  reminder_email_body text,
  enabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  qa_marker text not null default 'booking-pages-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_pages_slug_unique unique (slug),
  constraint booking_pages_duration_check check (duration_minutes > 0 and duration_minutes <= 480),
  constraint booking_pages_buffer_check check (buffer_minutes >= 0 and buffer_minutes <= 120),
  constraint booking_pages_location_type_check
    check (location_type in ('google_meet', 'phone_call', 'custom_location'))
);

create index if not exists idx_growth_booking_pages_owner
  on growth.booking_pages (owner_user_id, updated_at desc);

create index if not exists idx_growth_booking_pages_enabled_slug
  on growth.booking_pages (slug)
  where enabled = true;

create table if not exists growth.booking_page_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_page_id uuid not null references growth.booking_pages (id) on delete cascade,
  meeting_id uuid references growth.meetings (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_company text,
  guest_phone text,
  guest_notes text,
  slot_start_at timestamptz not null,
  slot_end_at timestamptz not null,
  status text not null default 'confirmed',
  calendar_event_id text,
  meeting_url text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint booking_page_bookings_status_check
    check (status in ('confirmed', 'failed', 'canceled'))
);

create index if not exists idx_growth_booking_page_bookings_page_slot
  on growth.booking_page_bookings (booking_page_id, slot_start_at desc);

alter table growth.meetings
  add column if not exists booking_page_id uuid references growth.booking_pages (id) on delete set null;

create index if not exists idx_growth_meetings_booking_page
  on growth.meetings (booking_page_id)
  where booking_page_id is not null;

alter table growth.calendar_sync_runs enable row level security;
alter table growth.calendar_sync_runs force row level security;
alter table growth.booking_pages enable row level security;
alter table growth.booking_pages force row level security;
alter table growth.booking_page_bookings enable row level security;
alter table growth.booking_page_bookings force row level security;

grant select, insert, update, delete on growth.calendar_sync_runs to service_role;
grant select, insert, update, delete on growth.booking_pages to service_role;
grant select, insert, update, delete on growth.booking_page_bookings to service_role;

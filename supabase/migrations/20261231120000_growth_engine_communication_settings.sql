-- Growth Engine slice 5.2A: communication settings, dial preferences, call sessions, lead call caches.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.email_provider_connections') is null then
    raise exception 'Missing dependency: growth.email_provider_connections';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.communication_settings — platform-scope defaults (singleton today)
-- Future org add-on: mirror columns on an org-owned defaults table; do not overload this singleton.
-- -----------------------------------------------------------------------------

create table if not exists growth.communication_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton = true),
  active_email_connection_id uuid references growth.email_provider_connections (id) on delete set null,
  call_dial_mode text not null default 'tel'
    check (call_dial_mode in ('tel', 'facetime', 'google_voice', 'custom_url_template')),
  custom_url_template text,
  show_alternate_dialers boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.communication_settings (singleton)
values (true)
on conflict (singleton) do nothing;

comment on table growth.communication_settings is
  'Platform-scope Growth Engine communication defaults (slice 5.2A). Org add-ons should use a parallel org-owned table — not this singleton.';

revoke all on table growth.communication_settings from public, anon, authenticated;
grant select, insert, update, delete on table growth.communication_settings to service_role;

alter table growth.communication_settings enable row level security;
alter table growth.communication_settings force row level security;

-- -----------------------------------------------------------------------------
-- growth.user_communication_preferences — platform admin user overrides
-- Future org add-on: org member overrides with organization_id (added in that slice only).
-- -----------------------------------------------------------------------------

create table if not exists growth.user_communication_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  call_dial_mode text
    check (call_dial_mode is null or call_dial_mode in ('tel', 'facetime', 'google_voice', 'custom_url_template')),
  custom_url_template text,
  show_alternate_dialers boolean,
  preferred_email_connection_id uuid references growth.email_provider_connections (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table growth.user_communication_preferences is
  'Platform admin user communication overrides; falls back to platform defaults then tel. Org member overrides should mirror this shape under org scope.';

revoke all on table growth.user_communication_preferences from public, anon, authenticated;
grant select, insert, update, delete on table growth.user_communication_preferences to service_role;

alter table growth.user_communication_preferences enable row level security;
alter table growth.user_communication_preferences force row level security;

-- -----------------------------------------------------------------------------
-- growth.email_provider_connections — cost / seat metadata
-- -----------------------------------------------------------------------------

alter table growth.email_provider_connections
  add column if not exists monthly_cost_estimate numeric(10, 2)
    check (monthly_cost_estimate is null or monthly_cost_estimate >= 0),
  add column if not exists seat_count int
    check (seat_count is null or seat_count >= 0),
  add column if not exists notes text;

-- -----------------------------------------------------------------------------
-- growth.leads — cached call counts + no_answer disposition
-- -----------------------------------------------------------------------------

alter table growth.leads
  drop constraint if exists leads_call_disposition_check;

alter table growth.leads
  add constraint leads_call_disposition_check check (call_disposition is null or call_disposition in (
    'call_attempted', 'left_voicemail', 'interested', 'not_a_fit', 'follow_up_later', 'no_answer'
  )),
  add column if not exists call_attempt_count int not null default 0 check (call_attempt_count >= 0),
  add column if not exists voicemail_count int not null default 0 check (voicemail_count >= 0),
  add column if not exists connected_call_count int not null default 0 check (connected_call_count >= 0);

alter table growth.lead_call_events
  drop constraint if exists lead_call_events_disposition_check;

alter table growth.lead_call_events
  add constraint lead_call_events_disposition_check check (disposition in (
    'call_attempted', 'left_voicemail', 'interested', 'not_a_fit', 'follow_up_later', 'no_answer'
  ));

-- Backfill cached call counts from existing events
update growth.leads l
set
  call_attempt_count = coalesce(s.attempt_count, 0),
  voicemail_count = coalesce(s.voicemail_count, 0),
  connected_call_count = coalesce(s.connected_count, 0)
from (
  select
    lead_id,
    count(*) filter (
      where disposition in ('call_attempted', 'left_voicemail', 'interested', 'no_answer', 'follow_up_later')
    ) as attempt_count,
    count(*) filter (where disposition = 'left_voicemail') as voicemail_count,
    count(*) filter (where disposition in ('call_attempted', 'interested')) as connected_count
  from growth.lead_call_events
  group by lead_id
) s
where l.id = s.lead_id;

-- -----------------------------------------------------------------------------
-- growth.lead_call_sessions — lightweight dial session tracking
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_call_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  phone_dialed text not null,
  dial_mode text not null
    check (dial_mode in ('tel', 'facetime', 'google_voice', 'custom_url_template')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  disposition text
    check (disposition is null or disposition in (
      'call_attempted', 'left_voicemail', 'interested', 'not_a_fit', 'follow_up_later', 'no_answer'
    )),
  call_event_id uuid references growth.lead_call_events (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_call_sessions_lead_started
  on growth.lead_call_sessions (lead_id, started_at desc);

comment on table growth.lead_call_sessions is
  'Lightweight call dial sessions for Growth Engine (slice 5.2A); no telephony metadata.';

revoke all on table growth.lead_call_sessions from public, anon, authenticated;
grant select, insert, update, delete on table growth.lead_call_sessions to service_role;

alter table growth.lead_call_sessions enable row level security;
alter table growth.lead_call_sessions force row level security;

-- -----------------------------------------------------------------------------
-- growth.lead_timeline_events — call_started
-- -----------------------------------------------------------------------------

alter table growth.lead_timeline_events
  drop constraint if exists lead_timeline_events_event_type_check;

alter table growth.lead_timeline_events
  add constraint lead_timeline_events_event_type_check check (event_type in (
    'lead_created', 'research_started', 'research_completed', 'research_failed',
    'website_fetch_failed', 'website_fetch_fixed',
    'decision_maker_added', 'decision_maker_confirmed', 'decision_maker_rejected',
    'call_started', 'call_attempted', 'voicemail_left', 'interested',
    'follow_up_created', 'follow_up_completed',
    'notes_updated', 'priority_changed', 'override_changed', 'next_best_action_changed',
    'website_changed', 'status_changed', 'import_created', 'import_updated', 'manual_touch',
    'email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_replied',
    'email_bounced', 'email_unsubscribed', 'email_failed', 'email_spam_complaint',
    'email_suppressed', 'email_unmatched'
  ));

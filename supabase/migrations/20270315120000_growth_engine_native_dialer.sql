-- Growth Engine slice 6.34A: native dialer + unified call workspace.
-- Operator controlled — no autonomous outbound dialing or CRM movement.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

create table if not exists growth.native_dialer_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  primary_provider text not null default 'stub'
    check (primary_provider in ('stub', 'retell', 'twilio', 'elevenlabs_conversational', 'sip')),
  fallback_provider text not null default 'stub'
    check (fallback_provider in ('stub', 'retell', 'twilio', 'elevenlabs_conversational', 'sip')),
  default_queue_mode text not null default 'manual'
    check (default_queue_mode in ('manual', 'preview', 'power', 'callback', 'missed_callback', 'priority')),
  power_dial_enabled boolean not null default false,
  preview_dial_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists growth.native_dialer_queue_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  queue_mode text not null default 'manual'
    check (queue_mode in ('manual', 'preview', 'power', 'callback', 'missed_callback', 'priority')),
  status text not null default 'pending'
    check (status in ('pending', 'previewing', 'dialing', 'completed', 'skipped', 'callback_due')),
  priority_score int not null default 0,
  callback_due_at timestamptz,
  phone_number text,
  contact_name text,
  company_name text,
  reason text not null default '',
  source_system text not null default 'manual',
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_native_dialer_queue_status
  on growth.native_dialer_queue_items (status, priority_score desc, created_at asc);

create table if not exists growth.native_call_workspace_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  queue_item_id uuid references growth.native_dialer_queue_items (id) on delete set null,
  provider text not null default 'stub'
    check (provider in ('stub', 'retell', 'twilio', 'elevenlabs_conversational', 'sip')),
  fallback_provider text,
  dial_mode text not null default 'manual'
    check (dial_mode in ('manual', 'preview', 'power', 'callback', 'missed_callback', 'priority', 'inbound')),
  direction text not null default 'outbound'
    check (direction in ('outbound', 'inbound')),
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'on_hold', 'wrapping', 'completed', 'failed', 'missed', 'no_answer')),
  phone_number text,
  contact_name text,
  company_name text,
  started_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  recording_state text not null default 'none'
    check (recording_state in ('none', 'pending', 'active', 'paused', 'stopped')),
  muted boolean not null default false,
  on_hold boolean not null default false,
  transfer_target text,
  notes_draft text not null default '',
  realtime_session_id uuid,
  call_copilot_session_id uuid,
  provider_call_ref text,
  safe_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_native_call_sessions_owner_status
  on growth.native_call_workspace_sessions (owner_user_id, status, started_at desc);

create index if not exists idx_growth_native_call_sessions_lead
  on growth.native_call_workspace_sessions (lead_id, started_at desc);

create table if not exists growth.native_call_wrapups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references growth.native_call_workspace_sessions (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  outcome text not null default 'connected'
    check (outcome in (
      'connected', 'left_voicemail', 'no_answer', 'meeting_booked', 'follow_up_needed', 'not_interested', 'wrong_number'
    )),
  left_voicemail boolean not null default false,
  no_answer boolean not null default false,
  connected boolean not null default false,
  meeting_booked boolean not null default false,
  follow_up_needed boolean not null default false,
  objection_category text,
  buying_signals jsonb not null default '[]'::jsonb,
  competitor_mentioned boolean not null default false,
  timeline_detected boolean not null default false,
  budget_detected boolean not null default false,
  champion_identified boolean not null default false,
  decision_maker_present boolean not null default false,
  suggested_next_actions jsonb not null default '[]'::jsonb,
  notes text not null default '',
  operator_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_growth_native_call_wrapups_session
  on growth.native_call_wrapups (session_id);

alter table growth.native_dialer_settings enable row level security;
alter table growth.native_dialer_queue_items enable row level security;
alter table growth.native_call_workspace_sessions enable row level security;
alter table growth.native_call_wrapups enable row level security;

create policy growth_native_dialer_settings_service_role
  on growth.native_dialer_settings for all to service_role using (true) with check (true);
create policy growth_native_dialer_queue_items_service_role
  on growth.native_dialer_queue_items for all to service_role using (true) with check (true);
create policy growth_native_call_workspace_sessions_service_role
  on growth.native_call_workspace_sessions for all to service_role using (true) with check (true);
create policy growth_native_call_wrapups_service_role
  on growth.native_call_wrapups for all to service_role using (true) with check (true);

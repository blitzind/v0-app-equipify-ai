-- Voice Infrastructure Phase 1D — Browser calling + Call Workspace integration.
-- Connects existing Growth Call Workspace to canonical voice.* infrastructure.

do $$
begin
  if to_regclass('voice.voice_calls') is null then
    raise exception 'Missing dependency: voice.voice_calls (apply Phase 1A first)';
  end if;
  if to_regclass('growth.native_call_workspace_sessions') is null then
    raise exception 'Missing dependency: growth.native_call_workspace_sessions';
  end if;
end;
$$;

create type voice.browser_device_status as enum (
  'registering',
  'available',
  'busy',
  'offline',
  'reconnecting'
);

create type voice.operator_presence_status as enum (
  'offline',
  'online',
  'away',
  'on_call',
  'reconnecting'
);

create table if not exists voice.voice_browser_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'twilio'
    check (provider in ('twilio', 'telnyx', 'sip', 'stub')),
  client_identity text not null,
  device_fingerprint text not null default '',
  user_agent text not null default '',
  status voice.browser_device_status not null default 'registering',
  last_registered_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  disconnected_at timestamptz,
  active_voice_call_id uuid references voice.voice_calls (id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_identity)
);

create index if not exists idx_voice_browser_devices_org_user
  on voice.voice_browser_devices (organization_id, user_id, status);

create index if not exists idx_voice_browser_devices_available
  on voice.voice_browser_devices (organization_id, status, last_heartbeat_at desc);

create table if not exists voice.voice_operator_presence (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status voice.operator_presence_status not null default 'offline',
  active_device_count int not null default 0 check (active_device_count >= 0),
  active_voice_call_id uuid references voice.voice_calls (id) on delete set null,
  active_workspace_session_id uuid,
  last_seen_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists idx_voice_operator_presence_online
  on voice.voice_operator_presence (organization_id, status, last_seen_at desc);

alter table voice.voice_routing_profile_members
  add column if not exists browser_client_identity text;

alter table growth.native_call_workspace_sessions
  add column if not exists voice_call_id uuid references voice.voice_calls (id) on delete set null;

create index if not exists idx_growth_native_call_workspace_voice_call
  on growth.native_call_workspace_sessions (voice_call_id)
  where voice_call_id is not null;

alter table voice.voice_operator_presence enable row level security;
alter table voice.voice_browser_devices enable row level security;

create policy voice_browser_devices_select on voice.voice_browser_devices
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = voice_browser_devices.organization_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager', 'tech')
    )
  );

create policy voice_operator_presence_select on voice.voice_operator_presence
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = voice_operator_presence.organization_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager', 'tech')
    )
  );

grant select on voice.voice_browser_devices to authenticated;
grant select on voice.voice_operator_presence to authenticated;
grant all on voice.voice_browser_devices to service_role;
grant all on voice.voice_operator_presence to service_role;

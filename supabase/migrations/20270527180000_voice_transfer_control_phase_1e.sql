-- Voice Infrastructure Phase 1E — Live transfer + multi-party call control.
-- Call legs, conferences, participants, and deterministic transfer state.

do $$
begin
  if to_regclass('voice.voice_calls') is null then
    raise exception 'Missing dependency: voice.voice_calls (apply Phase 1A first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_call_leg_type'
  ) then
    create type voice.voice_call_leg_type as enum (
      'inbound',
      'outbound',
      'browser_client',
      'pstn',
      'supervisor',
      'ai_future'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_call_leg_status'
  ) then
    create type voice.voice_call_leg_status as enum (
      'queued',
      'ringing',
      'in_progress',
      'held',
      'completed',
      'failed',
      'canceled'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_conference_status'
  ) then
    create type voice.voice_conference_status as enum (
      'initiated',
      'in_progress',
      'completed',
      'failed'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_conference_participant_status'
  ) then
    create type voice.voice_conference_participant_status as enum (
      'queued',
      'connecting',
      'connected',
      'held',
      'muted',
      'disconnected',
      'failed'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_transfer_kind'
  ) then
    create type voice.voice_transfer_kind as enum ('cold', 'warm', 'consult');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_transfer_status'
  ) then
    create type voice.voice_transfer_status as enum (
      'idle',
      'starting',
      'consulting',
      'completing',
      'completed',
      'canceled',
      'failed',
      'returned'
    );
  end if;
end;
$$;

create table if not exists voice.voice_call_legs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  provider_call_sid text not null default '',
  leg_type voice.voice_call_leg_type not null,
  participant_user_id uuid references auth.users (id) on delete set null,
  phone_number text not null default '',
  client_identity text not null default '',
  status voice.voice_call_leg_status not null default 'queued',
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_call_legs_call
  on voice.voice_call_legs (voice_call_id, status, created_at desc);

create index if not exists idx_voice_call_legs_org_call_sid
  on voice.voice_call_legs (organization_id, provider, provider_call_sid);

comment on table voice.voice_call_legs is
  'Canonical call-leg model for multi-party voice orchestration (Phase 1E).';

create table if not exists voice.voice_conferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  provider_conference_sid text not null default '',
  friendly_name text not null default '',
  status voice.voice_conference_status not null default 'initiated',
  started_at timestamptz,
  ended_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_conferences_call
  on voice.voice_conferences (voice_call_id, status, created_at desc);

comment on table voice.voice_conferences is
  'Conference rooms for warm/consult transfers and supervisor join (Phase 1E).';

create table if not exists voice.voice_conference_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conference_id uuid not null references voice.voice_conferences (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  call_leg_id uuid references voice.voice_call_legs (id) on delete set null,
  participant_user_id uuid references auth.users (id) on delete set null,
  provider_participant_sid text not null default '',
  participant_role text not null default 'operator'
    check (participant_role in ('operator', 'supervisor', 'transfer_target', 'customer', 'consult')),
  phone_number text not null default '',
  client_identity text not null default '',
  status voice.voice_conference_participant_status not null default 'queued',
  is_muted boolean not null default false,
  is_on_hold boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_conference_participants_conference
  on voice.voice_conference_participants (conference_id, status, joined_at desc);

create index if not exists idx_voice_conference_participants_call
  on voice.voice_conference_participants (voice_call_id, status);

comment on table voice.voice_conference_participants is
  'Conference participant state (hold/mute/join/leave) for multi-party call control.';

create table if not exists voice.voice_call_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  initiated_by_user_id uuid not null references auth.users (id) on delete cascade,
  transfer_kind voice.voice_transfer_kind not null,
  status voice.voice_transfer_status not null default 'starting',
  target_phone_number text not null default '',
  target_user_id uuid references auth.users (id) on delete set null,
  target_client_identity text not null default '',
  consult_conference_id uuid references voice.voice_conferences (id) on delete set null,
  completed_at timestamptz,
  canceled_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_voice_call_transfers_active
  on voice.voice_call_transfers (voice_call_id)
  where status in ('starting', 'consulting', 'completing');

create index if not exists idx_voice_call_transfers_org_call
  on voice.voice_call_transfers (organization_id, voice_call_id, created_at desc);

comment on table voice.voice_call_transfers is
  'Deterministic transfer state machine for cold/warm/consult flows (Phase 1E).';

alter table voice.voice_call_legs enable row level security;
alter table voice.voice_conferences enable row level security;
alter table voice.voice_conference_participants enable row level security;
alter table voice.voice_call_transfers enable row level security;

create policy voice_call_legs_select on voice.voice_call_legs
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_conferences_select on voice.voice_conferences
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_conference_participants_select on voice.voice_conference_participants
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_call_transfers_select on voice.voice_call_transfers
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

grant select on voice.voice_call_legs to authenticated;
grant select on voice.voice_conferences to authenticated;
grant select on voice.voice_conference_participants to authenticated;
grant select on voice.voice_call_transfers to authenticated;

grant all on voice.voice_call_legs to service_role;
grant all on voice.voice_conferences to service_role;
grant all on voice.voice_conference_participants to service_role;
grant all on voice.voice_call_transfers to service_role;

grant usage, select on all sequences in schema voice to service_role;

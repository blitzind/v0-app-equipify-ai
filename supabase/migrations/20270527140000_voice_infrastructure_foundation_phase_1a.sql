-- Voice Infrastructure Foundation — Phase 1A
-- Organization-scoped telephony layer (provider-abstracted, audit-friendly).

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
end;
$$;

create schema if not exists voice;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_provider_kind') then
    create type voice.voice_provider_kind as enum ('twilio', 'telnyx', 'plivo', 'sip', 'stub');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_number_status') then
    create type voice.voice_number_status as enum ('pending', 'active', 'released', 'suspended');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_call_direction') then
    create type voice.voice_call_direction as enum ('inbound', 'outbound');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_call_status') then
    create type voice.voice_call_status as enum (
      'queued',
      'initiated',
      'ringing',
      'in_progress',
      'completed',
      'failed',
      'busy',
      'no_answer',
      'canceled'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_call_disposition_kind') then
    create type voice.voice_call_disposition_kind as enum (
      'connected',
      'voicemail',
      'no_answer',
      'wrong_number',
      'qualified',
      'appointment_booked',
      'do_not_call',
      'follow_up_requested',
      'transferred',
      'escalation_required'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_transcription_status') then
    create type voice.voice_transcription_status as enum ('pending', 'processing', 'completed', 'failed', 'unavailable');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_provider_config_status') then
    create type voice.voice_provider_config_status as enum ('pending', 'ready', 'degraded', 'disabled');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists voice.voice_provider_configurations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  provider_account_reference text not null default '',
  status voice.voice_provider_config_status not null default 'pending',
  voice_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  webhook_validated boolean not null default false,
  last_validation_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_provider_configurations_org_provider_unique unique (organization_id, provider)
);

comment on table voice.voice_provider_configurations is
  'Per-org telephony provider readiness and webhook validation state.';

create table if not exists voice.voice_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  provider_number_id text not null default '',
  phone_number text not null,
  display_name text not null default '',
  capabilities_json jsonb not null default '{}'::jsonb,
  status voice.voice_number_status not null default 'pending',
  sms_enabled boolean not null default false,
  voice_enabled boolean not null default true,
  assigned_user_id uuid references auth.users (id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_numbers_org_phone_unique unique (organization_id, phone_number)
);

comment on table voice.voice_numbers is 'Provisioned organization phone numbers.';

create index if not exists idx_voice_numbers_org_status
  on voice.voice_numbers (organization_id, status);

create table if not exists voice.voice_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  provider_call_id text not null,
  direction voice.voice_call_direction not null,
  status voice.voice_call_status not null default 'queued',
  from_number text not null default '',
  to_number text not null default '',
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  recording_available boolean not null default false,
  transcription_available boolean not null default false,
  transferred boolean not null default false,
  transferred_to text,
  assigned_user_id uuid references auth.users (id) on delete set null,
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  operator_disposition voice.voice_call_disposition_kind,
  cost_currency text not null default 'USD',
  cost_amount numeric(12, 4),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_calls_org_provider_call_unique unique (organization_id, provider, provider_call_id)
);

comment on table voice.voice_calls is 'Canonical call records with deterministic lifecycle status.';

create index if not exists idx_voice_calls_org_started
  on voice.voice_calls (organization_id, started_at desc nulls last);

create index if not exists idx_voice_calls_org_status
  on voice.voice_calls (organization_id, status, updated_at desc);

create table if not exists voice.voice_call_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  event_type text not null,
  event_timestamp timestamptz not null,
  payload_json jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint voice_call_events_idempotency_unique unique (organization_id, provider, idempotency_key)
);

comment on table voice.voice_call_events is 'Append-only call timeline for replay and debugging.';

create index if not exists idx_voice_call_events_call_ts
  on voice.voice_call_events (voice_call_id, event_timestamp asc);

create table if not exists voice.voice_recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  provider_recording_id text not null default '',
  storage_path text,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  retention_expires_at timestamptz,
  transcription_status voice.voice_transcription_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint voice_recordings_call_provider_rec_unique unique (voice_call_id, provider, provider_recording_id)
);

comment on table voice.voice_recordings is 'Recording metadata and retention tracking.';

create table if not exists voice.voice_transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_status voice.voice_transcription_status not null default 'pending',
  transcript_provider text not null default '',
  transcript_text text not null default '',
  confidence_score numeric(5, 4) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table voice.voice_transcripts is 'Transcript infrastructure (no AI orchestration in Phase 1A).';

create table if not exists voice.voice_opt_outs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phone_number text not null,
  reason text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint voice_opt_outs_org_phone_unique unique (organization_id, phone_number)
);

comment on table voice.voice_opt_outs is 'Compliance opt-out registry (organization scoped).';

create table if not exists voice.voice_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider voice.voice_provider_kind not null,
  idempotency_key text not null,
  payload_hash text not null,
  voice_call_id uuid references voice.voice_calls (id) on delete set null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint voice_webhook_receipts_provider_key_unique unique (provider, idempotency_key)
);

comment on table voice.voice_webhook_receipts is 'Webhook idempotency receipts for replay-safe ingestion.';

create index if not exists idx_voice_webhook_receipts_org_created
  on voice.voice_webhook_receipts (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Append-only protection for voice_call_events
-- ---------------------------------------------------------------------------

create or replace function voice.prevent_voice_call_events_mutation()
returns trigger
language plpgsql
security definer
set search_path = voice, public
as $$
begin
  raise exception 'voice_call_events is append-only';
end;
$$;

drop trigger if exists trg_voice_call_events_no_update on voice.voice_call_events;
create trigger trg_voice_call_events_no_update
  before update or delete on voice.voice_call_events
  for each row execute function voice.prevent_voice_call_events_mutation();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_voice_provider_configurations_set_updated_at on voice.voice_provider_configurations;
    create trigger trg_voice_provider_configurations_set_updated_at
      before update on voice.voice_provider_configurations
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_voice_numbers_set_updated_at on voice.voice_numbers;
    create trigger trg_voice_numbers_set_updated_at
      before update on voice.voice_numbers
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_voice_calls_set_updated_at on voice.voice_calls;
    create trigger trg_voice_calls_set_updated_at
      before update on voice.voice_calls
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table voice.voice_provider_configurations enable row level security;
alter table voice.voice_provider_configurations force row level security;
alter table voice.voice_numbers enable row level security;
alter table voice.voice_numbers force row level security;
alter table voice.voice_calls enable row level security;
alter table voice.voice_calls force row level security;
alter table voice.voice_call_events enable row level security;
alter table voice.voice_call_events force row level security;
alter table voice.voice_recordings enable row level security;
alter table voice.voice_recordings force row level security;
alter table voice.voice_transcripts enable row level security;
alter table voice.voice_transcripts force row level security;
alter table voice.voice_opt_outs enable row level security;
alter table voice.voice_opt_outs force row level security;
alter table voice.voice_webhook_receipts enable row level security;
alter table voice.voice_webhook_receipts force row level security;

revoke all on schema voice from public, anon;
revoke all on all tables in schema voice from public, anon;

grant usage on schema voice to authenticated, service_role;

grant select on table voice.voice_provider_configurations to authenticated;
grant select, insert, update on table voice.voice_provider_configurations to service_role;

grant select on table voice.voice_numbers to authenticated;
grant select, insert, update, delete on table voice.voice_numbers to service_role;

grant select on table voice.voice_calls to authenticated;
grant select, insert, update on table voice.voice_calls to service_role;

grant select on table voice.voice_call_events to authenticated;
grant select, insert on table voice.voice_call_events to service_role;

grant select on table voice.voice_recordings to authenticated;
grant select, insert, update on table voice.voice_recordings to service_role;

grant select on table voice.voice_transcripts to authenticated;
grant select, insert, update on table voice.voice_transcripts to service_role;

grant select on table voice.voice_opt_outs to authenticated;
grant select, insert on table voice.voice_opt_outs to service_role;

grant select on table voice.voice_webhook_receipts to authenticated;
grant select, insert on table voice.voice_webhook_receipts to service_role;

-- voice_provider_configurations: owner/admin/manager
drop policy if exists "voice_provider_configurations_select_roles" on voice.voice_provider_configurations;
create policy "voice_provider_configurations_select_roles"
on voice.voice_provider_configurations
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_numbers
drop policy if exists "voice_numbers_select_roles" on voice.voice_numbers;
create policy "voice_numbers_select_roles"
on voice.voice_numbers
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_calls
drop policy if exists "voice_calls_select_roles" on voice.voice_calls;
create policy "voice_calls_select_roles"
on voice.voice_calls
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_call_events (append-only via app; members read)
drop policy if exists "voice_call_events_select_roles" on voice.voice_call_events;
create policy "voice_call_events_select_roles"
on voice.voice_call_events
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_recordings
drop policy if exists "voice_recordings_select_roles" on voice.voice_recordings;
create policy "voice_recordings_select_roles"
on voice.voice_recordings
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_transcripts
drop policy if exists "voice_transcripts_select_roles" on voice.voice_transcripts;
create policy "voice_transcripts_select_roles"
on voice.voice_transcripts
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_opt_outs
drop policy if exists "voice_opt_outs_select_roles" on voice.voice_opt_outs;
create policy "voice_opt_outs_select_roles"
on voice.voice_opt_outs
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "voice_opt_outs_insert_roles" on voice.voice_opt_outs;
create policy "voice_opt_outs_insert_roles"
on voice.voice_opt_outs
for insert
to authenticated
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- voice_webhook_receipts (read-only for operators)
drop policy if exists "voice_webhook_receipts_select_roles" on voice.voice_webhook_receipts;
create policy "voice_webhook_receipts_select_roles"
on voice.voice_webhook_receipts
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

grant usage, select on all sequences in schema voice to service_role;

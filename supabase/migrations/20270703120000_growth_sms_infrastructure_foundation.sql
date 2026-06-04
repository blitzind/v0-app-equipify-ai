-- Growth Engine Phase 5.1 — SMS infrastructure foundation.
-- Outbound send, inbound webhooks, delivery tracking, conversation threading.
-- No sequence execution, no AI generation, no automation in this phase.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.inbox_threads') is null then
    raise exception 'Missing dependency: growth.inbox_threads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sms_workspace_settings — platform SMS configuration (singleton row pattern)
-- -----------------------------------------------------------------------------

create table if not exists growth.sms_workspace_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  provider_kind text not null default 'twilio'
    check (provider_kind in ('twilio', 'telnyx', 'signalwire', 'noop')),
  from_e164 text not null default '+18333784743',
  messaging_service_sid text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table growth.sms_workspace_settings is
  'Growth Engine SMS workspace config — provider-independent, org nullable for future add-ons.';

-- -----------------------------------------------------------------------------
-- growth.sms_conversations — lead-scoped SMS threads
-- -----------------------------------------------------------------------------

create table if not exists growth.sms_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  participant_e164 text not null,
  from_e164 text not null,
  inbox_thread_id uuid references growth.inbox_threads (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'waiting', 'resolved', 'archived')),
  message_count integer not null default 0 check (message_count >= 0),
  last_message_at timestamptz,
  last_message_preview text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_sms_conversations_lead_participant
  on growth.sms_conversations (lead_id, participant_e164);

create index if not exists idx_growth_sms_conversations_lead
  on growth.sms_conversations (lead_id, last_message_at desc nulls last);

create index if not exists idx_growth_sms_conversations_participant
  on growth.sms_conversations (participant_e164);

comment on table growth.sms_conversations is
  'Lead-scoped SMS conversation threads — links to unified inbox via inbox_thread_id when bridged.';

-- -----------------------------------------------------------------------------
-- growth.sms_messages — normalized SMS messages
-- -----------------------------------------------------------------------------

create table if not exists growth.sms_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references growth.sms_conversations (id) on delete cascade,
  direction text not null
    check (direction in ('inbound', 'outbound')),
  body text not null default '',
  from_e164 text not null,
  to_e164 text not null,
  provider text not null default 'twilio'
    check (provider in ('twilio', 'telnyx', 'signalwire', 'noop')),
  provider_message_id text,
  status text not null default 'received'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'undelivered', 'cancelled', 'received')),
  delivery_attempt_id uuid,
  message_timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_growth_sms_messages_provider_message
  on growth.sms_messages (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_growth_sms_messages_conversation
  on growth.sms_messages (conversation_id, message_timestamp desc);

comment on table growth.sms_messages is
  'Normalized SMS messages — inbound and outbound — provider-independent storage.';

-- -----------------------------------------------------------------------------
-- growth.sms_delivery_attempts — outbound send audit trail
-- -----------------------------------------------------------------------------

create table if not exists growth.sms_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  conversation_id uuid references growth.sms_conversations (id) on delete set null,
  provider text not null default 'twilio'
    check (provider in ('twilio', 'telnyx', 'signalwire', 'noop')),
  from_e164 text not null,
  to_e164 text not null,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'undelivered', 'cancelled')),
  provider_message_id text,
  idempotency_key text not null,
  failure_reason text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_growth_sms_delivery_attempts_idempotency
  on growth.sms_delivery_attempts (idempotency_key);

create index if not exists idx_growth_sms_delivery_attempts_provider_message
  on growth.sms_delivery_attempts (provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_growth_sms_delivery_attempts_lead
  on growth.sms_delivery_attempts (lead_id, queued_at desc);

comment on table growth.sms_delivery_attempts is
  'Outbound SMS delivery audit — single-message sends only in Phase 5.1.';

-- FK from sms_messages.delivery_attempt_id after attempts table exists
alter table growth.sms_messages
  drop constraint if exists sms_messages_delivery_attempt_id_fkey;

alter table growth.sms_messages
  add constraint sms_messages_delivery_attempt_id_fkey
  foreign key (delivery_attempt_id) references growth.sms_delivery_attempts (id) on delete set null;

-- -----------------------------------------------------------------------------
-- growth.sms_provider_events — raw webhook payloads + normalization
-- -----------------------------------------------------------------------------

create table if not exists growth.sms_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'twilio'
    check (provider in ('twilio', 'telnyx', 'signalwire', 'noop')),
  event_type text not null default 'unknown'
    check (event_type in ('inbound_message', 'status_update', 'delivery_receipt', 'unknown')),
  provider_message_id text,
  delivery_attempt_id uuid references growth.sms_delivery_attempts (id) on delete set null,
  conversation_id uuid references growth.sms_conversations (id) on delete set null,
  message_id uuid references growth.sms_messages (id) on delete set null,
  payload_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'duplicate', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists idx_growth_sms_provider_events_payload_hash
  on growth.sms_provider_events (provider, payload_hash);

create index if not exists idx_growth_sms_provider_events_provider_message
  on growth.sms_provider_events (provider_message_id, received_at desc);

comment on table growth.sms_provider_events is
  'Raw SMS provider webhook events — Twilio inbound + status callbacks in Phase 5.1.';

-- Default platform workspace row (Twilio-approved number)
insert into growth.sms_workspace_settings (id, provider_kind, from_e164, status, metadata)
values (
  '00000000-0000-4000-8000-000000005501'::uuid,
  'twilio',
  '+18333784743',
  'active',
  '{"phase":"5.1","note":"Twilio-approved outbound number"}'::jsonb
)
on conflict (id) do nothing;

revoke all on table growth.sms_workspace_settings from public, anon, authenticated;
revoke all on table growth.sms_conversations from public, anon, authenticated;
revoke all on table growth.sms_messages from public, anon, authenticated;
revoke all on table growth.sms_delivery_attempts from public, anon, authenticated;
revoke all on table growth.sms_provider_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.sms_workspace_settings to service_role;
grant select, insert, update, delete on table growth.sms_conversations to service_role;
grant select, insert, update, delete on table growth.sms_messages to service_role;
grant select, insert, update, delete on table growth.sms_delivery_attempts to service_role;
grant select, insert, update, delete on table growth.sms_provider_events to service_role;

alter table growth.sms_workspace_settings enable row level security;
alter table growth.sms_conversations enable row level security;
alter table growth.sms_messages enable row level security;
alter table growth.sms_delivery_attempts enable row level security;
alter table growth.sms_provider_events enable row level security;

alter table growth.sms_workspace_settings force row level security;
alter table growth.sms_conversations force row level security;
alter table growth.sms_messages force row level security;
alter table growth.sms_delivery_attempts force row level security;
alter table growth.sms_provider_events force row level security;

create policy growth_sms_workspace_settings_service_role
  on growth.sms_workspace_settings for all to service_role using (true) with check (true);
create policy growth_sms_conversations_service_role
  on growth.sms_conversations for all to service_role using (true) with check (true);
create policy growth_sms_messages_service_role
  on growth.sms_messages for all to service_role using (true) with check (true);
create policy growth_sms_delivery_attempts_service_role
  on growth.sms_delivery_attempts for all to service_role using (true) with check (true);
create policy growth_sms_provider_events_service_role
  on growth.sms_provider_events for all to service_role using (true) with check (true);

-- Phase 4B — Missed-call recovery + voice drop infrastructure.
-- Operator-controlled, compliance-gated, approval-based. No autonomous outbound.

do $$
begin
  if to_regclass('voice.voice_calls') is null then
    raise exception 'Missing dependency: voice.voice_calls (apply voice foundation first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_missed_call_recovery_type'
  ) then
    create type voice.voice_missed_call_recovery_type as enum (
      'missed_inbound_call',
      'abandoned_ai_receptionist',
      'voicemail_left',
      'transfer_failed',
      'after_hours_call',
      'no_operator_available'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_missed_call_recovery_status'
  ) then
    create type voice.voice_missed_call_recovery_status as enum (
      'active',
      'acknowledged',
      'dismissed',
      'resolved',
      'expired'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_drop_campaign_status'
  ) then
    create type voice.voice_drop_campaign_status as enum (
      'draft',
      'pending_approval',
      'approved',
      'scheduled',
      'running',
      'paused',
      'completed',
      'failed',
      'canceled'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_drop_campaign_type'
  ) then
    create type voice.voice_drop_campaign_type as enum (
      'voicemail_drop',
      'ringless_voicemail',
      'callback_follow_up',
      'personalized_voicemail'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_drop_approval_status'
  ) then
    create type voice.voice_drop_approval_status as enum (
      'draft',
      'pending_approval',
      'approved',
      'rejected'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_drop_recipient_status'
  ) then
    create type voice.voice_drop_recipient_status as enum (
      'pending',
      'suppressed',
      'queued',
      'delivered',
      'failed',
      'skipped'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_drop_delivery_status'
  ) then
    create type voice.voice_drop_delivery_status as enum (
      'queued',
      'in_progress',
      'delivered',
      'failed',
      'canceled'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_drop_provider'
  ) then
    create type voice.voice_drop_provider as enum (
      'stub',
      'twilio',
      'ringless_future'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_callback_task_priority'
  ) then
    create type voice.voice_callback_task_priority as enum (
      'low',
      'normal',
      'high',
      'urgent'
    );
  end if;
end;
$$;

create table if not exists voice.voice_missed_call_recovery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid references voice.voice_calls (id) on delete set null,
  voice_conversation_id uuid references voice.voice_conversations (id) on delete set null,
  relationship_memory_profile_id uuid references voice.voice_relationship_memory_profiles (id) on delete set null,
  phone_number text not null,
  caller_name text,
  recovery_status voice.voice_missed_call_recovery_status not null default 'active',
  recovery_type voice.voice_missed_call_recovery_type not null,
  recommended_action text not null default 'callback',
  evidence_text text not null default '',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
);

comment on table voice.voice_missed_call_recovery_events is
  'Missed-call recovery events — operator-controlled follow-up, no autonomous outbound.';

create index if not exists idx_voice_missed_call_recovery_org_status
  on voice.voice_missed_call_recovery_events (organization_id, recovery_status, created_at desc);

create index if not exists idx_voice_missed_call_recovery_org_call
  on voice.voice_missed_call_recovery_events (organization_id, voice_call_id);

create table if not exists voice.voice_callback_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recovery_event_id uuid references voice.voice_missed_call_recovery_events (id) on delete set null,
  voice_call_id uuid references voice.voice_calls (id) on delete set null,
  assigned_owner_user_id uuid,
  phone_number text not null,
  contact_name text,
  priority voice.voice_callback_task_priority not null default 'normal',
  due_at timestamptz,
  preferred_window_start timestamptz,
  preferred_window_end timestamptz,
  handoff_summary text,
  relationship_context text,
  status text not null default 'recommended',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_callback_tasks is
  'Callback recommendations — operator must initiate dial; no auto-call.';

create index if not exists idx_voice_callback_tasks_org_due
  on voice.voice_callback_tasks (organization_id, due_at, status);

create table if not exists voice.voice_drop_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  status voice.voice_drop_campaign_status not null default 'draft',
  campaign_type voice.voice_drop_campaign_type not null default 'voicemail_drop',
  message_template text not null default '',
  voice_provider voice.voice_drop_provider not null default 'stub',
  voice_id text,
  approval_status voice.voice_drop_approval_status not null default 'draft',
  scheduled_at timestamptz,
  created_by uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_drop_campaigns is
  'Voice drop campaigns — approval required before scheduling or delivery.';

create index if not exists idx_voice_drop_campaigns_org_status
  on voice.voice_drop_campaigns (organization_id, status, updated_at desc);

create table if not exists voice.voice_drop_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references voice.voice_drop_campaigns (id) on delete cascade,
  related_customer_id uuid,
  related_prospect_id uuid,
  phone_number text not null,
  recipient_name text,
  status voice.voice_drop_recipient_status not null default 'pending',
  suppression_reason text,
  delivery_attempt_count smallint not null default 0,
  last_attempt_at timestamptz,
  rendered_message_preview text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_drop_recipients is
  'Voice drop recipients — compliance-gated before queueing.';

create index if not exists idx_voice_drop_recipients_campaign_status
  on voice.voice_drop_recipients (campaign_id, status);

create unique index if not exists idx_voice_drop_recipients_campaign_phone
  on voice.voice_drop_recipients (campaign_id, phone_number);

create table if not exists voice.voice_drop_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references voice.voice_drop_campaigns (id) on delete cascade,
  recipient_id uuid not null references voice.voice_drop_recipients (id) on delete cascade,
  provider voice.voice_drop_provider not null,
  provider_delivery_id text,
  status voice.voice_drop_delivery_status not null default 'queued',
  failure_reason text,
  delivered_at timestamptz,
  duration_seconds integer,
  cost_amount numeric(12, 4),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table voice.voice_drop_delivery_attempts is
  'Append-only voice drop delivery attempts — auditable provider outcomes.';

create index if not exists idx_voice_drop_delivery_attempts_recipient
  on voice.voice_drop_delivery_attempts (recipient_id, created_at desc);

alter table voice.voice_missed_call_recovery_events enable row level security;
alter table voice.voice_callback_tasks enable row level security;
alter table voice.voice_drop_campaigns enable row level security;
alter table voice.voice_drop_recipients enable row level security;
alter table voice.voice_drop_delivery_attempts enable row level security;

create policy voice_missed_call_recovery_select on voice.voice_missed_call_recovery_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_callback_tasks_select on voice.voice_callback_tasks
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_drop_campaigns_select on voice.voice_drop_campaigns
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_drop_recipients_select on voice.voice_drop_recipients
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_drop_delivery_attempts_select on voice.voice_drop_delivery_attempts
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert, update, delete on voice.voice_missed_call_recovery_events to service_role;
grant select, insert, update, delete on voice.voice_callback_tasks to service_role;
grant select, insert, update, delete on voice.voice_drop_campaigns to service_role;
grant select, insert, update, delete on voice.voice_drop_recipients to service_role;
grant select, insert, update, delete on voice.voice_drop_delivery_attempts to service_role;

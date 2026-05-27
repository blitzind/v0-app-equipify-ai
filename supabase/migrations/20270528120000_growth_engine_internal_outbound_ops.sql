-- Growth Engine internal outbound operations (Phase 1): audit trail for operational pauses and pre-send blocks.

create table if not exists growth.internal_outbound_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'medium',
  title text not null,
  summary text,
  sender_account_id uuid references growth.sender_accounts(id) on delete set null,
  sender_pool_id uuid references growth.sender_pools(id) on delete set null,
  mailbox_connection_id uuid references growth.mailbox_connections(id) on delete set null,
  sender_domain_id uuid references growth.sender_domains(id) on delete set null,
  delivery_attempt_id uuid references growth.delivery_attempts(id) on delete set null,
  actor_user_id text,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists internal_outbound_audit_events_created_idx
  on growth.internal_outbound_audit_events (created_at desc);

create index if not exists internal_outbound_audit_events_type_created_idx
  on growth.internal_outbound_audit_events (event_type, created_at desc);

comment on table growth.internal_outbound_audit_events is
  'Internal outbound ops audit — sender pauses, pre-send blocks, OAuth failures. No secrets.';

alter table growth.sender_pool_members
  add column if not exists operational_pause_reason text,
  add column if not exists operational_paused_at timestamptz;

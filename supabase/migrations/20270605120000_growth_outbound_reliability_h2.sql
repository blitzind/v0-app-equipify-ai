-- Growth Engine H2 — Outbound Reliability & Recovery (internal operator hardening)

do $$
begin
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
  if to_regclass('growth.outreach_queue') is null then
    raise exception 'Missing dependency: growth.outreach_queue';
  end if;
end $$;

-- delivery_attempts — adapter-plane telemetry (Lemlist / outbound provider adapters)
alter table growth.delivery_attempts
  alter column provider_id drop not null,
  alter column sender_account_id drop not null;

alter table growth.delivery_attempts
  add column if not exists provider_connection_id uuid references growth.email_provider_connections (id) on delete set null,
  add column if not exists outreach_queue_id uuid references growth.outreach_queue (id) on delete set null,
  add column if not exists failure_class text,
  add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0),
  add column if not exists send_plane text not null default 'transport'
    check (send_plane in ('transport', 'adapter'));

create index if not exists idx_growth_delivery_attempts_outreach_queue
  on growth.delivery_attempts (outreach_queue_id)
  where outreach_queue_id is not null;

create index if not exists idx_growth_delivery_attempts_provider_connection
  on growth.delivery_attempts (provider_connection_id)
  where provider_connection_id is not null;

create index if not exists idx_growth_delivery_attempts_failure_class
  on growth.delivery_attempts (failure_class, created_at desc)
  where failure_class is not null;

alter table growth.delivery_attempts drop constraint if exists delivery_attempts_routing_check;
alter table growth.delivery_attempts add constraint delivery_attempts_routing_check check (
  provider_id is not null
  or provider_connection_id is not null
);

-- outreach_queue — dead-letter + replay recovery
alter table growth.outreach_queue
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists failure_class text,
  add column if not exists dead_letter_at timestamptz,
  add column if not exists last_retry_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null;

create index if not exists idx_growth_outreach_queue_dead_letter
  on growth.outreach_queue (dead_letter_at desc)
  where dead_letter_at is not null;

create index if not exists idx_growth_outreach_queue_processing
  on growth.outreach_queue (processing_started_at)
  where processing_started_at is not null and status = 'approved';

alter table growth.outreach_queue drop constraint if exists outreach_queue_status_check;
alter table growth.outreach_queue add constraint outreach_queue_status_check check (
  status in (
    'draft', 'pending_approval', 'approved', 'scheduled', 'executed', 'failed', 'cancelled', 'dead_letter'
  )
);

alter table growth.outreach_queue_events drop constraint if exists outreach_queue_events_event_type_check;
alter table growth.outreach_queue_events add constraint outreach_queue_events_event_type_check check (
  event_type in (
    'queued', 'approved', 'scheduled', 'regenerated', 'execution_started',
    'executed', 'failed', 'cancelled', 'replay_requested', 'dead_lettered', 'retry_scheduled'
  )
);

comment on column growth.delivery_attempts.send_plane is
  'transport = live provider transport orchestrator; adapter = outreach queue provider adapter (e.g. Lemlist).';

comment on column growth.outreach_queue.dead_letter_at is
  'Terminal failure timestamp — item requires operator review before replay.';

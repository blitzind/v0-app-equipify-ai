-- GE-AIOS-END-TO-END-1C.1 — Immutable transport snapshot identity for audit/replay.

alter table growth.sequence_execution_jobs
  add column if not exists transport_snapshot_id uuid;

alter table growth.delivery_attempts
  add column if not exists transport_snapshot_id uuid;

create unique index if not exists idx_growth_sequence_execution_jobs_transport_snapshot_id
  on growth.sequence_execution_jobs (transport_snapshot_id)
  where transport_snapshot_id is not null;

create index if not exists idx_growth_delivery_attempts_transport_snapshot_id
  on growth.delivery_attempts (transport_snapshot_id)
  where transport_snapshot_id is not null;

create index if not exists idx_growth_delivery_attempts_provider_message_id
  on growth.delivery_attempts (provider_message_id)
  where provider_message_id is not null;

comment on column growth.sequence_execution_jobs.transport_snapshot_id is
  'GE-AIOS-END-TO-END-1C.1 — Permanent immutable identity for the bound transport snapshot.';

comment on column growth.delivery_attempts.transport_snapshot_id is
  'GE-AIOS-END-TO-END-1C.1 — Immutable snapshot identity carried through retries and provider delivery.';

-- GE-AUTO-2D — Persistent objective source event dedupe receipts

create table if not exists growth.objective_source_event_receipts (
  idempotency_key text primary key,
  organization_id uuid not null,
  source text not null,
  signal_type text not null,
  lead_id uuid,
  received_at timestamptz not null default now()
);

create index if not exists objective_source_event_receipts_org_received_idx
  on growth.objective_source_event_receipts (organization_id, received_at desc);

comment on table growth.objective_source_event_receipts is
  'GE-AUTO-2D — durable idempotency receipts for objective event router fan-in.';

alter table growth.objective_source_event_receipts enable row level security;

grant select, insert on growth.objective_source_event_receipts to service_role;

create policy objective_source_event_receipts_service_role on growth.objective_source_event_receipts
  for all
  to service_role
  using (true)
  with check (true);

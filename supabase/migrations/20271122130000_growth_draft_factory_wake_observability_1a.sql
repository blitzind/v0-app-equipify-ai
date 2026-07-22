-- GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Durable wake attempt ledger + handler/subscriber telemetry.

do $$
begin
  if to_regclass('growth.ai_os_events') is null then
    raise exception 'Missing dependency: growth.ai_os_events';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.draft_factory_wake_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references growth.ai_os_events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete cascade,
  research_run_id text,
  wake_type text not null,
  subscriber_id text not null default 'draft_factory_wake_observer',
  wake_fingerprint text,
  invocation_source text not null default '',
  runtime_instance text not null default '',
  current_stage text not null default 'CREATED',
  terminal_outcome text check (terminal_outcome in ('SUCCESS', 'FAILED', 'SKIPPED')),
  terminal_reason text,
  correlation_event_id uuid not null,
  qa_marker text not null default 'ge-aios-draft-factory-wake-observability-1a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists draft_factory_wake_attempts_event_idx
  on growth.draft_factory_wake_attempts (event_id, created_at desc);

create index if not exists draft_factory_wake_attempts_lead_idx
  on growth.draft_factory_wake_attempts (organization_id, lead_id, created_at desc);

create index if not exists draft_factory_wake_attempts_terminal_idx
  on growth.draft_factory_wake_attempts (organization_id, terminal_outcome, created_at desc);

create table if not exists growth.draft_factory_wake_attempt_transitions (
  id uuid primary key default gen_random_uuid(),
  wake_attempt_id uuid not null references growth.draft_factory_wake_attempts (id) on delete cascade,
  stage text not null check (
    stage in (
      'CREATED',
      'HANDLER_STARTED',
      'PLAN_CREATED',
      'ADVANCE_STARTED',
      'UPSERT_COMPLETED',
      'RECEIPT_WRITTEN',
      'SUCCESS',
      'FAILED',
      'SKIPPED'
    )
  ),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  failure_type text,
  failure_message text,
  failure_stack text,
  failure_function text,
  failure_file text,
  failure_line integer,
  qa_marker text not null default 'ge-aios-draft-factory-wake-observability-1a-v1'
);

create index if not exists draft_factory_wake_attempt_transitions_attempt_idx
  on growth.draft_factory_wake_attempt_transitions (wake_attempt_id, occurred_at asc);

create table if not exists growth.ai_os_event_handler_telemetry (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references growth.ai_os_events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  handlers_discovered jsonb not null default '[]'::jsonb,
  handlers_invoked jsonb not null default '[]'::jsonb,
  handlers_skipped jsonb not null default '[]'::jsonb,
  handler_failures jsonb not null default '[]'::jsonb,
  runtime_instance text not null default '',
  qa_marker text not null default 'ge-aios-draft-factory-wake-observability-1a-v1',
  created_at timestamptz not null default now()
);

create unique index if not exists ai_os_event_handler_telemetry_event_unique
  on growth.ai_os_event_handler_telemetry (event_id);

create table if not exists growth.draft_factory_wake_subscriber_telemetry (
  id uuid primary key default gen_random_uuid(),
  wake_attempt_id uuid references growth.draft_factory_wake_attempts (id) on delete cascade,
  event_id uuid not null references growth.ai_os_events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscriber_id text not null,
  received boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null check (status in ('received', 'started', 'completed', 'failed', 'skipped')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  skip_reason text,
  error_message text,
  qa_marker text not null default 'ge-aios-draft-factory-wake-observability-1a-v1',
  created_at timestamptz not null default now()
);

create index if not exists draft_factory_wake_subscriber_telemetry_attempt_idx
  on growth.draft_factory_wake_subscriber_telemetry (wake_attempt_id, created_at desc);

create index if not exists draft_factory_wake_subscriber_telemetry_event_idx
  on growth.draft_factory_wake_subscriber_telemetry (event_id, subscriber_id);

comment on table growth.draft_factory_wake_attempts is
  'GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A canonical wake attempt ledger — every DF wake leaves durable evidence.';

comment on table growth.draft_factory_wake_attempt_transitions is
  'Append-only lifecycle transitions for draft factory wake attempts.';

comment on table growth.ai_os_event_handler_telemetry is
  'Durable in-process handler invocation telemetry per AI OS event publish.';

comment on table growth.draft_factory_wake_subscriber_telemetry is
  'Per-subscriber execution evidence for draft factory wake observer runs.';

revoke all on table growth.draft_factory_wake_attempts from public, anon, authenticated;
revoke all on table growth.draft_factory_wake_attempt_transitions from public, anon, authenticated;
revoke all on table growth.ai_os_event_handler_telemetry from public, anon, authenticated;
revoke all on table growth.draft_factory_wake_subscriber_telemetry from public, anon, authenticated;

grant select, insert, update, delete on table growth.draft_factory_wake_attempts to service_role;
grant select, insert, update, delete on table growth.draft_factory_wake_attempt_transitions to service_role;
grant select, insert, update, delete on table growth.ai_os_event_handler_telemetry to service_role;
grant select, insert, update, delete on table growth.draft_factory_wake_subscriber_telemetry to service_role;

alter table growth.draft_factory_wake_attempts enable row level security;
alter table growth.draft_factory_wake_attempts force row level security;
alter table growth.draft_factory_wake_attempt_transitions enable row level security;
alter table growth.draft_factory_wake_attempt_transitions force row level security;
alter table growth.ai_os_event_handler_telemetry enable row level security;
alter table growth.ai_os_event_handler_telemetry force row level security;
alter table growth.draft_factory_wake_subscriber_telemetry enable row level security;
alter table growth.draft_factory_wake_subscriber_telemetry force row level security;

drop policy if exists draft_factory_wake_attempts_service_role on growth.draft_factory_wake_attempts;
create policy draft_factory_wake_attempts_service_role
  on growth.draft_factory_wake_attempts for all to service_role using (true) with check (true);

drop policy if exists draft_factory_wake_attempt_transitions_service_role on growth.draft_factory_wake_attempt_transitions;
create policy draft_factory_wake_attempt_transitions_service_role
  on growth.draft_factory_wake_attempt_transitions for all to service_role using (true) with check (true);

drop policy if exists ai_os_event_handler_telemetry_service_role on growth.ai_os_event_handler_telemetry;
create policy ai_os_event_handler_telemetry_service_role
  on growth.ai_os_event_handler_telemetry for all to service_role using (true) with check (true);

drop policy if exists draft_factory_wake_subscriber_telemetry_service_role on growth.draft_factory_wake_subscriber_telemetry;
create policy draft_factory_wake_subscriber_telemetry_service_role
  on growth.draft_factory_wake_subscriber_telemetry for all to service_role using (true) with check (true);

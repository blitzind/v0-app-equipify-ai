-- Growth Engine operational send plane: cron execution telemetry for queue observability.

create table if not exists growth.cron_execution_runs (
  id uuid primary key default gen_random_uuid(),
  cron_route text not null,
  category text not null default 'growth',
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  ok boolean not null default false,
  processed_count integer not null default 0 check (processed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cron_execution_runs_route_started_idx
  on growth.cron_execution_runs (cron_route, started_at desc);

create index if not exists cron_execution_runs_ok_started_idx
  on growth.cron_execution_runs (ok, started_at desc);

comment on table growth.cron_execution_runs is
  'Growth cron execution telemetry — last run, duration, failure counts, queue lag metadata.';

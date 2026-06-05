-- Phase 7.PS-IJ — Apollo replacement benchmark cohort + snapshot storage.
-- Runtime also persists via growth.discovery_refresh_queue for cert compatibility.

create table if not exists growth.apollo_replacement_benchmark_cohorts (
  id uuid primary key default gen_random_uuid(),
  benchmark_id text not null unique,
  cohort_version text not null,
  company_ids uuid[] not null default '{}',
  company_count int not null default 0 check (company_count >= 0),
  composition jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.apollo_replacement_benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  benchmark_id text not null,
  phase_name text not null,
  phase_version text not null,
  snapshot_kind text not null
    check (snapshot_kind in ('baseline', 'phase_run', 'comparison')),
  metrics jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  unique (benchmark_id, phase_version)
);

create index if not exists apollo_replacement_benchmark_snapshots_benchmark_idx
  on growth.apollo_replacement_benchmark_snapshots (benchmark_id, captured_at desc);

revoke all on table growth.apollo_replacement_benchmark_cohorts from public, anon, authenticated;
revoke all on table growth.apollo_replacement_benchmark_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_replacement_benchmark_cohorts to service_role;
grant select, insert, update, delete on table growth.apollo_replacement_benchmark_snapshots to service_role;

alter table growth.apollo_replacement_benchmark_cohorts enable row level security;
alter table growth.apollo_replacement_benchmark_snapshots enable row level security;

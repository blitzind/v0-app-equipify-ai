-- Anonymized industry-segmented operational benchmarks (aggregate-only).
-- Populated by a trusted batch job (service role). No tenant ids, customer PII, or raw WO rows stored here.

create table if not exists public.platform_industry_operational_benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  industry_key text not null,
  metric_key text not null,
  reporting_window_days integer not null default 30
    check (reporting_window_days > 0 and reporting_window_days <= 365),
  orgs_contributing integer not null check (orgs_contributing >= 0),
  p10 numeric,
  p25 numeric,
  p50 numeric,
  p75 numeric,
  p90 numeric,
  mean numeric,
  methodology_version text not null default 'equipify_ops_benchmark_v1',
  computed_at timestamptz not null default now()
);

comment on table public.platform_industry_operational_benchmark_snapshots is
  'Pre-aggregated operational distribution summaries per industry/metric. No organization identifiers. '
  'Rows are only meaningful when orgs_contributing meets the platform minimum published in the app.';

create index if not exists idx_platform_ind_ops_bench_lookup
  on public.platform_industry_operational_benchmark_snapshots (industry_key, metric_key, reporting_window_days, computed_at desc);

alter table public.platform_industry_operational_benchmark_snapshots enable row level security;
alter table public.platform_industry_operational_benchmark_snapshots force row level security;

revoke all on table public.platform_industry_operational_benchmark_snapshots from public, anon, authenticated;

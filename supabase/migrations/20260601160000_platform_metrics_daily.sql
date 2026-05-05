-- Daily platform-wide aggregates for admin analytics (written via service role).

create table if not exists public.platform_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  total_accounts integer not null default 0,
  active_accounts integer not null default 0,
  trialing_accounts integer not null default 0,
  archived_accounts integer not null default 0,
  total_mrr numeric not null default 0,
  active_seats integer not null default 0,
  equipment_records integer not null default 0,
  work_orders integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.platform_metrics_daily is
  'Platform admin analytics snapshots; total_mrr is stored in cents (same as billing code).';

create index if not exists idx_platform_metrics_daily_metric_date
  on public.platform_metrics_daily (metric_date desc);

alter table public.platform_metrics_daily enable row level security;
alter table public.platform_metrics_daily force row level security;

revoke all on table public.platform_metrics_daily from public, anon, authenticated;

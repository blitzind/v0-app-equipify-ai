-- Growth Engine Slice 6.20A — Revenue forecasting + executive operating layer.

create table if not exists growth.revenue_forecast_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  monthly_goal numeric not null default 0 check (monthly_goal >= 0),
  quarterly_goal numeric not null default 0 check (quarterly_goal >= 0),
  default_forecast_period text not null default 'this_quarter'
    check (default_forecast_period in ('this_month', 'next_month', 'this_quarter', 'next_quarter')),
  stale_deal_threshold_days int not null default 14 check (stale_deal_threshold_days > 0),
  coverage_target_multiplier numeric not null default 3 check (coverage_target_multiplier > 0),
  high_value_deal_threshold numeric not null default 25000 check (high_value_deal_threshold >= 0),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.revenue_forecast_settings (singleton)
select true
where not exists (select 1 from growth.revenue_forecast_settings where singleton = true);

create table if not exists growth.revenue_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  period_key text not null,
  totals jsonb not null default '{}'::jsonb,
  opportunity_fingerprints jsonb not null default '[]'::jsonb,
  qa_marker text not null default 'growth-revenue-operating-v1'
);

create index if not exists idx_revenue_forecast_snapshots_period
  on growth.revenue_forecast_snapshots (period_key, snapshot_at desc);

create table if not exists growth.revenue_forecast_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  title text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_revenue_forecast_movements_created
  on growth.revenue_forecast_movements (created_at desc);

create index if not exists idx_revenue_forecast_movements_opp
  on growth.revenue_forecast_movements (opportunity_id, created_at desc)
  where opportunity_id is not null;

revoke all on table growth.revenue_forecast_settings from public, anon, authenticated;
revoke all on table growth.revenue_forecast_snapshots from public, anon, authenticated;
revoke all on table growth.revenue_forecast_movements from public, anon, authenticated;

grant select, insert, update on table growth.revenue_forecast_settings to service_role;
grant select, insert, delete on table growth.revenue_forecast_snapshots to service_role;
grant select, insert on table growth.revenue_forecast_movements to service_role;

alter table growth.revenue_forecast_settings enable row level security;
alter table growth.revenue_forecast_snapshots enable row level security;
alter table growth.revenue_forecast_movements enable row level security;

alter table growth.revenue_forecast_settings force row level security;
alter table growth.revenue_forecast_snapshots force row level security;
alter table growth.revenue_forecast_movements force row level security;

-- Growth Engine GS-RG-1C — Production readiness patch (user budgets + health counters).
-- Extends GS-RG-1. Local only until bundled deploy approval.

do $$
begin
  if to_regclass('growth.runtime_budgets') is null then
    raise exception 'Missing dependency: growth.runtime_budgets (apply GS-RG-1 migration first)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.runtime_user_budgets — per-user consumption windows
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_user_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  resource_type text not null,
  window_kind text not null check (window_kind in ('hourly', 'daily', 'monthly')),
  window_start timestamptz not null,
  count bigint not null default 0 check (count >= 0),
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1c-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, resource_type, window_kind, window_start)
);

create index if not exists idx_growth_runtime_user_budgets_lookup
  on growth.runtime_user_budgets (organization_id, user_id, resource_type, window_start desc);

comment on table growth.runtime_user_budgets is
  'GS-RG-1C per-user runtime budgets — evaluated AND org budgets.';

-- -----------------------------------------------------------------------------
-- growth.runtime_health_counters — lightweight platform estimate counters
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_health_counters (
  counter_key text primary key default 'platform',
  window_start timestamptz not null,
  runtime_reads_estimate bigint not null default 0 check (runtime_reads_estimate >= 0),
  runtime_writes_estimate bigint not null default 0 check (runtime_writes_estimate >= 0),
  runtime_throttle_count bigint not null default 0 check (runtime_throttle_count >= 0),
  runtime_failure_count bigint not null default 0 check (runtime_failure_count >= 0),
  last_failure_at timestamptz,
  last_failure_message text,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1c-v1',
  updated_at timestamptz not null default now()
);

insert into growth.runtime_health_counters (counter_key, window_start)
values ('platform', date_trunc('day', now()))
on conflict (counter_key) do nothing;

comment on table growth.runtime_health_counters is
  'GS-RG-1C append-only estimate counters — no per-query logging.';

-- Extend retention batch state with last run duration
alter table growth.runtime_retention_batch_state
  add column if not exists last_duration_ms integer check (last_duration_ms is null or last_duration_ms >= 0);

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

alter table growth.runtime_user_budgets enable row level security;
alter table growth.runtime_user_budgets force row level security;
alter table growth.runtime_health_counters enable row level security;
alter table growth.runtime_health_counters force row level security;

revoke all on growth.runtime_user_budgets from public, anon, authenticated;
revoke all on growth.runtime_health_counters from public, anon, authenticated;

grant select, insert, update, delete on growth.runtime_user_budgets to service_role;
grant select, insert, update, delete on growth.runtime_health_counters to service_role;

drop policy if exists growth_runtime_user_budgets_service_role on growth.runtime_user_budgets;
create policy growth_runtime_user_budgets_service_role
  on growth.runtime_user_budgets for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_health_counters_service_role on growth.runtime_health_counters;
create policy growth_runtime_health_counters_service_role
  on growth.runtime_health_counters for all to service_role using (true) with check (true);

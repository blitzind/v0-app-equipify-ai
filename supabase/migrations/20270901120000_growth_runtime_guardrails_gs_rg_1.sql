-- Growth Engine GS-RG-1 — Runtime Guardrails Foundation.
-- Infrastructure hardening only: budgets, wake batching, incremental rollups, retention, cascade limits.
-- No automation execution, no autonomous sends, no conversational agents.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.runtime_budgets — org-scoped consumption windows (Supabase only, no Redis)
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource_type text not null,
  window_kind text not null check (window_kind in ('hourly', 'daily', 'monthly')),
  window_start timestamptz not null,
  count bigint not null default 0 check (count >= 0),
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, resource_type, window_kind, window_start)
);

create index if not exists idx_growth_runtime_budgets_org_resource
  on growth.runtime_budgets (organization_id, resource_type, window_start desc);

comment on table growth.runtime_budgets is
  'GS-RG-1 org runtime budgets — hourly/daily/monthly consumption counters.';

-- -----------------------------------------------------------------------------
-- growth.runtime_guardrail_settings — kill switches + platform overrides
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_guardrail_settings (
  key text primary key,
  enabled boolean not null default true,
  value_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  updated_at timestamptz not null default now()
);

insert into growth.runtime_guardrail_settings (key, enabled, value_json)
values
  ('wake_execution_enabled', true, '{}'::jsonb),
  ('media_rollup_enabled', true, '{}'::jsonb),
  ('search_execution_enabled', true, '{}'::jsonb),
  ('retention_worker_enabled', true, '{}'::jsonb),
  ('cascade_budget_enforcement_enabled', true, '{}'::jsonb)
on conflict (key) do nothing;

comment on table growth.runtime_guardrail_settings is
  'GS-RG-1 kill switches — immediately disableable runtime paths.';

-- -----------------------------------------------------------------------------
-- growth.runtime_wake_batch_state — cursor for batched wait evaluation
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_wake_batch_state (
  processor_key text primary key,
  wake_cursor text,
  processed_count bigint not null default 0 check (processed_count >= 0),
  remaining_count bigint not null default 0 check (remaining_count >= 0),
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  updated_at timestamptz not null default now()
);

insert into growth.runtime_wake_batch_state (processor_key, wake_cursor, processed_count, remaining_count)
values
  ('sequence_wait_timeouts', null, 0, 0),
  ('sequence_event_wake', null, 0, 0)
on conflict (processor_key) do nothing;

comment on table growth.runtime_wake_batch_state is
  'GS-RG-1 wake engine batch cursors — never evaluate unlimited waits.';

-- -----------------------------------------------------------------------------
-- growth.growth_event_retention_config — raw event retention policies
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_event_retention_config (
  event_family text primary key,
  retention_days integer not null default 90 check (retention_days > 0),
  rollup_retention_days integer not null default -1,
  enabled boolean not null default true,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  updated_at timestamptz not null default now()
);

insert into growth.growth_event_retention_config (event_family, retention_days, rollup_retention_days)
values
  ('share_page_events', 90, -1),
  ('video_page_events', 90, -1),
  ('media_asset_events', 90, -1),
  ('intent_events', 90, -1),
  ('notification_events', 90, -1)
on conflict (event_family) do nothing;

comment on table growth.growth_event_retention_config is
  'GS-RG-1 raw event retention — rollups indefinite (-1).';

-- -----------------------------------------------------------------------------
-- growth.video_page_rollups — incremental video page analytics rollups
-- -----------------------------------------------------------------------------

create table if not exists growth.video_page_rollups (
  video_page_id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  views bigint not null default 0 check (views >= 0),
  unique_viewers bigint not null default 0 check (unique_viewers >= 0),
  completions bigint not null default 0 check (completions >= 0),
  avg_watch_percent numeric(5, 2) not null default 0 check (avg_watch_percent >= 0 and avg_watch_percent <= 100),
  cta_clicks bigint not null default 0 check (cta_clicks >= 0),
  total_watch_percent_sum numeric(14, 2) not null default 0,
  watch_session_count bigint not null default 0 check (watch_session_count >= 0),
  last_event_at timestamptz,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_video_page_rollups_org
  on growth.video_page_rollups (organization_id, updated_at desc);

comment on table growth.video_page_rollups is
  'GS-RG-1 incremental video page rollups — never delete with raw retention.';

-- Extend media asset rollups for incremental watch averaging (if table exists)
do $$
begin
  if to_regclass('growth.media_asset_event_rollups') is not null then
    alter table growth.media_asset_event_rollups
      add column if not exists total_watch_seconds numeric(14, 3) not null default 0,
      add column if not exists watch_session_count bigint not null default 0;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.runtime_cascade_budgets — per-event fan-out tracking
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_cascade_budgets (
  event_id text primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  writes_generated bigint not null default 0 check (writes_generated >= 0),
  notifications_generated bigint not null default 0 check (notifications_generated >= 0),
  wake_evaluations_generated bigint not null default 0 check (wake_evaluations_generated >= 0),
  budget_exceeded boolean not null default false,
  stopped_at timestamptz,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_runtime_cascade_budgets_org
  on growth.runtime_cascade_budgets (organization_id, created_at desc);

comment on table growth.runtime_cascade_budgets is
  'GS-RG-1 cascade budget — one event must not fan out unbounded downstream writes.';

-- -----------------------------------------------------------------------------
-- growth.runtime_search_audit_log — prospect search observability
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_search_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id uuid,
  operation text not null check (operation in ('search', 'estimate', 'refresh', 'hydration')),
  query text,
  rows_returned integer not null default 0,
  rows_hydrated integer not null default 0,
  duration_ms integer not null default 0,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_runtime_search_audit_org_created
  on growth.runtime_search_audit_log (organization_id, created_at desc);

comment on table growth.runtime_search_audit_log is
  'GS-RG-1 prospect search audit — query, rows, duration.';

-- -----------------------------------------------------------------------------
-- growth.runtime_guardrail_audit_log — budget exceeded + throttle warnings
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_guardrail_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  resource_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'error')),
  message text not null,
  context_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_runtime_guardrail_audit_org_created
  on growth.runtime_guardrail_audit_log (organization_id, created_at desc);

comment on table growth.runtime_guardrail_audit_log is
  'GS-RG-1 guardrail violations — budget exceeded, throttles, kill switch blocks.';

-- -----------------------------------------------------------------------------
-- growth.runtime_retention_batch_state — retention worker cursor
-- -----------------------------------------------------------------------------

create table if not exists growth.runtime_retention_batch_state (
  event_family text primary key,
  last_deleted_id uuid,
  deleted_count bigint not null default 0 check (deleted_count >= 0),
  last_run_at timestamptz,
  qa_marker text not null default 'growth-runtime-guardrails-gs-rg-1-v1',
  updated_at timestamptz not null default now()
);

insert into growth.runtime_retention_batch_state (event_family)
select event_family from growth.growth_event_retention_config
on conflict (event_family) do nothing;

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

alter table growth.runtime_budgets enable row level security;
alter table growth.runtime_budgets force row level security;
alter table growth.runtime_guardrail_settings enable row level security;
alter table growth.runtime_guardrail_settings force row level security;
alter table growth.runtime_wake_batch_state enable row level security;
alter table growth.runtime_wake_batch_state force row level security;
alter table growth.growth_event_retention_config enable row level security;
alter table growth.growth_event_retention_config force row level security;
alter table growth.video_page_rollups enable row level security;
alter table growth.video_page_rollups force row level security;
alter table growth.runtime_cascade_budgets enable row level security;
alter table growth.runtime_cascade_budgets force row level security;
alter table growth.runtime_search_audit_log enable row level security;
alter table growth.runtime_search_audit_log force row level security;
alter table growth.runtime_guardrail_audit_log enable row level security;
alter table growth.runtime_guardrail_audit_log force row level security;
alter table growth.runtime_retention_batch_state enable row level security;
alter table growth.runtime_retention_batch_state force row level security;

revoke all on growth.runtime_budgets from public, anon, authenticated;
revoke all on growth.runtime_guardrail_settings from public, anon, authenticated;
revoke all on growth.runtime_wake_batch_state from public, anon, authenticated;
revoke all on growth.growth_event_retention_config from public, anon, authenticated;
revoke all on growth.video_page_rollups from public, anon, authenticated;
revoke all on growth.runtime_cascade_budgets from public, anon, authenticated;
revoke all on growth.runtime_search_audit_log from public, anon, authenticated;
revoke all on growth.runtime_guardrail_audit_log from public, anon, authenticated;
revoke all on growth.runtime_retention_batch_state from public, anon, authenticated;

grant select, insert, update, delete on growth.runtime_budgets to service_role;
grant select, insert, update, delete on growth.runtime_guardrail_settings to service_role;
grant select, insert, update, delete on growth.runtime_wake_batch_state to service_role;
grant select, insert, update, delete on growth.growth_event_retention_config to service_role;
grant select, insert, update, delete on growth.video_page_rollups to service_role;
grant select, insert, update, delete on growth.runtime_cascade_budgets to service_role;
grant select, insert, update, delete on growth.runtime_search_audit_log to service_role;
grant select, insert, update, delete on growth.runtime_guardrail_audit_log to service_role;
grant select, insert, update, delete on growth.runtime_retention_batch_state to service_role;

drop policy if exists growth_runtime_budgets_service_role on growth.runtime_budgets;
create policy growth_runtime_budgets_service_role on growth.runtime_budgets for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_guardrail_settings_service_role on growth.runtime_guardrail_settings;
create policy growth_runtime_guardrail_settings_service_role on growth.runtime_guardrail_settings for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_wake_batch_state_service_role on growth.runtime_wake_batch_state;
create policy growth_runtime_wake_batch_state_service_role on growth.runtime_wake_batch_state for all to service_role using (true) with check (true);

drop policy if exists growth_growth_event_retention_config_service_role on growth.growth_event_retention_config;
create policy growth_growth_event_retention_config_service_role on growth.growth_event_retention_config for all to service_role using (true) with check (true);

drop policy if exists growth_video_page_rollups_service_role on growth.video_page_rollups;
create policy growth_video_page_rollups_service_role on growth.video_page_rollups for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_cascade_budgets_service_role on growth.runtime_cascade_budgets;
create policy growth_runtime_cascade_budgets_service_role on growth.runtime_cascade_budgets for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_search_audit_log_service_role on growth.runtime_search_audit_log;
create policy growth_runtime_search_audit_log_service_role on growth.runtime_search_audit_log for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_guardrail_audit_log_service_role on growth.runtime_guardrail_audit_log;
create policy growth_runtime_guardrail_audit_log_service_role on growth.runtime_guardrail_audit_log for all to service_role using (true) with check (true);

drop policy if exists growth_runtime_retention_batch_state_service_role on growth.runtime_retention_batch_state;
create policy growth_runtime_retention_batch_state_service_role on growth.runtime_retention_batch_state for all to service_role using (true) with check (true);

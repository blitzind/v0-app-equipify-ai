-- Growth Engine GS-RG-2B — Incremental Audience Refresh Policies.
-- Operator-initiated refresh, member diffs, people mode, inbox bridge metadata.
-- No autonomous jobs, no polling, no background workers.

do $$
begin
  if to_regclass('growth.growth_audiences') is null then
    raise exception 'Missing dependency: growth.growth_audiences (apply GS-RG-2A first)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Extend growth_audiences — refresh policy metadata (informational only)
-- Order: drop constraint → expand → migrate values → tighten constraint + default
-- -----------------------------------------------------------------------------

do $$
begin
  alter table growth.growth_audiences
    drop constraint if exists growth_audiences_refresh_policy_check;

  alter table growth.growth_audiences
    add constraint growth_audiences_refresh_policy_check
    check (refresh_policy in ('manual_only', 'manual', 'daily', 'weekly'));
exception
  when duplicate_object then
    null;
end;
$$;

update growth.growth_audiences
set refresh_policy = 'manual'
where refresh_policy = 'manual_only';

alter table growth.growth_audiences
  drop constraint if exists growth_audiences_refresh_policy_check;

alter table growth.growth_audiences
  add constraint growth_audiences_refresh_policy_check
  check (refresh_policy in ('manual', 'daily', 'weekly'));

alter table growth.growth_audiences
  alter column refresh_policy set default 'manual';

alter table growth.growth_audiences
  add column if not exists refresh_interval_days integer
    check (refresh_interval_days is null or refresh_interval_days > 0),
  add column if not exists next_refresh_at timestamptz,
  add column if not exists result_mode text not null default 'companies'
    check (result_mode in ('companies', 'people'));

comment on column growth.growth_audiences.refresh_policy is
  'GS-RG-2B informational refresh policy — never auto-executes.';

comment on column growth.growth_audiences.next_refresh_at is
  'GS-RG-2B suggested next refresh — operator must initiate manually.';

-- -----------------------------------------------------------------------------
-- Extend growth_audience_snapshots — diff summary columns
-- -----------------------------------------------------------------------------

alter table growth.growth_audience_snapshots
  add column if not exists previous_snapshot_id uuid references growth.growth_audience_snapshots (id) on delete set null,
  add column if not exists previous_member_count bigint not null default 0 check (previous_member_count >= 0),
  add column if not exists added_count bigint not null default 0 check (added_count >= 0),
  add column if not exists removed_count bigint not null default 0 check (removed_count >= 0),
  add column if not exists unchanged_count bigint not null default 0 check (unchanged_count >= 0),
  add column if not exists result_mode text not null default 'companies'
    check (result_mode in ('companies', 'people'));

-- -----------------------------------------------------------------------------
-- Extend growth_audience_members — people mode + diff keys
-- -----------------------------------------------------------------------------

alter table growth.growth_audience_members
  add column if not exists member_key text,
  add column if not exists member_kind text not null default 'company'
    check (member_kind in ('company', 'person')),
  add column if not exists growth_person_id text,
  add column if not exists canonical_person_id text,
  add column if not exists company_name text,
  add column if not exists person_name text,
  add column if not exists person_title text,
  add column if not exists company_relationship_json jsonb not null default '{}'::jsonb;

update growth.growth_audience_members
set member_key = company_id,
    member_kind = 'company'
where member_key is null and company_id is not null;

create index if not exists idx_growth_audience_members_snapshot_key
  on growth.growth_audience_members (snapshot_id, member_key)
  where member_key is not null;

create index if not exists idx_growth_audience_members_person
  on growth.growth_audience_members (growth_person_id)
  where growth_person_id is not null;

-- -----------------------------------------------------------------------------
-- growth.growth_audience_snapshot_diffs — diff run observability
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_snapshot_diffs (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references growth.growth_audiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  previous_snapshot_id uuid references growth.growth_audience_snapshots (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed', 'throttled')),
  previous_member_count bigint not null default 0 check (previous_member_count >= 0),
  current_member_count bigint not null default 0 check (current_member_count >= 0),
  added_count bigint not null default 0 check (added_count >= 0),
  removed_count bigint not null default 0 check (removed_count >= 0),
  unchanged_count bigint not null default 0 check (unchanged_count >= 0),
  diff_cursor text,
  processed_count bigint not null default 0 check (processed_count >= 0),
  rows_read bigint not null default 0 check (rows_read >= 0),
  rows_written bigint not null default 0 check (rows_written >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error text,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2b-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_snapshot_diffs_snapshot
  on growth.growth_audience_snapshot_diffs (snapshot_id);

create index if not exists idx_growth_audience_snapshot_diffs_audience
  on growth.growth_audience_snapshot_diffs (audience_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.growth_audience_member_diffs — lightweight added/removed entries
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_member_diffs (
  id uuid primary key default gen_random_uuid(),
  diff_id uuid not null references growth.growth_audience_snapshot_diffs (id) on delete cascade,
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_key text not null,
  change_kind text not null check (change_kind in ('added', 'removed')),
  member_kind text not null default 'company' check (member_kind in ('company', 'person')),
  display_label text,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2b-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_member_diffs_diff
  on growth.growth_audience_member_diffs (diff_id, change_kind);

create index if not exists idx_growth_audience_member_diffs_snapshot
  on growth.growth_audience_member_diffs (snapshot_id);

-- -----------------------------------------------------------------------------
-- growth.growth_audience_lead_creation_runs — inbox bridge observability
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_lead_creation_runs (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references growth.growth_audiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed', 'throttled')),
  requested_count bigint not null default 0 check (requested_count >= 0),
  created_count bigint not null default 0 check (created_count >= 0),
  skipped_count bigint not null default 0 check (skipped_count >= 0),
  failed_count bigint not null default 0 check (failed_count >= 0),
  run_cursor text,
  processed_count bigint not null default 0 check (processed_count >= 0),
  rows_read bigint not null default 0 check (rows_read >= 0),
  rows_written bigint not null default 0 check (rows_written >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  dry_run boolean not null default false,
  error text,
  initiated_by uuid,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2b-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_lead_creation_runs_audience
  on growth.growth_audience_lead_creation_runs (audience_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Kill switches
-- -----------------------------------------------------------------------------

insert into growth.runtime_guardrail_settings (key, enabled, value_json)
values
  ('audience_diff_enabled', true, '{}'::jsonb),
  ('audience_lead_creation_enabled', true, '{}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

alter table growth.growth_audience_snapshot_diffs enable row level security;
alter table growth.growth_audience_snapshot_diffs force row level security;
alter table growth.growth_audience_member_diffs enable row level security;
alter table growth.growth_audience_member_diffs force row level security;
alter table growth.growth_audience_lead_creation_runs enable row level security;
alter table growth.growth_audience_lead_creation_runs force row level security;

revoke all on growth.growth_audience_snapshot_diffs from public, anon, authenticated;
revoke all on growth.growth_audience_member_diffs from public, anon, authenticated;
revoke all on growth.growth_audience_lead_creation_runs from public, anon, authenticated;

grant all on growth.growth_audience_snapshot_diffs to service_role;
grant all on growth.growth_audience_member_diffs to service_role;
grant all on growth.growth_audience_lead_creation_runs to service_role;

-- Growth Engine GS-RG-2A — Dynamic Audience Snapshots Foundation.
-- Saved Search → Audience Snapshot → Manual Refresh → Manual Enrollment.
-- No continuous sync, no automatic refresh, no autonomous maintenance.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.prospect_search_saved_searches') is null then
    raise exception 'Missing dependency: growth.prospect_search_saved_searches';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.growth_audiences — saved audience definitions (manual_only refresh)
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  saved_search_id uuid not null references growth.prospect_search_saved_searches (id) on delete restrict,
  created_by uuid,
  last_snapshot_id uuid,
  last_refresh_at timestamptz,
  refresh_policy text not null default 'manual_only'
    check (refresh_policy in ('manual_only')),
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_audiences_org_updated
  on growth.growth_audiences (organization_id, updated_at desc);

create index if not exists idx_growth_audiences_saved_search
  on growth.growth_audiences (saved_search_id);

comment on table growth.growth_audiences is
  'GS-RG-2A saved audience definitions — manual refresh only.';

-- -----------------------------------------------------------------------------
-- growth.growth_audience_snapshots — immutable membership snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_snapshots (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references growth.growth_audiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_count bigint not null default 0 check (member_count >= 0),
  search_hash text not null,
  generated_at timestamptz not null default now(),
  generated_by uuid,
  generation_duration_ms integer check (generation_duration_ms is null or generation_duration_ms >= 0),
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_snapshots_audience
  on growth.growth_audience_snapshots (audience_id, generated_at desc);

create index if not exists idx_growth_audience_snapshots_org
  on growth.growth_audience_snapshots (organization_id, generated_at desc);

alter table growth.growth_audiences
  add constraint growth_audiences_last_snapshot_fk
  foreign key (last_snapshot_id) references growth.growth_audience_snapshots (id) on delete set null;

comment on table growth.growth_audience_snapshots is
  'GS-RG-2A immutable audience snapshots — frozen membership.';

-- -----------------------------------------------------------------------------
-- growth.growth_audience_members — frozen snapshot membership rows
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_members (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid,
  company_id text,
  fit_score numeric,
  intent_score numeric,
  engagement_score numeric,
  revenue_score numeric,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2a-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_members_snapshot
  on growth.growth_audience_members (snapshot_id);

create index if not exists idx_growth_audience_members_org
  on growth.growth_audience_members (organization_id);

create index if not exists idx_growth_audience_members_lead
  on growth.growth_audience_members (lead_id)
  where lead_id is not null;

comment on table growth.growth_audience_members is
  'GS-RG-2A frozen audience members per snapshot.';

-- -----------------------------------------------------------------------------
-- growth.growth_audience_refresh_runs — observability + resumable batch cursor
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references growth.growth_audiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_id uuid references growth.growth_audience_snapshots (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed', 'throttled')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  members_added bigint not null default 0 check (members_added >= 0),
  members_removed bigint not null default 0 check (members_removed >= 0),
  rows_read bigint not null default 0 check (rows_read >= 0),
  rows_written bigint not null default 0 check (rows_written >= 0),
  snapshot_cursor text,
  processed_count bigint not null default 0 check (processed_count >= 0),
  remaining_estimate bigint not null default 0 check (remaining_estimate >= 0),
  error text,
  initiated_by uuid,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_refresh_runs_audience
  on growth.growth_audience_refresh_runs (audience_id, created_at desc);

create index if not exists idx_growth_audience_refresh_runs_org_status
  on growth.growth_audience_refresh_runs (organization_id, status, created_at desc);

comment on table growth.growth_audience_refresh_runs is
  'GS-RG-2A audience refresh/snapshot run observability with resumable cursor.';

-- -----------------------------------------------------------------------------
-- Kill switch seed — audience_snapshot_enabled
-- -----------------------------------------------------------------------------

insert into growth.runtime_guardrail_settings (key, enabled, value_json)
values ('audience_snapshot_enabled', true, '{}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

alter table growth.growth_audiences enable row level security;
alter table growth.growth_audiences force row level security;
alter table growth.growth_audience_snapshots enable row level security;
alter table growth.growth_audience_snapshots force row level security;
alter table growth.growth_audience_members enable row level security;
alter table growth.growth_audience_members force row level security;
alter table growth.growth_audience_refresh_runs enable row level security;
alter table growth.growth_audience_refresh_runs force row level security;

revoke all on growth.growth_audiences from public, anon, authenticated;
revoke all on growth.growth_audience_snapshots from public, anon, authenticated;
revoke all on growth.growth_audience_members from public, anon, authenticated;
revoke all on growth.growth_audience_refresh_runs from public, anon, authenticated;

grant all on growth.growth_audiences to service_role;
grant all on growth.growth_audience_snapshots to service_role;
grant all on growth.growth_audience_members to service_role;
grant all on growth.growth_audience_refresh_runs to service_role;

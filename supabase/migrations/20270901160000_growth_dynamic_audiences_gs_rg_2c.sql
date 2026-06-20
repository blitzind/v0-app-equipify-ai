-- Growth Engine GS-RG-2C — Audience Enrollment Hardening & Operator Handoff.
-- Preview engine + resumable enrollment runs. Operator-initiated only.

do $$
begin
  if to_regclass('growth.growth_audiences') is null then
    raise exception 'Missing dependency: growth.growth_audiences (apply GS-RG-2A/2B first)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.growth_audience_enrollment_previews
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_enrollment_previews (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references growth.growth_audiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  sequence_pattern_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed', 'throttled', 'cancelled')),
  total_members bigint not null default 0 check (total_members >= 0),
  eligible_count bigint not null default 0 check (eligible_count >= 0),
  already_enrolled_count bigint not null default 0 check (already_enrolled_count >= 0),
  suppressed_count bigint not null default 0 check (suppressed_count >= 0),
  missing_contact_count bigint not null default 0 check (missing_contact_count >= 0),
  blocked_count bigint not null default 0 check (blocked_count >= 0),
  preview_cursor text,
  processed_count bigint not null default 0 check (processed_count >= 0),
  rows_read bigint not null default 0 check (rows_read >= 0),
  rows_written bigint not null default 0 check (rows_written >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  generated_at timestamptz,
  error text,
  initiated_by uuid,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2c-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_enrollment_previews_audience
  on growth.growth_audience_enrollment_previews (audience_id, created_at desc);

create index if not exists idx_growth_audience_enrollment_previews_snapshot
  on growth.growth_audience_enrollment_previews (snapshot_id);

-- -----------------------------------------------------------------------------
-- growth.growth_audience_enrollment_preview_members
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_enrollment_preview_members (
  id uuid primary key default gen_random_uuid(),
  preview_id uuid not null references growth.growth_audience_enrollment_previews (id) on delete cascade,
  audience_member_id uuid not null,
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid,
  category text not null
    check (category in ('eligible', 'already_enrolled', 'suppressed', 'missing_contact', 'blocked_by_limits')),
  reason text,
  display_label text,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2c-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_enrollment_preview_members_preview
  on growth.growth_audience_enrollment_preview_members (preview_id, category);

-- -----------------------------------------------------------------------------
-- growth.growth_audience_enrollment_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.growth_audience_enrollment_runs (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references growth.growth_audiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_id uuid not null references growth.growth_audience_snapshots (id) on delete cascade,
  preview_id uuid references growth.growth_audience_enrollment_previews (id) on delete set null,
  sequence_pattern_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed', 'throttled', 'cancelled')),
  requested_count bigint not null default 0 check (requested_count >= 0),
  enrolled_count bigint not null default 0 check (enrolled_count >= 0),
  skipped_count bigint not null default 0 check (skipped_count >= 0),
  failed_count bigint not null default 0 check (failed_count >= 0),
  run_cursor text,
  processed_count bigint not null default 0 check (processed_count >= 0),
  rows_read bigint not null default 0 check (rows_read >= 0),
  rows_written bigint not null default 0 check (rows_written >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  start_immediately boolean not null default false,
  dry_run boolean not null default false,
  cancelled_at timestamptz,
  error text,
  initiated_by uuid,
  qa_marker text not null default 'growth-dynamic-audiences-gs-rg-2c-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_audience_enrollment_runs_audience
  on growth.growth_audience_enrollment_runs (audience_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Kill switches
-- -----------------------------------------------------------------------------

insert into growth.runtime_guardrail_settings (key, enabled, value_json)
values
  ('audience_preview_enabled', true, '{}'::jsonb),
  ('audience_enrollment_enabled', true, '{}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

alter table growth.growth_audience_enrollment_previews enable row level security;
alter table growth.growth_audience_enrollment_previews force row level security;
alter table growth.growth_audience_enrollment_preview_members enable row level security;
alter table growth.growth_audience_enrollment_preview_members force row level security;
alter table growth.growth_audience_enrollment_runs enable row level security;
alter table growth.growth_audience_enrollment_runs force row level security;

revoke all on growth.growth_audience_enrollment_previews from public, anon, authenticated;
revoke all on growth.growth_audience_enrollment_preview_members from public, anon, authenticated;
revoke all on growth.growth_audience_enrollment_runs from public, anon, authenticated;

grant all on growth.growth_audience_enrollment_previews to service_role;
grant all on growth.growth_audience_enrollment_preview_members to service_role;
grant all on growth.growth_audience_enrollment_runs to service_role;

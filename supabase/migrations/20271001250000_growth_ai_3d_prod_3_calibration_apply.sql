-- GE-AI-3D-PROD-3 — Controlled adaptive calibration apply (versioned config only; no code/autonomy/core mutation).
-- Organization-scoped, audited, service-role only.

do $$
begin
  if to_regclass('growth.adaptive_calibration_proposals') is null then
    raise exception 'Missing dependency: growth.adaptive_calibration_proposals';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.calibration_config_versions — immutable applied configuration versions
-- -----------------------------------------------------------------------------

create table if not exists growth.calibration_config_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  proposal_id uuid references growth.adaptive_calibration_proposals (id) on delete set null,

  target_system text not null,
  version_number integer not null default 1,
  version_kind text not null default 'apply'
    check (version_kind in ('apply', 'rollback')),

  status text not null default 'applied'
    check (status in ('applied', 'rolled_back', 'superseded')),

  config_snapshot_before jsonb not null default '{}'::jsonb,
  config_snapshot_after jsonb not null default '{}'::jsonb,

  rollback_token text not null,
  previous_version_id uuid references growth.calibration_config_versions (id) on delete set null,

  applied_by_user_id uuid,
  applied_at timestamptz not null default now(),

  confidence numeric(5, 4) not null default 0,
  impact numeric(5, 4) not null default 0,

  idempotency_key text not null,
  event_correlation_id text,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3d-prod-3-calibration-apply-v1',

  created_at timestamptz not null default now()
);

create unique index if not exists calibration_config_versions_idempotency_uidx
  on growth.calibration_config_versions (organization_id, idempotency_key);

create index if not exists calibration_config_versions_org_target_idx
  on growth.calibration_config_versions (organization_id, target_system, created_at desc);

create unique index if not exists calibration_config_versions_rollback_token_uidx
  on growth.calibration_config_versions (organization_id, rollback_token);

comment on table growth.calibration_config_versions is
  'GE-AI-3D-PROD-3 immutable calibration configuration versions — every apply and rollback creates a new row.';

-- -----------------------------------------------------------------------------
-- growth.calibration_active_config — current effective configuration overlay
-- -----------------------------------------------------------------------------

create table if not exists growth.calibration_active_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  target_system text not null,

  config jsonb not null default '{}'::jsonb,
  active_version_id uuid references growth.calibration_config_versions (id) on delete set null,

  qa_marker text not null default 'growth-ge-ai-3d-prod-3-calibration-apply-v1',
  updated_at timestamptz not null default now(),

  unique (organization_id, target_system)
);

create index if not exists calibration_active_config_org_idx
  on growth.calibration_active_config (organization_id, updated_at desc);

comment on table growth.calibration_active_config is
  'GE-AI-3D-PROD-3 current effective calibration overlay per org and target system.';

-- -----------------------------------------------------------------------------
-- growth.calibration_config_events — append-only audit
-- -----------------------------------------------------------------------------

create table if not exists growth.calibration_config_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_id uuid references growth.calibration_config_versions (id) on delete set null,
  proposal_id uuid references growth.adaptive_calibration_proposals (id) on delete set null,

  event_type text not null,
  payload jsonb not null default '{}'::jsonb,

  qa_marker text not null default 'growth-ge-ai-3d-prod-3-calibration-apply-v1',
  created_at timestamptz not null default now()
);

create index if not exists calibration_config_events_org_type_idx
  on growth.calibration_config_events (organization_id, event_type, created_at desc);

comment on table growth.calibration_config_events is
  'GE-AI-3D-PROD-3 append-only calibration apply/rollback audit trail.';

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_calibration_active_config_updated_at on growth.calibration_active_config;
create trigger trg_growth_calibration_active_config_updated_at
  before update on growth.calibration_active_config
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

revoke all on table growth.calibration_config_versions from public, anon, authenticated;
revoke all on table growth.calibration_active_config from public, anon, authenticated;
revoke all on table growth.calibration_config_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.calibration_config_versions to service_role;
grant select, insert, update, delete on table growth.calibration_active_config to service_role;
grant select, insert on table growth.calibration_config_events to service_role;

alter table growth.calibration_config_versions enable row level security;
alter table growth.calibration_config_versions force row level security;

alter table growth.calibration_active_config enable row level security;
alter table growth.calibration_active_config force row level security;

alter table growth.calibration_config_events enable row level security;
alter table growth.calibration_config_events force row level security;

drop policy if exists growth_calibration_config_versions_service_role on growth.calibration_config_versions;
create policy growth_calibration_config_versions_service_role
  on growth.calibration_config_versions for all to service_role using (true) with check (true);

drop policy if exists growth_calibration_active_config_service_role on growth.calibration_active_config;
create policy growth_calibration_active_config_service_role
  on growth.calibration_active_config for all to service_role using (true) with check (true);

drop policy if exists growth_calibration_config_events_service_role on growth.calibration_config_events;
create policy growth_calibration_config_events_service_role
  on growth.calibration_config_events for all to service_role using (true) with check (true);

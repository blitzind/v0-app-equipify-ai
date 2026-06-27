-- GE-AI-3D-PROD-2 — Operator-gated adaptive calibration proposals (advisory until approved; no auto-apply).
-- Organization-scoped, audited, service-role only — NOT Core mutations.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.adaptive_calibration_proposals
-- -----------------------------------------------------------------------------

create table if not exists growth.adaptive_calibration_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  source_insight_id text not null,
  target_system text not null,
  proposal_type text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'expired', 'applied', 'superseded')),

  title text not null,
  summary text not null default '',

  proposed_change jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,

  confidence numeric(5, 4) not null default 0,
  impact numeric(5, 4) not null default 0,
  sample_size integer not null default 0,
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high')),

  requires_operator_approval boolean not null default true,
  approved_by_user_id uuid,
  approved_at timestamptz,
  rejected_by_user_id uuid,
  rejected_at timestamptz,
  rejection_reason text,

  idempotency_key text not null,
  expires_at timestamptz,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3d-prod-2-adaptive-calibration-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists adaptive_calibration_proposals_idempotency_uidx
  on growth.adaptive_calibration_proposals (organization_id, idempotency_key);

create index if not exists adaptive_calibration_proposals_org_status_idx
  on growth.adaptive_calibration_proposals (organization_id, status, created_at desc);

create index if not exists adaptive_calibration_proposals_org_insight_idx
  on growth.adaptive_calibration_proposals (organization_id, source_insight_id);

comment on table growth.adaptive_calibration_proposals is
  'GE-AI-3D-PROD-2 operator-gated calibration proposals — no automatic apply.';

-- -----------------------------------------------------------------------------
-- growth.adaptive_calibration_events
-- -----------------------------------------------------------------------------

create table if not exists growth.adaptive_calibration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  proposal_id uuid references growth.adaptive_calibration_proposals (id) on delete set null,

  event_type text not null,
  payload jsonb not null default '{}'::jsonb,

  qa_marker text not null default 'growth-ge-ai-3d-prod-2-adaptive-calibration-v1',
  created_at timestamptz not null default now()
);

create index if not exists adaptive_calibration_events_org_type_idx
  on growth.adaptive_calibration_events (organization_id, event_type, created_at desc);

create index if not exists adaptive_calibration_events_proposal_idx
  on growth.adaptive_calibration_events (proposal_id, created_at desc);

comment on table growth.adaptive_calibration_events is
  'GE-AI-3D-PROD-2 append-only adaptive calibration audit trail.';

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_adaptive_calibration_proposals_updated_at on growth.adaptive_calibration_proposals;
create trigger trg_growth_adaptive_calibration_proposals_updated_at
  before update on growth.adaptive_calibration_proposals
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

revoke all on table growth.adaptive_calibration_proposals from public, anon, authenticated;
revoke all on table growth.adaptive_calibration_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.adaptive_calibration_proposals to service_role;
grant select, insert on table growth.adaptive_calibration_events to service_role;

alter table growth.adaptive_calibration_proposals enable row level security;
alter table growth.adaptive_calibration_proposals force row level security;

alter table growth.adaptive_calibration_events enable row level security;
alter table growth.adaptive_calibration_events force row level security;

drop policy if exists growth_adaptive_calibration_proposals_service_role on growth.adaptive_calibration_proposals;
create policy growth_adaptive_calibration_proposals_service_role
  on growth.adaptive_calibration_proposals for all to service_role using (true) with check (true);

drop policy if exists growth_adaptive_calibration_events_service_role on growth.adaptive_calibration_events;
create policy growth_adaptive_calibration_events_service_role
  on growth.adaptive_calibration_events for all to service_role using (true) with check (true);

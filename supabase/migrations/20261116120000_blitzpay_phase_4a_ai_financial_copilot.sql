-- BlitzPay Phase 4A — AI Financial Copilot (advisory artifacts only; deterministic-first; no autonomous money movement).
-- RLS: org-scoped finance roles (owner/admin/manager); staff-only; no customer portal grants.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Advisory financial insights (not authoritative accounting state)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ai_financial_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  insight_type text not null
    check (insight_type in (
      'anomaly', 'treasury_risk', 'margin_risk', 'collections', 'payroll', 'procurement',
      'membership', 'financing', 'vendor_risk', 'executive_summary'
    )),
  insight_status text not null default 'active'
    check (insight_status in ('active', 'dismissed', 'archived', 'resolved')),
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text not null,
  deterministic_score integer
    check (deterministic_score is null or (deterministic_score >= 0 and deterministic_score <= 100)),
  supporting_metrics jsonb not null default '{}'::jsonb,
  recommendation_summary text,
  generated_by text not null default 'deterministic_engine'
    check (generated_by in ('deterministic_engine', 'ai_assisted', 'hybrid')),
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_ai_financial_insights is
  'Advisory BlitzPay financial copilot insights; deterministic scores + optional narrative; never authoritative GL state.';

create index if not exists idx_blitzpay_ai_fin_insights_org_status
  on public.blitzpay_ai_financial_insights (organization_id, insight_status, generated_at desc);

create index if not exists idx_blitzpay_ai_fin_insights_org_type
  on public.blitzpay_ai_financial_insights (organization_id, insight_type, generated_at desc);

-- ---------------------------------------------------------------------------
-- Recommendation queue (human acknowledgment only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ai_recommendation_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  insight_id uuid not null references public.blitzpay_ai_financial_insights (id) on delete cascade,
  action_status text not null default 'pending'
    check (action_status in ('pending', 'acknowledged', 'dismissed', 'accepted', 'completed')),
  action_type text not null
    check (action_type in (
      'review', 'follow_up', 'pricing_review', 'collections_review', 'treasury_review',
      'payroll_review', 'procurement_review', 'vendor_review', 'membership_review'
    )),
  assigned_user_id uuid,
  action_summary text not null,
  deterministic_basis jsonb not null default '{}'::jsonb,
  ai_reasoning_summary text,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_ai_recommendation_actions is
  'Human-in-the-loop recommendation queue for BlitzPay copilot; no autonomous execution.';

create index if not exists idx_blitzpay_ai_rec_actions_org_status
  on public.blitzpay_ai_recommendation_actions (organization_id, action_status, created_at desc);

create index if not exists idx_blitzpay_ai_rec_actions_insight
  on public.blitzpay_ai_recommendation_actions (insight_id);

-- ---------------------------------------------------------------------------
-- Forecast snapshots (bounded projections; planning only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ai_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_type text not null
    check (snapshot_type in (
      'treasury', 'collections', 'payroll', 'procurement', 'revenue', 'memberships', 'financing'
    )),
  forecast_window_days integer not null default 30 check (forecast_window_days > 0 and forecast_window_days <= 730),
  forecast_confidence_score integer
    check (forecast_confidence_score is null or (forecast_confidence_score >= 0 and forecast_confidence_score <= 100)),
  projected_inflow_cents bigint,
  projected_outflow_cents bigint,
  projected_net_cents bigint,
  projected_risk_score integer
    check (projected_risk_score is null or (projected_risk_score >= 0 and projected_risk_score <= 100)),
  deterministic_inputs jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.blitzpay_ai_forecast_snapshots is
  'Deterministic forecast snapshots for BlitzPay copilot; advisory planning rows.';

create index if not exists idx_blitzpay_ai_forecast_org_created
  on public.blitzpay_ai_forecast_snapshots (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Immutable AI audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  audit_type text not null
    check (audit_type in (
      'insight_generated', 'recommendation_created', 'recommendation_dismissed', 'recommendation_accepted',
      'forecast_generated', 'executive_summary_generated', 'manual_override'
    )),
  related_entity_type text,
  related_entity_id uuid,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'user')),
  actor_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.blitzpay_ai_audit_log is
  'Append-only audit trail for BlitzPay AI copilot advisory actions; no updates or deletes.';

create or replace function public.blitzpay_ai_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_ai_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_ai_audit_block_update on public.blitzpay_ai_audit_log;
create trigger trg_blitzpay_ai_audit_block_update
before update on public.blitzpay_ai_audit_log
for each row execute function public.blitzpay_ai_audit_block_mutation();

drop trigger if exists trg_blitzpay_ai_audit_block_delete on public.blitzpay_ai_audit_log;
create trigger trg_blitzpay_ai_audit_block_delete
before delete on public.blitzpay_ai_audit_log
for each row execute function public.blitzpay_ai_audit_block_mutation();

create index if not exists idx_blitzpay_ai_audit_org_created
  on public.blitzpay_ai_audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers (mutable tables only)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_ai_fin_insights_updated on public.blitzpay_ai_financial_insights;
create trigger trg_blitzpay_ai_fin_insights_updated
before update on public.blitzpay_ai_financial_insights
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_ai_rec_actions_updated on public.blitzpay_ai_recommendation_actions;
create trigger trg_blitzpay_ai_rec_actions_updated
before update on public.blitzpay_ai_recommendation_actions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — owner / admin / manager; no portal exposure
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_ai_financial_insights from public, anon;
revoke all on table public.blitzpay_ai_recommendation_actions from public, anon;
revoke all on table public.blitzpay_ai_forecast_snapshots from public, anon;
revoke all on table public.blitzpay_ai_audit_log from public, anon;

grant select on table public.blitzpay_ai_financial_insights to authenticated;
grant select on table public.blitzpay_ai_recommendation_actions to authenticated;
grant select on table public.blitzpay_ai_forecast_snapshots to authenticated;
grant select on table public.blitzpay_ai_audit_log to authenticated;

alter table public.blitzpay_ai_financial_insights enable row level security;
alter table public.blitzpay_ai_financial_insights force row level security;
alter table public.blitzpay_ai_recommendation_actions enable row level security;
alter table public.blitzpay_ai_recommendation_actions force row level security;
alter table public.blitzpay_ai_forecast_snapshots enable row level security;
alter table public.blitzpay_ai_forecast_snapshots force row level security;
alter table public.blitzpay_ai_audit_log enable row level security;
alter table public.blitzpay_ai_audit_log force row level security;

drop policy if exists "blitzpay_ai_fin_insights_select_finance_roles" on public.blitzpay_ai_financial_insights;
create policy "blitzpay_ai_fin_insights_select_finance_roles"
on public.blitzpay_ai_financial_insights
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ai_rec_actions_select_finance_roles" on public.blitzpay_ai_recommendation_actions;
create policy "blitzpay_ai_rec_actions_select_finance_roles"
on public.blitzpay_ai_recommendation_actions
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ai_forecast_snapshots_select_finance_roles" on public.blitzpay_ai_forecast_snapshots;
create policy "blitzpay_ai_forecast_snapshots_select_finance_roles"
on public.blitzpay_ai_forecast_snapshots
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ai_audit_select_finance_roles" on public.blitzpay_ai_audit_log;
create policy "blitzpay_ai_audit_select_finance_roles"
on public.blitzpay_ai_audit_log
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

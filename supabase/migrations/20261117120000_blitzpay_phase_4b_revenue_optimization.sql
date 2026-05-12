-- BlitzPay Phase 4B — Revenue optimization foundations (deterministic recommendations only; no autonomous outreach or price changes).
-- RLS: org-scoped finance roles (owner/admin/manager); staff-only; no customer portal.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.customers') is null then
    raise exception 'Missing dependency: public.customers';
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
-- Revenue optimization opportunities (advisory queue)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_revenue_optimization_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_type text not null
    check (opportunity_type in (
      'reminder_timing', 'membership_pricing', 'recovery_sequence', 'churn_prevention', 'ach_nudge',
      'technician_coaching', 'renewal_timing', 'payment_behavior', 'financing_offer', 'custom'
    )),
  opportunity_status text not null default 'active'
    check (opportunity_status in ('active', 'dismissed', 'accepted', 'completed', 'archived')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text not null,
  deterministic_score integer
    check (deterministic_score is null or (deterministic_score >= 0 and deterministic_score <= 100)),
  estimated_revenue_impact_cents bigint
    check (estimated_revenue_impact_cents is null or estimated_revenue_impact_cents >= 0),
  confidence_score integer
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  supporting_metrics jsonb not null default '{}'::jsonb,
  recommended_action text,
  source_type text,
  source_id uuid,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_revenue_optimization_opportunities is
  'Advisory revenue optimization opportunities; deterministic scores; no automatic pricing or messaging.';

create index if not exists idx_blitzpay_rev_opt_opp_org_status
  on public.blitzpay_revenue_optimization_opportunities (organization_id, opportunity_status, created_at desc);

create index if not exists idx_blitzpay_rev_opt_opp_org_type
  on public.blitzpay_revenue_optimization_opportunities (organization_id, opportunity_type);

-- ---------------------------------------------------------------------------
-- Human action queue
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_revenue_optimization_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null references public.blitzpay_revenue_optimization_opportunities (id) on delete cascade,
  action_status text not null default 'pending'
    check (action_status in ('pending', 'acknowledged', 'accepted', 'completed', 'dismissed')),
  action_type text not null
    check (action_type in (
      'review_reminder_timing', 'review_membership_price', 'review_recovery_sequence', 'review_churn_risk',
      'review_ach_nudge', 'review_technician_coaching', 'review_renewal_timing', 'review_financing_offer', 'manual_review'
    )),
  assigned_user_id uuid,
  action_summary text not null,
  deterministic_basis jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_revenue_optimization_actions is
  'Human-in-the-loop actions for revenue optimization; no autonomous execution.';

create index if not exists idx_blitzpay_rev_opt_act_org_status
  on public.blitzpay_revenue_optimization_actions (organization_id, action_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Experiment tracking (operational metadata only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_revenue_optimization_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  experiment_name text not null,
  experiment_type text not null
    check (experiment_type in (
      'reminder_timing', 'membership_pricing', 'recovery_sequence', 'ach_nudge', 'renewal_timing', 'customer_segment', 'custom'
    )),
  experiment_status text not null default 'draft'
    check (experiment_status in ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date date,
  end_date date,
  control_strategy text,
  treatment_strategy text,
  success_metric text,
  baseline_value bigint,
  observed_value bigint,
  estimated_lift_basis_points integer
    check (estimated_lift_basis_points is null or (estimated_lift_basis_points >= -10000 and estimated_lift_basis_points <= 10000)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_revenue_optimization_experiments is
  'Operational experiment tracking for revenue optimization; no automatic rollout.';

create index if not exists idx_blitzpay_rev_opt_exp_org_status
  on public.blitzpay_revenue_optimization_experiments (organization_id, experiment_status);

-- ---------------------------------------------------------------------------
-- Per-customer payment behavior scores (bounded generation)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_customer_payment_behavior_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  score_date date not null,
  payment_reliability_score integer
    check (payment_reliability_score is null or (payment_reliability_score >= 0 and payment_reliability_score <= 100)),
  late_payment_risk_score integer
    check (late_payment_risk_score is null or (late_payment_risk_score >= 0 and late_payment_risk_score <= 100)),
  autopay_fit_score integer
    check (autopay_fit_score is null or (autopay_fit_score >= 0 and autopay_fit_score <= 100)),
  ach_nudge_fit_score integer
    check (ach_nudge_fit_score is null or (ach_nudge_fit_score >= 0 and ach_nudge_fit_score <= 100)),
  renewal_risk_score integer
    check (renewal_risk_score is null or (renewal_risk_score >= 0 and renewal_risk_score <= 100)),
  financing_fit_score integer
    check (financing_fit_score is null or (financing_fit_score >= 0 and financing_fit_score <= 100)),
  supporting_metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_cust_pay_behavior_org_cust_date unique (organization_id, customer_id, score_date)
);

comment on table public.blitzpay_customer_payment_behavior_scores is
  'Deterministic payment-behavior scores per customer per day; advisory only.';

create index if not exists idx_blitzpay_cust_pay_behavior_org_date
  on public.blitzpay_customer_payment_behavior_scores (organization_id, score_date desc);

-- ---------------------------------------------------------------------------
-- Immutable optimization audit log
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_revenue_optimization_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  audit_type text not null
    check (audit_type in (
      'opportunity_generated', 'action_created', 'action_acknowledged', 'action_completed', 'opportunity_dismissed',
      'experiment_created', 'experiment_updated', 'behavior_score_generated', 'manual_override'
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

create or replace function public.blitzpay_rev_opt_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_revenue_optimization_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_rev_opt_audit_block_update on public.blitzpay_revenue_optimization_audit_log;
create trigger trg_blitzpay_rev_opt_audit_block_update
before update on public.blitzpay_revenue_optimization_audit_log
for each row execute function public.blitzpay_rev_opt_audit_block_mutation();

drop trigger if exists trg_blitzpay_rev_opt_audit_block_delete on public.blitzpay_revenue_optimization_audit_log;
create trigger trg_blitzpay_rev_opt_audit_block_delete
before delete on public.blitzpay_revenue_optimization_audit_log
for each row execute function public.blitzpay_rev_opt_audit_block_mutation();

create index if not exists idx_blitzpay_rev_opt_audit_org_created
  on public.blitzpay_revenue_optimization_audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_rev_opt_opp_updated on public.blitzpay_revenue_optimization_opportunities;
create trigger trg_blitzpay_rev_opt_opp_updated
before update on public.blitzpay_revenue_optimization_opportunities
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_rev_opt_act_updated on public.blitzpay_revenue_optimization_actions;
create trigger trg_blitzpay_rev_opt_act_updated
before update on public.blitzpay_revenue_optimization_actions
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_rev_opt_exp_updated on public.blitzpay_revenue_optimization_experiments;
create trigger trg_blitzpay_rev_opt_exp_updated
before update on public.blitzpay_revenue_optimization_experiments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_revenue_optimization_opportunities from public, anon;
revoke all on table public.blitzpay_revenue_optimization_actions from public, anon;
revoke all on table public.blitzpay_revenue_optimization_experiments from public, anon;
revoke all on table public.blitzpay_customer_payment_behavior_scores from public, anon;
revoke all on table public.blitzpay_revenue_optimization_audit_log from public, anon;

grant select on table public.blitzpay_revenue_optimization_opportunities to authenticated;
grant select on table public.blitzpay_revenue_optimization_actions to authenticated;
grant select on table public.blitzpay_revenue_optimization_experiments to authenticated;
grant select on table public.blitzpay_customer_payment_behavior_scores to authenticated;
grant select on table public.blitzpay_revenue_optimization_audit_log to authenticated;

alter table public.blitzpay_revenue_optimization_opportunities enable row level security;
alter table public.blitzpay_revenue_optimization_opportunities force row level security;
alter table public.blitzpay_revenue_optimization_actions enable row level security;
alter table public.blitzpay_revenue_optimization_actions force row level security;
alter table public.blitzpay_revenue_optimization_experiments enable row level security;
alter table public.blitzpay_revenue_optimization_experiments force row level security;
alter table public.blitzpay_customer_payment_behavior_scores enable row level security;
alter table public.blitzpay_customer_payment_behavior_scores force row level security;
alter table public.blitzpay_revenue_optimization_audit_log enable row level security;
alter table public.blitzpay_revenue_optimization_audit_log force row level security;

drop policy if exists "blitzpay_rev_opt_opp_select_finance_roles" on public.blitzpay_revenue_optimization_opportunities;
create policy "blitzpay_rev_opt_opp_select_finance_roles"
on public.blitzpay_revenue_optimization_opportunities
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_rev_opt_act_select_finance_roles" on public.blitzpay_revenue_optimization_actions;
create policy "blitzpay_rev_opt_act_select_finance_roles"
on public.blitzpay_revenue_optimization_actions
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_rev_opt_exp_select_finance_roles" on public.blitzpay_revenue_optimization_experiments;
create policy "blitzpay_rev_opt_exp_select_finance_roles"
on public.blitzpay_revenue_optimization_experiments
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_cust_pay_behavior_select_finance_roles" on public.blitzpay_customer_payment_behavior_scores;
create policy "blitzpay_cust_pay_behavior_select_finance_roles"
on public.blitzpay_customer_payment_behavior_scores
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_rev_opt_audit_select_finance_roles" on public.blitzpay_revenue_optimization_audit_log;
create policy "blitzpay_rev_opt_audit_select_finance_roles"
on public.blitzpay_revenue_optimization_audit_log
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

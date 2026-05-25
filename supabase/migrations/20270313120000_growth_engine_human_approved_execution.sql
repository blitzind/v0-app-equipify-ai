-- Growth Engine slice 6.32A: human-approved multi-channel execution engine.
-- Operator-controlled approval workflow — no autonomous sends, calls, or CRM movement.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

create table if not exists growth.human_execution_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  template_key text not null default 'standard_outreach'
    check (template_key in ('standard_outreach', 'high_touch', 're_engagement', 'meeting_push')),
  readiness_score int not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  readiness_band text not null default 'low'
    check (readiness_band in ('critical', 'high', 'normal', 'low')),
  stop_reason text,
  pause_reason text,
  rules jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users (id) on delete set null,
  approved_by_user_id uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_human_execution_plans_lead
  on growth.human_execution_plans (lead_id, updated_at desc);

create index if not exists idx_growth_human_execution_plans_org_status
  on growth.human_execution_plans (organization_id, status);

create table if not exists growth.human_execution_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references growth.human_execution_plans (id) on delete cascade,
  step_order int not null check (step_order >= 0),
  day_offset int not null default 0 check (day_offset >= 0),
  channel text not null
    check (channel in ('email', 'sms', 'manual_call', 'voicemail', 'linkedin_message', 'manual_task')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'review', 'approved', 'executed', 'complete', 'skipped', 'paused')),
  title text not null,
  instructions text not null default '',
  suggested_timing timestamptz,
  scheduled_for timestamptz,
  executed_at timestamptz,
  completed_at timestamptz,
  outreach_queue_id uuid references growth.outreach_queue (id) on delete set null,
  cadence_task_id uuid references growth.cadence_tasks (id) on delete set null,
  cooldown_hours int not null default 48 check (cooldown_hours >= 0),
  fatigue_protected boolean not null default false,
  reply_routing text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, step_order)
);

create index if not exists idx_growth_human_execution_plan_steps_plan
  on growth.human_execution_plan_steps (plan_id, step_order);

create index if not exists idx_growth_human_execution_plan_steps_approval
  on growth.human_execution_plan_steps (approval_status, scheduled_for);

create table if not exists growth.human_execution_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  plan_id uuid references growth.human_execution_plans (id) on delete set null,
  plan_step_id uuid references growth.human_execution_plan_steps (id) on delete set null,
  channel text not null
    check (channel in ('email', 'sms', 'manual_call', 'voicemail', 'linkedin_message', 'manual_task')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'review', 'approved', 'executed', 'complete', 'cancelled')),
  readiness_score int not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  readiness_band text not null default 'low'
    check (readiness_band in ('critical', 'high', 'normal', 'low')),
  title text not null,
  why text not null default '',
  suggested_channel text,
  suggested_timing timestamptz,
  owner_user_id uuid references auth.users (id) on delete set null,
  reviewed_by_user_id uuid references auth.users (id) on delete set null,
  approved_by_user_id uuid references auth.users (id) on delete set null,
  executed_by_user_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,
  completed_at timestamptz,
  outreach_queue_id uuid references growth.outreach_queue (id) on delete set null,
  cadence_task_id uuid references growth.cadence_tasks (id) on delete set null,
  reply_routing text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_human_execution_approvals_status
  on growth.human_execution_approvals (organization_id, approval_status, created_at desc);

create index if not exists idx_growth_human_execution_approvals_lead
  on growth.human_execution_approvals (lead_id, approval_status);

alter table growth.human_execution_plans enable row level security;
alter table growth.human_execution_plan_steps enable row level security;
alter table growth.human_execution_approvals enable row level security;

create policy growth_human_execution_plans_service_role
  on growth.human_execution_plans for all to service_role using (true) with check (true);

create policy growth_human_execution_plan_steps_service_role
  on growth.human_execution_plan_steps for all to service_role using (true) with check (true);

create policy growth_human_execution_approvals_service_role
  on growth.human_execution_approvals for all to service_role using (true) with check (true);

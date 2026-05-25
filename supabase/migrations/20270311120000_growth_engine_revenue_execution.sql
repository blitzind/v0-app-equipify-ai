-- Growth Engine slice 6.31A: revenue execution sprints.
-- Operator-controlled sprint sessions — no autonomous CRM movement.

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

create table if not exists growth.execution_sprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  started_by_user_id uuid references auth.users (id) on delete set null,
  sprint_type text not null
    check (sprint_type in (
      'revenue_rescue',
      'deal_closing',
      'follow_up_recovery',
      'research_buildout',
      'meeting_completion',
      'renewal_protection',
      'sequence_cleanup'
    )),
  duration_minutes int not null check (duration_minutes in (30, 60, 90)),
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  expected_revenue_impact numeric not null default 0,
  task_ids jsonb not null default '[]'::jsonb,
  task_count int not null default 0 check (task_count >= 0),
  estimated_effort_minutes int not null default 0 check (estimated_effort_minutes >= 0),
  operator_load_score int not null default 0 check (operator_load_score >= 0 and operator_load_score <= 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_execution_sprints_organization_id
  on growth.execution_sprints (organization_id, started_at desc);

create index if not exists idx_growth_execution_sprints_active
  on growth.execution_sprints (organization_id, status)
  where status = 'active';

alter table growth.execution_sprints enable row level security;

create policy growth_execution_sprints_service_role
  on growth.execution_sprints
  for all
  to service_role
  using (true)
  with check (true);

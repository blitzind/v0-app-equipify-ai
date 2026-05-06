-- Operational AI alerts for platform observability and response workflows.

create table if not exists public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  alert_type text not null check (
    alert_type in (
      'monthly_budget_near_limit',
      'monthly_budget_exceeded',
      'plan_limit_blocked',
      'repeated_task_failures',
      'provider_failure_spike',
      'cache_error_spike',
      'job_stuck_processing',
      'high_cost_single_request'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  metadata jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_alerts is
  'AI operational alerts. Service role inserts/updates. Members may read org-scoped alerts.';

create index if not exists idx_ai_alerts_created on public.ai_alerts (created_at desc);
create index if not exists idx_ai_alerts_status on public.ai_alerts (status, created_at desc);
create index if not exists idx_ai_alerts_org_status on public.ai_alerts (organization_id, status, created_at desc);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_ai_alerts_set_updated_at on public.ai_alerts;
    create trigger trg_ai_alerts_set_updated_at
      before update on public.ai_alerts
      for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.ai_alerts enable row level security;
alter table public.ai_alerts force row level security;

revoke all on public.ai_alerts from public, anon;
grant select on public.ai_alerts to authenticated;

drop policy if exists "ai_alerts_select_org_member" on public.ai_alerts;
create policy "ai_alerts_select_org_member"
on public.ai_alerts
for select
to authenticated
using (organization_id is not null and public.is_org_member (organization_id));

-- Platform admins use service-role-backed API routes for global visibility/actions.
-- Service role bypasses RLS for insert/update lifecycle operations.


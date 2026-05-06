-- Operational workflow automation: triggers, runs, logs (organization-scoped).

create table if not exists public.workflow_automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  enabled boolean not null default true,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  condition_config jsonb not null default '{}'::jsonb,
  action_config jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_automations_trigger_type_check check (
    trigger_type in (
      'work_order_created',
      'work_order_completed',
      'work_order_status_changed',
      'maintenance_due',
      'invoice_overdue',
      'quote_accepted',
      'equipment_warranty_expiring',
      'certificate_uploaded'
    )
  )
);

comment on table public.workflow_automations is
  'Org-defined automation rules: trigger + JSON conditions + JSON actions.';

create index if not exists idx_workflow_automations_org_enabled_trigger
  on public.workflow_automations (organization_id, enabled, trigger_type);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid not null references public.workflow_automations (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  source_type text not null default 'unknown',
  source_id text,
  error_message text
);

comment on table public.workflow_runs is
  'One execution of an automation for a given source entity (work order, invoice, etc.).';

create index if not exists idx_workflow_runs_org_started
  on public.workflow_runs (organization_id, started_at desc);

create index if not exists idx_workflow_runs_automation_started
  on public.workflow_runs (automation_id, started_at desc);

create table if not exists public.workflow_run_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs (id) on delete cascade,
  step text not null default '',
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.workflow_run_logs is
  'Append-only steps for debugging automation execution.';

create index if not exists idx_workflow_run_logs_run_created
  on public.workflow_run_logs (workflow_run_id, created_at asc);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_workflow_automations_set_updated_at on public.workflow_automations;
    create trigger trg_workflow_automations_set_updated_at
      before update on public.workflow_automations
      for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.workflow_automations enable row level security;
alter table public.workflow_automations force row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_runs force row level security;
alter table public.workflow_run_logs enable row level security;
alter table public.workflow_run_logs force row level security;

revoke all on table public.workflow_automations from public, anon;
revoke all on table public.workflow_runs from public, anon;
revoke all on table public.workflow_run_logs from public, anon;

grant select, insert, update, delete on table public.workflow_automations to authenticated;
grant select, insert on table public.workflow_runs to authenticated;
grant select, insert on table public.workflow_run_logs to authenticated;

-- workflow_automations: managers configure
drop policy if exists "workflow_automations_select_member" on public.workflow_automations;
create policy "workflow_automations_select_member"
on public.workflow_automations
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "workflow_automations_insert_roles" on public.workflow_automations;
create policy "workflow_automations_insert_roles"
on public.workflow_automations
for insert
to authenticated
with check (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager'])
  and created_by = auth.uid ()
);

drop policy if exists "workflow_automations_update_roles" on public.workflow_automations;
create policy "workflow_automations_update_roles"
on public.workflow_automations
for update
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "workflow_automations_delete_roles" on public.workflow_automations;
create policy "workflow_automations_delete_roles"
on public.workflow_automations
for delete
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- workflow_runs: members read; inserts from app automation engine (member session or elevated client)
drop policy if exists "workflow_runs_select_member" on public.workflow_runs;
create policy "workflow_runs_select_member"
on public.workflow_runs
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "workflow_runs_insert_member" on public.workflow_runs;
create policy "workflow_runs_insert_member"
on public.workflow_runs
for insert
to authenticated
with check (public.is_org_member (organization_id));

-- workflow_run_logs
drop policy if exists "workflow_run_logs_select_member" on public.workflow_run_logs;
create policy "workflow_run_logs_select_member"
on public.workflow_run_logs
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "workflow_run_logs_insert_member" on public.workflow_run_logs;
create policy "workflow_run_logs_insert_member"
on public.workflow_run_logs
for insert
to authenticated
with check (public.is_org_member (organization_id));

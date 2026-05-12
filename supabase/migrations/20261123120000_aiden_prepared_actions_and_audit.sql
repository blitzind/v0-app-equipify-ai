-- AIden prepared workspace actions: persistence + append-only audit trail.
-- Writes are intended for service-role / Route Handlers only; org members may SELECT.

do $migration$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
end
$migration$;

create table if not exists public.aiden_prepared_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  action_id text not null,
  status text not null default 'prepared',
  risk_level text not null,
  input_payload jsonb not null default '{}'::jsonb,
  resolved_payload jsonb not null default '{}'::jsonb,
  preview_payload jsonb not null default '{}'::jsonb,
  execution_payload jsonb not null default '{}'::jsonb,
  source_record_type text null,
  source_record_id uuid null,
  target_record_type text null,
  target_record_id uuid null,
  confidence_score numeric null,
  requires_confirmation boolean not null default true,
  confirmed_by uuid null references auth.users (id) on delete set null,
  confirmed_at timestamptz null,
  executed_by uuid null references auth.users (id) on delete set null,
  executed_at timestamptz null,
  canceled_by uuid null references auth.users (id) on delete set null,
  canceled_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aiden_prepared_actions_status_check check (
    status in (
      'prepared',
      'needs_clarification',
      'ready_for_confirmation',
      'confirmed',
      'executing',
      'completed',
      'canceled',
      'failed'
    )
  ),
  constraint aiden_prepared_actions_risk_level_check check (
    risk_level in (
      'read_only',
      'draft_content',
      'operational_write',
      'financial_draft',
      'financial_write',
      'bulk_financial_write'
    )
  )
);

create index if not exists idx_aiden_prepared_actions_org_created
  on public.aiden_prepared_actions (organization_id, created_at desc);

create index if not exists idx_aiden_prepared_actions_org_status_created
  on public.aiden_prepared_actions (organization_id, status, created_at desc);

create index if not exists idx_aiden_prepared_actions_org_action
  on public.aiden_prepared_actions (organization_id, action_id, created_at desc);

comment on table public.aiden_prepared_actions is
  'AIden prepared workspace actions (intent payloads). Mutations via service-role APIs only; members read within org.';

alter table public.aiden_prepared_actions enable row level security;

drop policy if exists "aiden_prepared_actions_select_org_member" on public.aiden_prepared_actions;
create policy "aiden_prepared_actions_select_org_member"
on public.aiden_prepared_actions
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.aiden_prepared_actions from public, anon;
grant select on table public.aiden_prepared_actions to authenticated;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_aiden_prepared_actions_set_updated_at on public.aiden_prepared_actions;
    create trigger trg_aiden_prepared_actions_set_updated_at
    before update on public.aiden_prepared_actions
    for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.aiden_action_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  prepared_action_id uuid null references public.aiden_prepared_actions (id) on delete set null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  action_id text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_aiden_action_audit_log_org_created
  on public.aiden_action_audit_log (organization_id, created_at desc);

create index if not exists idx_aiden_action_audit_log_prepared_action
  on public.aiden_action_audit_log (prepared_action_id, created_at desc);

comment on table public.aiden_action_audit_log is
  'Append-only audit events for AIden prepared actions. Inserts via service-role only; members read within org.';

alter table public.aiden_action_audit_log enable row level security;

drop policy if exists "aiden_action_audit_log_select_org_member" on public.aiden_action_audit_log;
create policy "aiden_action_audit_log_select_org_member"
on public.aiden_action_audit_log
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.aiden_action_audit_log from public, anon;
grant select on table public.aiden_action_audit_log to authenticated;

-- Server jobs / Route Handlers using the service role key (bypasses RLS; still needs table privileges).
grant select, insert, update, delete on table public.aiden_prepared_actions to service_role;
grant select, insert on table public.aiden_action_audit_log to service_role;

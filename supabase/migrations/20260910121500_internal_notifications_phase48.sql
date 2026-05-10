-- Phase 48 — Internal notification / escalation rules (in-app only; org-scoped RLS).

create table if not exists public.internal_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  event_type text not null check (
    event_type in (
      'service_request_new',
      'service_request_sla_at_risk',
      'service_request_sla_overdue',
      'work_order_overdue',
      'work_order_unassigned',
      'maintenance_due_soon',
      'maintenance_overdue',
      'quote_approved',
      'quote_declined',
      'invoice_overdue',
      'repeat_failure_risk',
      'warranty_expiring_soon'
    )
  ),
  enabled boolean not null default true,
  channel text not null default 'in_app' check (channel in ('in_app')),
  target_roles text[] null,
  target_user_ids uuid[] null,
  threshold_minutes integer null check (threshold_minutes is null or threshold_minutes >= 0),
  warning_minutes integer null check (warning_minutes is null or warning_minutes >= 0),
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.internal_escalation_rules is
  'Org-defined internal escalation rules (Phase 48). In-app channel only; evaluated server-side.';

create index if not exists idx_internal_escalation_rules_org_enabled
  on public.internal_escalation_rules (organization_id, enabled, event_type);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_internal_escalation_rules_updated_at on public.internal_escalation_rules;
    create trigger trg_internal_escalation_rules_updated_at
      before update on public.internal_escalation_rules
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.internal_escalation_rules enable row level security;
alter table public.internal_escalation_rules force row level security;

revoke all on table public.internal_escalation_rules from public, anon;
grant select, insert, update, delete on table public.internal_escalation_rules to authenticated;

drop policy if exists "internal_escalation_rules_select_member" on public.internal_escalation_rules;
create policy "internal_escalation_rules_select_member"
on public.internal_escalation_rules for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "internal_escalation_rules_write_manager" on public.internal_escalation_rules;
create policy "internal_escalation_rules_write_manager"
on public.internal_escalation_rules for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- Rolling log of evaluated notifications (deduped per org + key; last_seen refreshed on re-eval).

create table if not exists public.internal_notification_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid references public.internal_escalation_rules (id) on delete set null,
  event_type text not null,
  dedupe_key text not null check (char_length(trim(dedupe_key)) > 0),
  title text not null,
  body text,
  entity_type text null,
  entity_id uuid null,
  customer_id uuid null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);

comment on table public.internal_notification_log is
  'Deduped internal notification visibility log; populated by server evaluation. Application filters rows for assigned-tech and financial visibility.';

create index if not exists idx_internal_notification_log_org_last_seen
  on public.internal_notification_log (organization_id, last_seen_at desc);

alter table public.internal_notification_log enable row level security;
alter table public.internal_notification_log force row level security;

revoke all on table public.internal_notification_log from public, anon;
grant select, insert, update, delete on table public.internal_notification_log to authenticated;

drop policy if exists "internal_notification_log_select_member" on public.internal_notification_log;
create policy "internal_notification_log_select_member"
on public.internal_notification_log for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "internal_notification_log_write_manager" on public.internal_notification_log;
create policy "internal_notification_log_write_manager"
on public.internal_notification_log for insert to authenticated
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "internal_notification_log_update_manager" on public.internal_notification_log;
create policy "internal_notification_log_update_manager"
on public.internal_notification_log for update to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

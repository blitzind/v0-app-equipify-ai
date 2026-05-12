-- Workspace SMS foundation: settings, consent, delivery audit, suppressions (no live send in app until gated).

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

-- Single row per org: master toggles + compliance + provider selection (no secrets).
create table if not exists public.organization_sms_workspace_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  sms_master_enabled boolean not null default false,
  opt_in_required boolean not null default true,
  provider_kind text not null default 'none' check (provider_kind in ('none', 'twilio', 'telnyx')),
  provider_configured boolean not null default false,
  compliance_status text not null default 'not_started' check (
    compliance_status in ('not_started', 'pending_review', 'approved', 'rejected')
  ),
  transactional_only boolean not null default true,
  sender_display_hint text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_sms_workspace_settings is
  'Workspace-level SMS policy. Per-alert SMS toggles live in organization_notification_preferences; sending pipelines must check this row + consent + suppression + quiet hours.';

create index if not exists idx_org_sms_workspace_settings_org on public.organization_sms_workspace_settings (organization_id);

alter table public.organization_sms_workspace_settings enable row level security;

revoke all on table public.organization_sms_workspace_settings from public, anon;
grant select on table public.organization_sms_workspace_settings to authenticated;
grant select, insert, update, delete on table public.organization_sms_workspace_settings to service_role;

drop policy if exists "org_sms_workspace_settings_select_member" on public.organization_sms_workspace_settings;
create policy "org_sms_workspace_settings_select_member"
on public.organization_sms_workspace_settings
for select
to authenticated
using (public.is_org_member (organization_id));

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_sms_workspace_settings_updated_at on public.organization_sms_workspace_settings;
    create trigger trg_org_sms_workspace_settings_updated_at
      before update on public.organization_sms_workspace_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Transactional opt-in per recipient phone (E.164). Revoke via revoked_at.
create table if not exists public.organization_sms_recipient_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_kind text not null default 'unknown' check (recipient_kind in ('user', 'customer_contact', 'unknown')),
  subject_user_id uuid null,
  e164 text not null,
  consent_scope text not null default 'transactional' check (consent_scope in ('transactional')),
  consented_at timestamptz not null default now(),
  revoked_at timestamptz null,
  source text null
);

comment on table public.organization_sms_recipient_consents is
  'Transactional SMS opt-in per org + E.164. Marketing SMS must not use this table in v1.';

create index if not exists idx_org_sms_consents_org on public.organization_sms_recipient_consents (organization_id);
create index if not exists idx_org_sms_consents_e164 on public.organization_sms_recipient_consents (organization_id, e164);

alter table public.organization_sms_recipient_consents enable row level security;

revoke all on table public.organization_sms_recipient_consents from public, anon;
grant select on table public.organization_sms_recipient_consents to authenticated;
grant select, insert, update, delete on table public.organization_sms_recipient_consents to service_role;

drop policy if exists "org_sms_consents_select_member" on public.organization_sms_recipient_consents;
create policy "org_sms_consents_select_member"
on public.organization_sms_recipient_consents
for select
to authenticated
using (public.is_org_member (organization_id));

-- At most one active consent row per org+phone+scope (partial unique).
create unique index if not exists uq_org_sms_consents_active
  on public.organization_sms_recipient_consents (organization_id, e164, consent_scope)
  where revoked_at is null;

-- Delivery / skip audit (no message body; internal diagnostics only).
create table if not exists public.organization_sms_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  alert_type text not null check (
    alert_type in (
      'overdue_work_orders',
      'repeat_repair_alerts',
      'warranty_expiring',
      'maintenance_due',
      'work_order_completed',
      'schedule_changes'
    )
  ),
  recipient_e164 text not null,
  status text not null check (status in ('queued', 'skipped', 'failed', 'noop_simulated', 'sent')),
  skip_code text null,
  provider_external_ref text null,
  body_fingerprint text null,
  error_message_internal text null,
  created_at timestamptz not null default now()
);

comment on table public.organization_sms_delivery_attempts is
  'Audit trail for SMS send attempts. UI must never surface error_message_internal or provider secrets.';

create index if not exists idx_org_sms_delivery_org_created on public.organization_sms_delivery_attempts (organization_id, created_at desc);

alter table public.organization_sms_delivery_attempts enable row level security;

revoke all on table public.organization_sms_delivery_attempts from public, anon;
grant select on table public.organization_sms_delivery_attempts to authenticated;
grant select, insert, update, delete on table public.organization_sms_delivery_attempts to service_role;

drop policy if exists "org_sms_delivery_select_member" on public.organization_sms_delivery_attempts;
create policy "org_sms_delivery_select_member"
on public.organization_sms_delivery_attempts
for select
to authenticated
using (public.is_org_member (organization_id));

-- STOP / admin / provider suppressions.
create table if not exists public.organization_sms_suppressions (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  e164 text not null,
  reason text not null check (reason in ('stop', 'help', 'admin', 'bounce', 'complaint')),
  created_at timestamptz not null default now(),
  primary key (organization_id, e164)
);

comment on table public.organization_sms_suppressions is
  'Numbers opted out or blocked from transactional SMS for the workspace.';

alter table public.organization_sms_suppressions enable row level security;

revoke all on table public.organization_sms_suppressions from public, anon;
grant select on table public.organization_sms_suppressions to authenticated;
grant select, insert, update, delete on table public.organization_sms_suppressions to service_role;

drop policy if exists "org_sms_suppressions_select_member" on public.organization_sms_suppressions;
create policy "org_sms_suppressions_select_member"
on public.organization_sms_suppressions
for select
to authenticated
using (public.is_org_member (organization_id));

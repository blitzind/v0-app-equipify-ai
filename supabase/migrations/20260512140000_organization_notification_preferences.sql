-- Workspace-scoped notification channel preferences + optional digest / quiet hours (preference storage only).

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

create table if not exists public.organization_notification_preferences (
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
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, alert_type)
);

comment on table public.organization_notification_preferences is
  'Per-alert channel toggles for workspace notifications (in-app / email / SMS). Sending pipelines read these rows in a later phase.';

create index if not exists idx_org_notification_prefs_org
  on public.organization_notification_preferences (organization_id);

alter table public.organization_notification_preferences enable row level security;

revoke all on table public.organization_notification_preferences from public, anon;
grant select on table public.organization_notification_preferences to authenticated;
grant select, insert, update, delete on table public.organization_notification_preferences to service_role;

drop policy if exists "org_notification_prefs_select_member" on public.organization_notification_preferences;
create policy "org_notification_prefs_select_member"
on public.organization_notification_preferences
for select
to authenticated
using (public.is_org_member (organization_id));

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_notification_prefs_set_updated_at on public.organization_notification_preferences;
    create trigger trg_org_notification_prefs_set_updated_at
      before update on public.organization_notification_preferences
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Digest + quiet hours (single row per org; delivery not wired in this phase).

create table if not exists public.organization_notification_digest_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  digest_enabled boolean not null default false,
  digest_frequency text not null default 'daily' check (digest_frequency in ('daily', 'weekly')),
  digest_time_local text not null default '08:00' check (digest_time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start_local text null check (
    quiet_hours_start_local is null or quiet_hours_start_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  quiet_hours_end_local text null check (
    quiet_hours_end_local is null or quiet_hours_end_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_notification_digest_settings is
  'Workspace email digest + quiet-hour window preferences (local HH:MM). Digest send pipeline optional / later.';

alter table public.organization_notification_digest_settings enable row level security;

revoke all on table public.organization_notification_digest_settings from public, anon;
grant select on table public.organization_notification_digest_settings to authenticated;
grant select, insert, update, delete on table public.organization_notification_digest_settings to service_role;

drop policy if exists "org_notification_digest_select_member" on public.organization_notification_digest_settings;
create policy "org_notification_digest_select_member"
on public.organization_notification_digest_settings
for select
to authenticated
using (public.is_org_member (organization_id));

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_notification_digest_set_updated_at on public.organization_notification_digest_settings;
    create trigger trg_org_notification_digest_set_updated_at
      before update on public.organization_notification_digest_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

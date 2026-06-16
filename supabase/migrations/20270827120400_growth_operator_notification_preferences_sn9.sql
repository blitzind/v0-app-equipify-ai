-- SN-9 — Growth operator notification preferences (routing/delivery eligibility).

do $$
begin
  if to_regclass('growth.operator_notifications') is null then
    raise exception 'Missing dependency: growth.operator_notifications';
  end if;
end;
$$;

create table if not exists growth.operator_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  in_app_enabled boolean not null default true,
  browser_push_enabled boolean not null default true,
  minimum_severity text not null default 'low'
    check (minimum_severity in ('low', 'medium', 'high', 'critical')),
  disabled_event_types text[] not null default '{}'::text[],
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_notification_preferences_user_unique unique (user_id)
);

create index if not exists idx_growth_operator_notification_preferences_org_user
  on growth.operator_notification_preferences (organization_id, user_id);

comment on table growth.operator_notification_preferences is
  'Per-user operator notification delivery preferences for in-app persistence and browser push. Service-role only.';

drop trigger if exists trg_growth_operator_notification_preferences_set_updated_at
  on growth.operator_notification_preferences;
create trigger trg_growth_operator_notification_preferences_set_updated_at
before update on growth.operator_notification_preferences
for each row execute function public.set_updated_at();

revoke all on table growth.operator_notification_preferences from public, anon, authenticated;
grant select, insert, update, delete on table growth.operator_notification_preferences to service_role;

alter table growth.operator_notification_preferences enable row level security;
alter table growth.operator_notification_preferences force row level security;

create policy growth_operator_notification_preferences_service_role
  on growth.operator_notification_preferences for all to service_role using (true) with check (true);

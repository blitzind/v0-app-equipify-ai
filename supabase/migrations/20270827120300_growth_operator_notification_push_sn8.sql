-- SN-8 — Growth operator browser push subscriptions + delivery audit.
-- Separate from public.user_push_devices (Expo technician mobile push).

do $$
begin
  if to_regclass('growth.operator_notifications') is null then
    raise exception 'Missing dependency: growth.operator_notifications';
  end if;
end;
$$;

create table if not exists growth.operator_notification_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  subscription_json jsonb not null default '{}'::jsonb,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_notification_push_subscriptions_endpoint_nonempty
    check (char_length(trim(endpoint)) > 0)
);

create unique index if not exists uq_growth_operator_notification_push_subscriptions_user_endpoint
  on growth.operator_notification_push_subscriptions (user_id, endpoint);

create index if not exists idx_growth_operator_notification_push_subscriptions_user_enabled
  on growth.operator_notification_push_subscriptions (user_id, enabled, last_seen_at desc);

comment on table growth.operator_notification_push_subscriptions is
  'Browser Web Push subscriptions for Growth operator notifications (platform admins). Distinct from public.user_push_devices Expo technician push.';

create table if not exists growth.operator_notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references growth.operator_notifications (id) on delete cascade,
  subscription_id uuid not null references growth.operator_notification_push_subscriptions (id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  attempted_at timestamptz not null default now(),
  constraint uq_growth_operator_notification_push_deliveries_notification_subscription
    unique (notification_id, subscription_id)
);

create index if not exists idx_growth_operator_notification_push_deliveries_notification
  on growth.operator_notification_push_deliveries (notification_id, attempted_at desc);

comment on table growth.operator_notification_push_deliveries is
  'Browser push delivery audit for Growth operator notifications. Does not mutate acknowledgement state.';

drop trigger if exists trg_growth_operator_notification_push_subscriptions_set_updated_at
  on growth.operator_notification_push_subscriptions;
create trigger trg_growth_operator_notification_push_subscriptions_set_updated_at
before update on growth.operator_notification_push_subscriptions
for each row execute function public.set_updated_at();

revoke all on table growth.operator_notification_push_subscriptions from public, anon, authenticated;
revoke all on table growth.operator_notification_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table growth.operator_notification_push_subscriptions to service_role;
grant select, insert, update, delete on table growth.operator_notification_push_deliveries to service_role;

alter table growth.operator_notification_push_subscriptions enable row level security;
alter table growth.operator_notification_push_subscriptions force row level security;
alter table growth.operator_notification_push_deliveries enable row level security;
alter table growth.operator_notification_push_deliveries force row level security;

create policy growth_operator_notification_push_subscriptions_service_role
  on growth.operator_notification_push_subscriptions for all to service_role using (true) with check (true);

create policy growth_operator_notification_push_deliveries_service_role
  on growth.operator_notification_push_deliveries for all to service_role using (true) with check (true);

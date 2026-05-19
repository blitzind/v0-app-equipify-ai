-- Technician mobile push: device registry + Expo provider on communication_events audit log.

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

-- Allow Expo as a push provider in the existing communications audit table.
alter table public.communication_events
  drop constraint if exists communication_events_provider_check;

alter table public.communication_events
  add constraint communication_events_provider_check
  check (
    provider in (
      'manual',
      'resend',
      'twilio',
      'supabase',
      'web_push',
      'apns',
      'fcm',
      'expo'
    )
  );

comment on column public.communication_events.provider is
  'Delivery provider. Technician mobile push uses provider=expo with channel=push.';

-- One row per user + workspace + Expo token (token may move between devices).
create table if not exists public.user_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown' check (platform in ('ios', 'android', 'unknown')),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_push_devices_expo_token_nonempty check (char_length(trim(expo_push_token)) > 0)
);

comment on table public.user_push_devices is
  'Expo push tokens for technician mobile apps. Never expose tokens in client UI; RLS limits rows to owning user.';

create unique index if not exists uq_user_push_devices_user_org_token
  on public.user_push_devices (user_id, organization_id, expo_push_token);

create index if not exists idx_user_push_devices_org_user
  on public.user_push_devices (organization_id, user_id);

create index if not exists idx_user_push_devices_token
  on public.user_push_devices (expo_push_token);

alter table public.user_push_devices enable row level security;

revoke all on table public.user_push_devices from public, anon;
grant select, insert, update, delete on table public.user_push_devices to authenticated;
grant select, insert, update, delete on table public.user_push_devices to service_role;

drop policy if exists "user_push_devices_select_own" on public.user_push_devices;
create policy "user_push_devices_select_own"
on public.user_push_devices
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member (organization_id)
);

drop policy if exists "user_push_devices_insert_own" on public.user_push_devices;
create policy "user_push_devices_insert_own"
on public.user_push_devices
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member (organization_id)
);

drop policy if exists "user_push_devices_update_own" on public.user_push_devices;
create policy "user_push_devices_update_own"
on public.user_push_devices
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member (organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member (organization_id)
);

drop policy if exists "user_push_devices_delete_own" on public.user_push_devices;
create policy "user_push_devices_delete_own"
on public.user_push_devices
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member (organization_id)
);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_user_push_devices_updated_at on public.user_push_devices;
    create trigger trg_user_push_devices_updated_at
      before update on public.user_push_devices
      for each row execute function public.set_updated_at();
  end if;
end $$;

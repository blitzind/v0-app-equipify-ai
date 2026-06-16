-- Growth Engine SN-2 — Sendr operator notification persistence (distinct from 6.18A attention notifications).

create table if not exists growth.operator_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  event_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  recipient_role text not null check (
    recipient_role in ('lead_owner', 'inbox_owner', 'campaign_owner', 'platform_admin')
  ),
  recipient_user_id uuid references auth.users (id) on delete set null,
  dedupe_key text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  target_entity_type text,
  target_entity_id text,
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  qa_marker text not null default 'growth-operator-notifications-sn2-v1'
);

create index if not exists idx_growth_operator_notifications_organization_id
  on growth.operator_notifications (organization_id, created_at desc);

create index if not exists idx_growth_operator_notifications_recipient_user_id
  on growth.operator_notifications (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

create index if not exists idx_growth_operator_notifications_event_type
  on growth.operator_notifications (event_type, created_at desc);

create index if not exists idx_growth_operator_notifications_severity
  on growth.operator_notifications (severity, created_at desc);

create index if not exists idx_growth_operator_notifications_acknowledged_at
  on growth.operator_notifications (acknowledged_at, created_at desc);

create index if not exists idx_growth_operator_notifications_created_at
  on growth.operator_notifications (created_at desc);

create index if not exists idx_growth_operator_notifications_dedupe_key
  on growth.operator_notifications (dedupe_key, recipient_role, recipient_user_id, created_at desc);

create index if not exists idx_growth_operator_notifications_unread
  on growth.operator_notifications (recipient_user_id, severity, created_at desc)
  where dismissed_at is null and acknowledged_at is null;

drop trigger if exists trg_growth_operator_notifications_set_updated_at on growth.operator_notifications;
create trigger trg_growth_operator_notifications_set_updated_at
before update on growth.operator_notifications
for each row execute function public.set_updated_at();

comment on table growth.operator_notifications is
  'Sendr-style operator notifications (SN-2). Distinct from growth.notifications (6.18A attention layer).';

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.operator_notifications from public, anon, authenticated;
grant select, insert, update, delete on table growth.operator_notifications to service_role;

alter table growth.operator_notifications enable row level security;
alter table growth.operator_notifications force row level security;

create policy growth_operator_notifications_service_role
  on growth.operator_notifications for all to service_role using (true) with check (true);

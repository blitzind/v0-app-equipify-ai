-- Org-wide communications log + per-user read state for the notification center.
-- Supports email/SMS/in-app/push (reserved), reminders, customer timeline, and future provider webhooks.

create table if not exists public.communication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel text not null,
  direction text not null default 'outbound',
  event_type text not null,
  title text not null,
  summary text,
  body text,
  audience text not null default 'organization',
  counts_toward_unread boolean not null default true,
  delivery_status text not null default 'pending',
  recipient_kind text not null default 'external',
  recipient_user_id uuid,
  recipient_customer_id uuid references public.customers (id) on delete set null,
  recipient_address text,
  related_entity_type text,
  related_entity_id uuid,
  provider text not null default 'internal',
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  scheduled_reminder_key text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint communication_events_channel_check
    check (channel in ('email', 'sms', 'in_app', 'push', 'system')),
  constraint communication_events_direction_check
    check (direction in ('outbound', 'inbound')),
  constraint communication_events_audience_check
    check (audience in ('organization', 'customer_timeline', 'both')),
  constraint communication_events_recipient_kind_check
    check (recipient_kind in ('user', 'customer', 'external', 'none')),
  constraint communication_events_delivery_status_check
    check (
      delivery_status in (
        'pending',
        'queued',
        'sent',
        'delivered',
        'failed',
        'bounced',
        'skipped'
      )
    ),
  constraint communication_events_provider_check
    check (
      provider in (
        'manual',
        'resend',
        'twilio',
        'supabase',
        'web_push',
        'apns',
        'fcm'
      )
    ),
  constraint communication_events_related_entity_type_check
    check (
      related_entity_type is null
      or related_entity_type in (
        'work_order',
        'quote',
        'invoice',
        'maintenance_plan',
        'customer',
        'equipment',
        'organization'
      )
    )
);

comment on table public.communication_events is
  'Outbound/inbound communications and reminder notifications; polymorphic related_entity_* for deep links.';

comment on column public.communication_events.scheduled_reminder_key is
  'Idempotent key for generated reminders (e.g. wo_reminder:<uuid>:2026-05-06).';

comment on column public.communication_events.counts_toward_unread is
  'When true, appears in notification badge until marked read (org feed only).';

create unique index if not exists idx_communication_events_org_reminder_key_unique
  on public.communication_events (organization_id, scheduled_reminder_key)
  where scheduled_reminder_key is not null;

create index if not exists idx_communication_events_org_created
  on public.communication_events (organization_id, created_at desc);

create index if not exists idx_communication_events_org_customer
  on public.communication_events (organization_id, recipient_customer_id, created_at desc);

create index if not exists idx_communication_events_org_entity
  on public.communication_events (organization_id, related_entity_type, related_entity_id);

create table if not exists public.communication_event_reads (
  communication_event_id uuid not null references public.communication_events (id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (communication_event_id, user_id)
);

create index if not exists idx_communication_event_reads_user
  on public.communication_event_reads (user_id, read_at desc);

revoke all on table public.communication_events from public, anon;
revoke all on table public.communication_event_reads from public, anon;

grant select, insert, update on table public.communication_events to authenticated;
grant select, insert, delete on table public.communication_event_reads to authenticated;

alter table public.communication_events enable row level security;
alter table public.communication_event_reads enable row level security;

drop policy if exists "communication_events_select_member" on public.communication_events;
create policy "communication_events_select_member"
on public.communication_events
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "communication_events_insert_member" on public.communication_events;
create policy "communication_events_insert_member"
on public.communication_events
for insert
to authenticated
with check (public.is_org_member (organization_id));

drop policy if exists "communication_events_update_member" on public.communication_events;
create policy "communication_events_update_member"
on public.communication_events
for update
to authenticated
using (public.is_org_member (organization_id))
with check (public.is_org_member (organization_id));

drop policy if exists "communication_event_reads_select_own" on public.communication_event_reads;
create policy "communication_event_reads_select_own"
on public.communication_event_reads
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "communication_event_reads_insert_own" on public.communication_event_reads;
create policy "communication_event_reads_insert_own"
on public.communication_event_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.communication_events e
    where e.id = communication_event_id
      and public.is_org_member (e.organization_id)
  )
);

drop policy if exists "communication_event_reads_delete_own" on public.communication_event_reads;
create policy "communication_event_reads_delete_own"
on public.communication_event_reads
for delete
to authenticated
using (user_id = auth.uid());

-- Fast unread badge count (respects RLS on communication_events)
create or replace function public.communication_unread_count_for_user(p_organization_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.communication_events e
  where e.organization_id = p_organization_id
    and e.counts_toward_unread = true
    and e.audience in ('organization', 'both')
    and not exists (
      select 1
      from public.communication_event_reads r
      where r.communication_event_id = e.id
        and r.user_id = auth.uid()
    );
$$;

grant execute on function public.communication_unread_count_for_user(uuid) to authenticated;

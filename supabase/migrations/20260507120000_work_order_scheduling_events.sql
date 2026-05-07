-- Dispatch + Scheduling Phase 2: lightweight scheduling-events log foundation.
--
-- Additive only. Used by the new operator-facing scheduling notes API
-- (`/api/work-orders/scheduling-events`) and any future audit-trail surfaces.
-- Does NOT change work_orders, dispatch, maintenance plan, or quick-add flows.
-- The dispatch board / service schedule continue to read directly from
-- `work_orders` exactly as before. This table only stores opt-in human/system
-- annotations on scheduling actions (drag/drop reschedule, conflict notes,
-- bulk reassignment, etc.).
--
-- Compatible with future audit trails: shape mirrors
-- `organization_import_run_operator_events` (Phase 4 imports) so a unified
-- audit reader can later combine sources.

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid,text[])';
  end if;
end;
$$;

create table if not exists public.work_order_scheduling_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  actor_kind text not null default 'operator'
    check (actor_kind in ('operator', 'system', 'system_cron')),
  event_type text not null
    check (event_type in (
      'note',
      'reschedule',
      'reassign',
      'unassign',
      'quick_add',
      'conflict_acknowledged',
      'system_observation'
    )),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  message text not null check (char_length(trim(message)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.work_order_scheduling_events is
  'Operator + system notes/actions for work-order scheduling decisions (Phase 2 dispatch & schedule). Additive — not used by drag/drop persistence today.';
comment on column public.work_order_scheduling_events.actor_kind is
  'Distinguishes org operators from automated system events (e.g. cron sync).';
comment on column public.work_order_scheduling_events.metadata is
  'Structured payload (previous slot, new slot, conflict ids, etc.). Never embed secrets or raw tokens.';

create index if not exists idx_wo_scheduling_events_wo_created
  on public.work_order_scheduling_events (work_order_id, created_at desc);
create index if not exists idx_wo_scheduling_events_org_created
  on public.work_order_scheduling_events (organization_id, created_at desc);
create index if not exists idx_wo_scheduling_events_event_type
  on public.work_order_scheduling_events (event_type, created_at desc);

revoke all on table public.work_order_scheduling_events from public, anon;
grant select, insert on table public.work_order_scheduling_events to authenticated;

alter table public.work_order_scheduling_events enable row level security;
alter table public.work_order_scheduling_events force row level security;

drop policy if exists "wo_scheduling_events_select_member" on public.work_order_scheduling_events;
create policy "wo_scheduling_events_select_member"
on public.work_order_scheduling_events for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "wo_scheduling_events_insert_dispatcher" on public.work_order_scheduling_events;
create policy "wo_scheduling_events_insert_dispatcher"
on public.work_order_scheduling_events for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'tech'])
);

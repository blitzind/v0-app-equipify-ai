-- Phase 6: pending safe actions + usage keys (prepare / confirm).

alter table public.aiden_usage_events drop constraint if exists aiden_usage_events_feature_key_check;

alter table public.aiden_usage_events add constraint aiden_usage_events_feature_key_check check (
  feature_key in (
    'support_chat',
    'feature_request',
    'customer_summary',
    'work_order_summary',
    'draft_generation',
    'operational_recommendations',
    'action_prepare',
    'action_confirm'
  )
);

create table if not exists public.aiden_pending_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  proposed_by_user_id uuid not null references auth.users (id) on delete cascade,
  confirmed_by_user_id uuid references auth.users (id) on delete set null,
  action_type text not null,
  title text not null,
  explanation text not null,
  affected_record_ids jsonb not null default '[]'::jsonb,
  proposed_payload jsonb not null default '{}'::jsonb,
  risk_level text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  result_payload jsonb,
  error_message text,
  constraint aiden_pending_actions_risk_check check (risk_level in ('low', 'medium', 'high')),
  constraint aiden_pending_actions_status_check check (
    status in ('pending', 'confirmed', 'canceled', 'expired', 'failed')
  )
);

create index if not exists idx_aiden_pending_actions_org_status_expires
  on public.aiden_pending_actions (organization_id, status, expires_at desc);

create index if not exists idx_aiden_pending_actions_proposer
  on public.aiden_pending_actions (organization_id, proposed_by_user_id, created_at desc);

comment on table public.aiden_pending_actions is
  'Phase 6 — AIden prepared actions awaiting explicit user confirmation (TTL enforced in API).';

alter table public.aiden_pending_actions enable row level security;

revoke all on table public.aiden_pending_actions from public, anon;
grant select, insert, update on table public.aiden_pending_actions to authenticated;

drop policy if exists "aiden_pending_actions_select_org_member" on public.aiden_pending_actions;
create policy "aiden_pending_actions_select_org_member"
on public.aiden_pending_actions
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "aiden_pending_actions_insert_self" on public.aiden_pending_actions;
create policy "aiden_pending_actions_insert_self"
on public.aiden_pending_actions
for insert
to authenticated
with check (
  public.is_org_member (organization_id)
  and proposed_by_user_id = auth.uid()
);

drop policy if exists "aiden_pending_actions_update_own_pending" on public.aiden_pending_actions;
create policy "aiden_pending_actions_update_own_pending"
on public.aiden_pending_actions
for update
to authenticated
using (
  public.is_org_member (organization_id)
  and proposed_by_user_id = auth.uid()
  and status = 'pending'
)
with check (
  public.is_org_member (organization_id)
  and proposed_by_user_id = auth.uid()
);

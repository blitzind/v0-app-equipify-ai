-- AI Operational Assistant Phase 5 — lifecycle + append-only operational events.
--
-- Adds explicit lifecycle rows per surfaced recommendation key (operator
-- workflow state) and an append-only event log for audits / timelines.
-- Does not replace `ai_ops_dismissals` — snooze/dismiss filters remain
-- orthogonal.

-- -----------------------------------------------------------------------------
-- Lifecycle (mutable — one row per org + recommendation_key)
-- -----------------------------------------------------------------------------

create table if not exists public.ai_ops_recommendation_lifecycle (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_key text not null check (char_length(trim(recommendation_key)) > 0),
  category text not null,
  state text not null default 'pending'
    check (state in ('pending', 'acknowledged', 'in_progress', 'completed', 'ignored', 'escalated')),
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_ops_recommendation_lifecycle_org_key_unique
    unique (organization_id, recommendation_key)
);

create index if not exists idx_ai_ops_lifecycle_org_state
  on public.ai_ops_recommendation_lifecycle (organization_id, state);

comment on table public.ai_ops_recommendation_lifecycle is
  'AI Ops Phase 5 — operator workflow state for a deterministic recommendation key (does not mutate source records).';

-- -----------------------------------------------------------------------------
-- Events (append-only audit / timeline)
-- -----------------------------------------------------------------------------

create table if not exists public.ai_ops_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_key text not null check (char_length(trim(recommendation_key)) > 0),
  category text not null,
  event_type text not null check (char_length(trim(event_type)) > 0),
  actor_user_id uuid references auth.users(id) on delete set null,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_ops_events_org_key_created
  on public.ai_ops_recommendation_events (organization_id, recommendation_key, created_at desc);

comment on table public.ai_ops_recommendation_events is
  'AI Ops Phase 5 — append-only recommendation timeline (no webhook secrets or signed URLs).';

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------

revoke all on table public.ai_ops_recommendation_lifecycle from public, anon;
grant select, insert, update, delete on table public.ai_ops_recommendation_lifecycle to authenticated;

alter table public.ai_ops_recommendation_lifecycle enable row level security;

drop policy if exists "ai_ops_lifecycle_select_member" on public.ai_ops_recommendation_lifecycle;
create policy "ai_ops_lifecycle_select_member"
on public.ai_ops_recommendation_lifecycle
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "ai_ops_lifecycle_write_manager" on public.ai_ops_recommendation_lifecycle;
create policy "ai_ops_lifecycle_write_manager"
on public.ai_ops_recommendation_lifecycle
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_recommendation_lifecycle.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_recommendation_lifecycle.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
);

revoke all on table public.ai_ops_recommendation_events from public, anon;
grant select, insert on table public.ai_ops_recommendation_events to authenticated;

alter table public.ai_ops_recommendation_events enable row level security;

drop policy if exists "ai_ops_events_select_member" on public.ai_ops_recommendation_events;
create policy "ai_ops_events_select_member"
on public.ai_ops_recommendation_events
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "ai_ops_events_insert_manager" on public.ai_ops_recommendation_events;
create policy "ai_ops_events_insert_manager"
on public.ai_ops_recommendation_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_recommendation_events.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
);

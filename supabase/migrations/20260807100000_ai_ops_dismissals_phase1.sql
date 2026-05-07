-- AI Operational Assistant Phase 1 — dismiss / snooze persistence.
--
-- Strictly additive + idempotent. Every recommendation surfaced by
-- `lib/ai-ops/*` is keyed by a stable `recommendation_key` (e.g.
-- `stale_prospect:<prospect_id>`) so we can dedupe across requests
-- without rewriting source records.
--
-- The table is intentionally small: dismissals are a UI hint, not a
-- workflow. Re-running the rule engine is the source of truth — this
-- table only filters/snoozes the resulting list.

create table if not exists public.ai_ops_dismissals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_key text not null check (char_length(trim(recommendation_key)) > 0),
  -- Categorization mirrors `lib/ai-ops/types.ts::RecommendationCategory`.
  -- Stored as text (no enum) to stay schema-drift-safe as new
  -- categories ship.
  category text not null,
  -- When set, the dismissal expires automatically; the rule engine
  -- starts surfacing the recommendation again after this timestamp.
  -- `null` = dismissed indefinitely until the source record clears.
  snoozed_until timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint ai_ops_dismissals_org_key_unique
    unique (organization_id, recommendation_key)
);

-- Postgres rejects `now()` (mutable) inside partial index predicates,
-- so we use two complementary indexes instead:
--   1. (organization_id, snoozed_until) supports time-bounded
--      "still-snoozed" filters: `where snoozed_until > now()`.
--   2. A partial index over indefinite dismissals (the common
--      hot-path lookup, since most dismissals are "snooze=null").
create index if not exists idx_ai_ops_dismissals_org_snoozed_until
  on public.ai_ops_dismissals (organization_id, snoozed_until);

create index if not exists idx_ai_ops_dismissals_org_dismissed
  on public.ai_ops_dismissals (organization_id)
  where snoozed_until is null;

create index if not exists idx_ai_ops_dismissals_org_category
  on public.ai_ops_dismissals (organization_id, category);

comment on table public.ai_ops_dismissals is
  'AI Operational Assistant Phase 1 — manager dismissals/snoozes for surfaced recommendations. Filtered against the rule engine output.';
comment on column public.ai_ops_dismissals.recommendation_key is
  'Stable key emitted by the rule engine, e.g. "overdue_invoice:<invoice_id>".';
comment on column public.ai_ops_dismissals.snoozed_until is
  'When set, the dismissal auto-expires; null = dismissed indefinitely.';

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------

revoke all on table public.ai_ops_dismissals from public, anon;
grant select, insert, update, delete on table public.ai_ops_dismissals to authenticated;

alter table public.ai_ops_dismissals enable row level security;

drop policy if exists "ai_ops_dismissals_select_member" on public.ai_ops_dismissals;
create policy "ai_ops_dismissals_select_member"
on public.ai_ops_dismissals
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "ai_ops_dismissals_write_owner_admin_manager" on public.ai_ops_dismissals;
create policy "ai_ops_dismissals_write_owner_admin_manager"
on public.ai_ops_dismissals
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_dismissals.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_dismissals.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
);

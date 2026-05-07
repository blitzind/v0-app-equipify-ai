-- AI Operational Assistant Phase 2 — outcomes + narration cache.
--
-- Strictly additive + idempotent. Two small tables:
--   1. ai_ops_outcomes — one row per acted-on/dismissed/snoozed/
--      opened/drafted event. Lets future digests measure whether
--      surfaced recommendations actually closed the loop.
--   2. ai_ops_narrations — cached AI-generated explanations keyed
--      by (organization_id, recommendation_key). Avoids re-running
--      the LLM on every dashboard tick. TTL is enforced in
--      application code (default 24h).
--
-- Both tables are write-cheap and never modified after insert (the
-- narrations table is upsert-on-conflict because the same
-- recommendation key can be re-narrated when source data changes).

-- -----------------------------------------------------------------------------
-- ai_ops_outcomes
-- -----------------------------------------------------------------------------

create table if not exists public.ai_ops_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_key text not null check (char_length(trim(recommendation_key)) > 0),
  category text not null,
  rule_id text not null,
  outcome text not null
    check (outcome in (
      'opened_entity',
      'drafted_followup',
      'created_automation_suggestion',
      'narrated',
      'dismissed',
      'snoozed',
      'acted_on'
    )),
  /** Free-form context — entity ID, snoozed_until ISO, etc. Never PII. */
  context jsonb not null default '{}'::jsonb,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_ops_outcomes_org_recorded_at
  on public.ai_ops_outcomes (organization_id, created_at desc);

create index if not exists idx_ai_ops_outcomes_org_key
  on public.ai_ops_outcomes (organization_id, recommendation_key);

create index if not exists idx_ai_ops_outcomes_org_outcome
  on public.ai_ops_outcomes (organization_id, outcome);

comment on table public.ai_ops_outcomes is
  'AI Ops Phase 2 — telemetry of manager actions taken on surfaced recommendations. Used by future digests/Slack alerts; never modifies source records.';

revoke all on table public.ai_ops_outcomes from public, anon;
grant select, insert on table public.ai_ops_outcomes to authenticated;

alter table public.ai_ops_outcomes enable row level security;

drop policy if exists "ai_ops_outcomes_select_member" on public.ai_ops_outcomes;
create policy "ai_ops_outcomes_select_member"
on public.ai_ops_outcomes
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "ai_ops_outcomes_insert_member" on public.ai_ops_outcomes;
create policy "ai_ops_outcomes_insert_member"
on public.ai_ops_outcomes
for insert
to authenticated
with check (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- ai_ops_narrations (cache)
-- -----------------------------------------------------------------------------

create table if not exists public.ai_ops_narrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_key text not null check (char_length(trim(recommendation_key)) > 0),
  rule_id text not null,
  category text not null,
  -- Manager-facing narration: short paragraph + 2-4 next steps.
  -- We store both the structured payload (`narration_json`) and a
  -- pre-rendered text variant for fallback.
  narration_text text not null,
  narration_json jsonb not null default '{}'::jsonb,
  /** AI provider/model used; surfaces in the UI as "AI-assisted by Equipify". */
  provider text,
  model text,
  /** Prompt schema version — bump in code to invalidate cached entries. */
  schema_version text not null default 'ai_ops_narration_v1',
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_ops_narrations_org_key_unique
    unique (organization_id, recommendation_key, schema_version)
);

create index if not exists idx_ai_ops_narrations_org_updated
  on public.ai_ops_narrations (organization_id, updated_at desc);

comment on table public.ai_ops_narrations is
  'AI Ops Phase 2 — cached LLM narration for individual recommendations. Keyed by recommendation_key + schema_version so prompt edits invalidate cleanly.';

-- updated_at trigger.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_ai_ops_narrations_set_updated_at on public.ai_ops_narrations;
    create trigger trg_ai_ops_narrations_set_updated_at
      before update on public.ai_ops_narrations
      for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.ai_ops_narrations from public, anon;
grant select on table public.ai_ops_narrations to authenticated;
-- Inserts/updates happen exclusively via the API route (server with
-- elevated session); end-users only read the cached narration.

alter table public.ai_ops_narrations enable row level security;

drop policy if exists "ai_ops_narrations_select_member" on public.ai_ops_narrations;
create policy "ai_ops_narrations_select_member"
on public.ai_ops_narrations
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "ai_ops_narrations_write_owner_admin_manager" on public.ai_ops_narrations;
create policy "ai_ops_narrations_write_owner_admin_manager"
on public.ai_ops_narrations
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_narrations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_narrations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
);

-- AIden product usage (per user/org) — separate from ai_usage_logs provider rows.

create table if not exists public.aiden_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature_key text not null,
  plan_tier text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  duration_ms integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint aiden_usage_events_feature_key_check
    check (feature_key in ('support_chat', 'feature_request')),
  constraint aiden_usage_events_plan_tier_check
    check (plan_tier in ('solo', 'core', 'growth', 'scale')),
  constraint aiden_usage_events_tokens_nonneg check (
    prompt_tokens >= 0
    and completion_tokens >= 0
    and duration_ms >= 0
  )
);

comment on table public.aiden_usage_events is
  'AIden feature usage by org/user (support chat, feature requests). Inserted server-side via service role.';

create index if not exists idx_aiden_usage_events_org_created
  on public.aiden_usage_events (organization_id, created_at desc);

create index if not exists idx_aiden_usage_events_org_feature_month
  on public.aiden_usage_events (organization_id, feature_key, created_at desc);

alter table public.aiden_usage_events enable row level security;

revoke all on table public.aiden_usage_events from public, anon;
grant select on table public.aiden_usage_events to authenticated;

drop policy if exists "aiden_usage_events_select_org_member" on public.aiden_usage_events;
create policy "aiden_usage_events_select_org_member"
on public.aiden_usage_events
for select
to authenticated
using (public.is_org_member (organization_id));

-- Writes: API routes use service role only (no authenticated insert).

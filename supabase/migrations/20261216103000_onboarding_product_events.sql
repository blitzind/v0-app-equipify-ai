-- Org-scoped product onboarding analytics (no entity UUIDs in event keys; optional subject slugs only).

create table if not exists public.onboarding_product_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null,
  vertical_key text,
  subject_key text,
  created_at timestamptz not null default now(),
  constraint onboarding_product_events_event_key_check
    check (
      event_key in (
        'onboarding_welcome_viewed',
        'onboarding_launchpad_viewed',
        'onboarding_demo_panel_clicked',
        'onboarding_guided_action_clicked',
        'onboarding_guided_action_completed',
        'onboarding_first_equipment_created',
        'onboarding_first_work_order_created',
        'onboarding_first_pm_plan_created',
        'onboarding_first_invoice_or_quote_created',
        'onboarding_ai_recommendation_viewed'
      )
    ),
  constraint onboarding_product_events_vertical_key_len check (
    vertical_key is null or (char_length(vertical_key) <= 64 and vertical_key ~ '^[a-z0-9_]+$')
  ),
  constraint onboarding_product_events_subject_key_len check (
    subject_key is null or (char_length(subject_key) <= 80 and subject_key ~ '^[a-z0-9_]+$')
  )
);

comment on table public.onboarding_product_events is
  'First-run / guided onboarding analytics. Inserts via service role from app API only.';

create index if not exists idx_onboarding_product_events_org_created
  on public.onboarding_product_events (organization_id, created_at desc);

create index if not exists idx_onboarding_product_events_org_event
  on public.onboarding_product_events (organization_id, event_key, created_at desc);

alter table public.onboarding_product_events enable row level security;

revoke all on table public.onboarding_product_events from public, anon;
grant select on table public.onboarding_product_events to authenticated;
grant select, insert on table public.onboarding_product_events to service_role;

drop policy if exists "onboarding_product_events_select_org_member" on public.onboarding_product_events;
create policy "onboarding_product_events_select_org_member"
on public.onboarding_product_events
for select
to authenticated
using (public.is_org_member (organization_id));

-- Writes: application server uses service role (same pattern as aiden_usage_events inserts).

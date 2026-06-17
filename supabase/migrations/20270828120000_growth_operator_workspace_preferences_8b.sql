-- Phase 8B — Growth operator workspace settings persistence foundation.

create table if not exists growth.operator_workspace_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  default_landing_page text not null default '/growth/inbox',
  compact_mode boolean not null default false,
  reduced_motion boolean not null default false,
  sidebar_collapsed boolean not null default false,
  favorite_destinations text[] not null default '{}'::text[],
  last_visited_route text,
  inbox_default_filter text not null default 'all',
  calls_default_view text not null default 'workspace',
  opportunities_default_tab text not null default 'overview',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_workspace_preferences_user_unique unique (user_id),
  constraint operator_workspace_preferences_inbox_filter_check check (
    inbox_default_filter in (
      'all',
      'needs_action',
      'interested',
      'meeting_intent',
      'objections',
      'high_priority',
      'unassigned',
      'waiting',
      'archived'
    )
  ),
  constraint operator_workspace_preferences_calls_view_check check (
    calls_default_view in ('workspace', 'queue', 'live', 'coaching', 'overview')
  ),
  constraint operator_workspace_preferences_opportunities_tab_check check (
    opportunities_default_tab in ('overview', 'pipeline', 'readiness')
  ),
  constraint operator_workspace_preferences_landing_page_check check (
    default_landing_page ~ '^/growth/'
  )
);

create index if not exists idx_growth_operator_workspace_preferences_user
  on growth.operator_workspace_preferences (user_id);

comment on table growth.operator_workspace_preferences is
  'Per-user Growth workspace UI preferences — landing pages, sidebar, and default views. Service-role only.';

drop trigger if exists trg_growth_operator_workspace_preferences_set_updated_at
  on growth.operator_workspace_preferences;
create trigger trg_growth_operator_workspace_preferences_set_updated_at
before update on growth.operator_workspace_preferences
for each row execute function public.set_updated_at();

revoke all on table growth.operator_workspace_preferences from public, anon, authenticated;
grant select, insert, update, delete on table growth.operator_workspace_preferences to service_role;

alter table growth.operator_workspace_preferences enable row level security;
alter table growth.operator_workspace_preferences force row level security;

create policy growth_operator_workspace_preferences_service_role
  on growth.operator_workspace_preferences for all to service_role using (true) with check (true);

-- Extend SN-9 notification preferences with email delivery toggle (foundation only).
alter table growth.operator_notification_preferences
  add column if not exists email_notifications_enabled boolean not null default true;

comment on column growth.operator_notification_preferences.email_notifications_enabled is
  'Operator email notification delivery preference (foundation — routing lands in a later phase).';

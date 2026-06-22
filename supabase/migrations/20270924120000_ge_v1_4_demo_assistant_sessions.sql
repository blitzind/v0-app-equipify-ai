-- GE-v1-4 — Retell Conversational Demo Assistant (minimal session persistence)

-- -----------------------------------------------------------------------------
-- Demo assistant sessions (outcomes only — no transcript archive)
-- -----------------------------------------------------------------------------

create table if not exists growth.demo_assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  landing_page_id uuid not null references growth.growth_landing_pages (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  published_slug text not null,
  public_session_id text not null,
  status text not null
    check (status in ('active', 'completed', 'failed')),
  retell_chat_id text,
  prospect_context jsonb not null default '{}'::jsonb,
  conversation_outcome jsonb,
  error_metadata jsonb,
  qa_marker text not null default 'ge-v1-4-retell-demo-assistant-v1',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_demo_assistant_sessions_org_created
  on growth.demo_assistant_sessions (organization_id, created_at desc);

create index if not exists idx_demo_assistant_sessions_page
  on growth.demo_assistant_sessions (landing_page_id, created_at desc);

create index if not exists idx_demo_assistant_sessions_public_session
  on growth.demo_assistant_sessions (public_session_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Extend engagement event types for GE-v1-4 analytics
-- -----------------------------------------------------------------------------

alter table growth.growth_engagement_events
  drop constraint if exists growth_engagement_events_event_type_check;

alter table growth.growth_engagement_events
  add constraint growth_engagement_events_event_type_check
  check (event_type in (
    'page_view', 'scroll', 'video_start', 'video_progress', 'video_complete',
    'cta_click', 'calendar_open', 'booking_started', 'booking_completed',
    'agent_opened', 'agent_question', 'agent_completed',
    'question_asked', 'response_generated', 'booking_offered', 'conversation_completed'
  ));

-- -----------------------------------------------------------------------------
-- Kill switch
-- -----------------------------------------------------------------------------

insert into growth.runtime_guardrail_settings (key, enabled, value_json)
values ('demo_assistant_enabled', true, '{}'::jsonb)
on conflict (key) do nothing;

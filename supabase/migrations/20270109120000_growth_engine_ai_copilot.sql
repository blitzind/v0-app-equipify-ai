-- Growth Engine slice 6.0A: AI Communication Copilot — generations, effectiveness, rules, settings.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.copilot_settings — platform singleton governance
-- -----------------------------------------------------------------------------

create table if not exists growth.copilot_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton = true),
  ai_copilot_enabled boolean not null default false,
  ai_copilot_human_approval_required boolean not null default true
    check (ai_copilot_human_approval_required = true),
  ai_copilot_store_generations boolean not null default true,
  ai_copilot_generation_retention_days int not null default 90
    check (ai_copilot_generation_retention_days >= 1 and ai_copilot_generation_retention_days <= 3650),
  ai_copilot_default_prompt_variant text not null default 'default',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.copilot_settings (singleton)
values (true)
on conflict (singleton) do nothing;

revoke all on table growth.copilot_settings from public, anon, authenticated;
grant select, insert, update, delete on table growth.copilot_settings to service_role;
alter table growth.copilot_settings enable row level security;
alter table growth.copilot_settings force row level security;

-- -----------------------------------------------------------------------------
-- growth.ai_copilot_rules — governance rule registry
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  label text not null,
  description text,
  enabled boolean not null default true,
  rule_config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.ai_copilot_rules (rule_key, label, description, enabled, sort_order)
values
  ('block_suppressed_leads', 'Block suppressed leads', 'Prevent copilot generation for suppressed contacts.', true, 10),
  ('block_not_interested_cold', 'Block cold outreach when not interested', 'Prevent cold/reengagement drafts when lead is not interested.', true, 20),
  ('require_human_approval', 'Require human approval', 'All generations remain draft until explicitly approved.', true, 30),
  ('no_auto_send', 'No autonomous send', 'Copilot never sends email or places calls.', true, 40)
on conflict (rule_key) do nothing;

revoke all on table growth.ai_copilot_rules from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_copilot_rules to service_role;
alter table growth.ai_copilot_rules enable row level security;
alter table growth.ai_copilot_rules force row level security;

-- -----------------------------------------------------------------------------
-- growth.ai_copilot_generations
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_generations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  generation_type text not null check (generation_type in (
    'cold_email', 'follow_up_email', 'response_draft', 'reengagement_email', 'executive_email',
    'breakup_email', 'call_opening', 'call_objection_response', 'call_summary', 'next_message',
    'call_risk_brief'
  )),
  prompt_version text not null default '6.0A-v1',
  prompt_variant text not null default 'default',
  input_snapshot jsonb not null default '{}'::jsonb,
  generated_content text not null default '',
  generated_subject text,
  classification jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'discarded', 'expired')),
  source_reply_id uuid references growth.outbound_replies (id) on delete set null,
  input_hash text,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz check (sent_at is null),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_copilot_generations_lead_created
  on growth.ai_copilot_generations (lead_id, created_at desc);

create index if not exists idx_ai_copilot_generations_status_created
  on growth.ai_copilot_generations (status, created_at desc);

create index if not exists idx_ai_copilot_generations_type_created
  on growth.ai_copilot_generations (generation_type, created_at desc);

revoke all on table growth.ai_copilot_generations from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_copilot_generations to service_role;
alter table growth.ai_copilot_generations enable row level security;
alter table growth.ai_copilot_generations force row level security;

-- -----------------------------------------------------------------------------
-- growth.ai_copilot_effectiveness — outcome tracking (advisory metrics only)
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_effectiveness (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references growth.ai_copilot_generations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  generation_type text not null,
  prompt_variant text not null default 'default',
  prompt_version text not null default '6.0A-v1',
  outcome text not null check (outcome in ('generated', 'approved', 'discarded', 'expired')),
  classification_primary text,
  effectiveness_score int not null default 0
    check (effectiveness_score >= 0 and effectiveness_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_ai_copilot_effectiveness_type_recorded
  on growth.ai_copilot_effectiveness (generation_type, recorded_at desc);

create index if not exists idx_ai_copilot_effectiveness_variant_recorded
  on growth.ai_copilot_effectiveness (prompt_variant, recorded_at desc);

revoke all on table growth.ai_copilot_effectiveness from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_copilot_effectiveness to service_role;
alter table growth.ai_copilot_effectiveness enable row level security;
alter table growth.ai_copilot_effectiveness force row level security;

-- -----------------------------------------------------------------------------
-- Timeline event types
-- -----------------------------------------------------------------------------

alter table growth.lead_timeline_events
  drop constraint if exists lead_timeline_events_event_type_check;

alter table growth.lead_timeline_events
  add constraint lead_timeline_events_event_type_check check (event_type in (
    'lead_created', 'research_started', 'research_completed', 'research_failed',
    'website_fetch_failed', 'website_fetch_fixed',
    'decision_maker_added', 'decision_maker_confirmed', 'decision_maker_rejected',
    'call_started', 'call_attempted', 'voicemail_left', 'interested',
    'follow_up_created', 'follow_up_completed',
    'notes_updated', 'priority_changed', 'override_changed', 'next_best_action_changed',
    'website_changed', 'status_changed', 'import_created', 'import_updated', 'manual_touch',
    'email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_replied',
    'email_bounced', 'email_unsubscribed', 'email_failed', 'email_spam_complaint',
    'email_suppressed', 'email_unmatched',
    'engagement_score_changed', 'engagement_tier_changed', 'lead_became_hot', 'lead_became_dormant',
    'relationship_strength_changed', 'relationship_became_trusted', 'relationship_became_strategic',
    'relationship_cooled',
    'opportunity_readiness_changed', 'lead_became_sales_ready', 'lead_became_priority_opportunity',
    'opportunity_blocker_added', 'opportunity_blocker_resolved',
    'revenue_probability_changed', 'lead_became_forecasted', 'lead_became_commit_candidate',
    'forecast_confidence_changed', 'forecast_regression_detected',
    'executive_priority_changed', 'executive_intervention_recommended',
    'operational_capacity_changed', 'capacity_constraint_added', 'capacity_constraint_resolved',
    'operational_risk_detected',
    'ai_copilot_generation_created', 'ai_copilot_generation_approved'
  ));

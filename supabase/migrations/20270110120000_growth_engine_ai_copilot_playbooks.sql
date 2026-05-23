-- Growth Engine slice 6.1A: AI Copilot Playbook Training.

do $$
begin
  if to_regclass('growth.ai_copilot_generations') is null then
    raise exception 'Missing dependency: growth.ai_copilot_generations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Copilot settings extensions
-- -----------------------------------------------------------------------------

alter table growth.copilot_settings
  add column if not exists ai_copilot_playbook_enabled boolean not null default true,
  add column if not exists ai_copilot_playbook_max_rules_per_generation int not null default 12
    check (ai_copilot_playbook_max_rules_per_generation >= 1 and ai_copilot_playbook_max_rules_per_generation <= 50),
  add column if not exists ai_copilot_playbook_source_retention_days int not null default 30
    check (ai_copilot_playbook_source_retention_days >= 1 and ai_copilot_playbook_source_retention_days <= 3650);

-- -----------------------------------------------------------------------------
-- Generation playbook influence
-- -----------------------------------------------------------------------------

alter table growth.ai_copilot_generations
  add column if not exists playbook_influence_score int not null default 0
    check (playbook_influence_score >= 0 and playbook_influence_score <= 100),
  add column if not exists playbook_attribution jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Rule categories
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_playbook_rule_categories (
  key text primary key,
  label text not null,
  description text,
  sort_order int not null default 0
);

insert into growth.ai_copilot_playbook_rule_categories (key, label, description, sort_order)
values
  ('email_style', 'Email style', 'Structure, length, and formatting guidance for email drafts.', 10),
  ('call_script', 'Call script', 'Spoken call flow and talk-track guidance.', 20),
  ('objection_handling', 'Objection handling', 'Responses to common objections.', 30),
  ('tone', 'Tone', 'Voice, formality, and personality constraints.', 40),
  ('cta', 'CTA', 'Calls to action patterns and closing asks.', 50),
  ('words_to_avoid', 'Words to avoid', 'Phrases or patterns to exclude from outputs.', 60),
  ('industry_instruction', 'Industry instruction', 'Vertical-specific guidance.', 70),
  ('follow_up_strategy', 'Follow-up strategy', 'Cadence and follow-up messaging guidance.', 80),
  ('value_proposition_framing', 'Value proposition framing', 'How to position product value.', 90)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Playbook sources
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_playbook_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_kind text not null check (source_kind in (
    'youtube_link', 'transcript_text', 'pasted_notes', 'uploaded_document', 'website_url'
  )),
  source_url text,
  raw_content text,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  trainer_profile jsonb not null default '{}'::jsonb,
  industry_scope jsonb not null default '{"appliesGlobally": true}'::jsonb,
  storage_policy text not null default 'principles_only'
    check (storage_policy in ('principles_only', 'retain_source')),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'extracting', 'extracted', 'failed', 'archived', 'unsupported')),
  retain_until timestamptz,
  parent_source_id uuid references growth.ai_copilot_playbook_sources (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playbook_sources_status_created
  on growth.ai_copilot_playbook_sources (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Extractions
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_playbook_extractions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references growth.ai_copilot_playbook_sources (id) on delete cascade,
  extraction_version text not null default '6.1A-v1',
  prompt_variant text not null default 'default',
  input_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  draft_rule_count int not null default 0,
  conflict_count int not null default 0,
  conflicts jsonb not null default '[]'::jsonb,
  model_provider text,
  model_name text,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Draft rules
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_playbook_draft_rules (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references growth.ai_copilot_playbook_extractions (id) on delete cascade,
  source_id uuid not null references growth.ai_copilot_playbook_sources (id) on delete cascade,
  category text not null references growth.ai_copilot_playbook_rule_categories (key),
  title text not null,
  principle text not null,
  applies_to jsonb not null default '[]'::jsonb,
  priority int not null default 50 check (priority >= 0 and priority <= 100),
  industry_scope jsonb not null default '{"appliesGlobally": true}'::jsonb,
  trainer_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Approved rules + versions
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_playbook_approved_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  category text not null references growth.ai_copilot_playbook_rule_categories (key),
  title text not null,
  principle text not null,
  applies_to jsonb not null default '[]'::jsonb,
  priority int not null default 50 check (priority >= 0 and priority <= 100),
  version int not null default 1 check (version >= 1),
  industry_scope jsonb not null default '{"appliesGlobally": true}'::jsonb,
  trainer_profile jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'superseded', 'disabled')),
  source_id uuid references growth.ai_copilot_playbook_sources (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_playbook_approved_rules_key_version
  on growth.ai_copilot_playbook_approved_rules (rule_key, version);

create index if not exists idx_playbook_approved_rules_active_category
  on growth.ai_copilot_playbook_approved_rules (status, category)
  where status = 'active';

create table if not exists growth.ai_copilot_playbook_rule_versions (
  id uuid primary key default gen_random_uuid(),
  approved_rule_id uuid not null references growth.ai_copilot_playbook_approved_rules (id) on delete cascade,
  rule_key text not null,
  version int not null,
  snapshot jsonb not null default '{}'::jsonb,
  change_summary text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists growth.ai_copilot_playbook_rule_attributions (
  id uuid primary key default gen_random_uuid(),
  approved_rule_id uuid not null references growth.ai_copilot_playbook_approved_rules (id) on delete cascade,
  source_id uuid not null references growth.ai_copilot_playbook_sources (id) on delete cascade,
  contribution_weight int not null default 100 check (contribution_weight >= 0 and contribution_weight <= 100),
  evidence_summary text,
  created_at timestamptz not null default now()
);

create table if not exists growth.ai_copilot_generation_playbook_rules (
  generation_id uuid not null references growth.ai_copilot_generations (id) on delete cascade,
  approved_rule_id uuid not null references growth.ai_copilot_playbook_approved_rules (id) on delete cascade,
  rule_version int not null,
  source_id uuid references growth.ai_copilot_playbook_sources (id) on delete set null,
  primary key (generation_id, approved_rule_id)
);

-- -----------------------------------------------------------------------------
-- Playbook effectiveness
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_copilot_playbook_effectiveness (
  id uuid primary key default gen_random_uuid(),
  approved_rule_id uuid references growth.ai_copilot_playbook_approved_rules (id) on delete set null,
  source_id uuid references growth.ai_copilot_playbook_sources (id) on delete set null,
  generation_id uuid references growth.ai_copilot_generations (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  outcome text not null check (outcome in (
    'extracted', 'approved', 'rejected', 'applied', 'generation_approved', 'generation_discarded', 'conflict_detected'
  )),
  category text,
  playbook_influence_score int not null default 0
    check (playbook_influence_score >= 0 and playbook_influence_score <= 100),
  effectiveness_score int not null default 0
    check (effectiveness_score >= 0 and effectiveness_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_playbook_effectiveness_rule_recorded
  on growth.ai_copilot_playbook_effectiveness (approved_rule_id, recorded_at desc);

revoke all on table growth.ai_copilot_playbook_rule_categories from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_sources from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_extractions from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_draft_rules from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_approved_rules from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_rule_versions from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_rule_attributions from public, anon, authenticated;
revoke all on table growth.ai_copilot_generation_playbook_rules from public, anon, authenticated;
revoke all on table growth.ai_copilot_playbook_effectiveness from public, anon, authenticated;

grant select, insert, update, delete on table growth.ai_copilot_playbook_rule_categories to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_sources to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_extractions to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_draft_rules to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_approved_rules to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_rule_versions to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_rule_attributions to service_role;
grant select, insert, update, delete on table growth.ai_copilot_generation_playbook_rules to service_role;
grant select, insert, update, delete on table growth.ai_copilot_playbook_effectiveness to service_role;

alter table growth.ai_copilot_playbook_rule_categories enable row level security;
alter table growth.ai_copilot_playbook_sources enable row level security;
alter table growth.ai_copilot_playbook_extractions enable row level security;
alter table growth.ai_copilot_playbook_draft_rules enable row level security;
alter table growth.ai_copilot_playbook_approved_rules enable row level security;
alter table growth.ai_copilot_playbook_rule_versions enable row level security;
alter table growth.ai_copilot_playbook_rule_attributions enable row level security;
alter table growth.ai_copilot_generation_playbook_rules enable row level security;
alter table growth.ai_copilot_playbook_effectiveness enable row level security;

alter table growth.ai_copilot_playbook_rule_categories force row level security;
alter table growth.ai_copilot_playbook_sources force row level security;
alter table growth.ai_copilot_playbook_extractions force row level security;
alter table growth.ai_copilot_playbook_draft_rules force row level security;
alter table growth.ai_copilot_playbook_approved_rules force row level security;
alter table growth.ai_copilot_playbook_rule_versions force row level security;
alter table growth.ai_copilot_playbook_rule_attributions force row level security;
alter table growth.ai_copilot_generation_playbook_rules force row level security;
alter table growth.ai_copilot_playbook_effectiveness force row level security;

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
    'ai_copilot_generation_created', 'ai_copilot_generation_approved',
    'playbook_conflict_detected'
  ));

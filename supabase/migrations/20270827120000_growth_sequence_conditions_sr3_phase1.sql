-- SR-3 Phase 1 — conditional sequence schema foundation (no runtime evaluation)

do $$
begin
  if to_regclass('growth.sequence_pattern_steps') is null then
    raise exception 'SR-3 Phase 1 requires growth.sequence_pattern_steps';
  end if;
  if to_regclass('growth.sequence_enrollments') is null then
    raise exception 'SR-3 Phase 1 requires growth.sequence_enrollments';
  end if;
end $$;

-- Extend enrollment step lifecycle for future wait/branch states.
alter table growth.sequence_enrollment_steps
  drop constraint if exists sequence_enrollment_steps_status_check;

alter table growth.sequence_enrollment_steps
  add constraint sequence_enrollment_steps_status_check
  check (status in (
    'pending', 'draft_created', 'queued', 'approved', 'executed', 'skipped', 'failed', 'cancelled',
    'waiting', 'branch_skipped'
  ));

comment on column growth.sequence_enrollment_steps.status is
  'SR-3 Phase 1 adds waiting (blocked on condition/wait) and branch_skipped (non-taken branch path).';

create table if not exists growth.sequence_pattern_step_conditions (
  id uuid primary key default gen_random_uuid(),
  pattern_step_id uuid not null references growth.sequence_pattern_steps (id) on delete cascade,
  condition_key text not null check (char_length(trim(condition_key)) between 1 and 80),
  dsl_version int not null default 1 check (dsl_version = 1),
  source text not null check (source in (
    'email', 'share_page', 'sms', 'voice_drop', 'cadence', 'lead', 'engagement'
  )),
  event text not null check (event in (
    'email.opened', 'email.clicked', 'email.replied', 'email.bounced',
    'share_page.viewed', 'share_page.engaged', 'share_page.cta_clicked',
    'share_page.booking_started', 'share_page.booking_completed',
    'sms.delivered', 'sms.replied', 'sms.failed',
    'voice_drop.delivered', 'voice_drop.failed',
    'call_task.completed',
    'lead.status', 'lead.hot_tier', 'lead.next_best_action',
    'engagement.score_threshold', 'engagement.tier'
  )),
  compare_operator text check (compare_operator in ('eq', 'neq', 'gte', 'lte', 'gt', 'lt')),
  string_value text check (string_value is null or char_length(string_value) <= 160),
  number_value numeric check (number_value is null or number_value >= 0),
  boolean_value boolean,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  label text check (label is null or char_length(label) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pattern_step_id, condition_key),
  constraint sequence_pattern_step_conditions_source_event_match check (
    (source = 'email' and event like 'email.%')
    or (source = 'share_page' and event like 'share_page.%')
    or (source = 'sms' and event like 'sms.%')
    or (source = 'voice_drop' and event like 'voice_drop.%')
    or (source = 'cadence' and event like 'call_task.%')
    or (source = 'lead' and event like 'lead.%')
    or (source = 'engagement' and event like 'engagement.%')
  ),
  constraint sequence_pattern_step_conditions_lead_status_params check (
    event <> 'lead.status' or (string_value is not null and compare_operator is null)
  ),
  constraint sequence_pattern_step_conditions_lead_hot_tier_params check (
    event <> 'lead.hot_tier' or (string_value is not null and compare_operator is null)
  ),
  constraint sequence_pattern_step_conditions_lead_next_best_action_params check (
    event <> 'lead.next_best_action' or (string_value is not null and compare_operator is null)
  ),
  constraint sequence_pattern_step_conditions_engagement_score_params check (
    event <> 'engagement.score_threshold'
    or (number_value is not null and compare_operator is not null)
  ),
  constraint sequence_pattern_step_conditions_engagement_tier_params check (
    event <> 'engagement.tier' or (string_value is not null and compare_operator is null)
  )
);

create index if not exists idx_growth_sequence_pattern_step_conditions_step
  on growth.sequence_pattern_step_conditions (pattern_step_id);

create table if not exists growth.sequence_pattern_step_edges (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references growth.sequence_patterns (id) on delete cascade,
  from_pattern_step_id uuid not null references growth.sequence_pattern_steps (id) on delete cascade,
  to_pattern_step_id uuid not null references growth.sequence_pattern_steps (id) on delete cascade,
  condition_id uuid references growth.sequence_pattern_step_conditions (id) on delete set null,
  edge_type text not null check (edge_type in (
    'default', 'conditional_true', 'conditional_false', 'timeout', 'fallback'
  )),
  priority int not null default 0 check (priority >= 0),
  label text check (label is null or char_length(label) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_pattern_step_id <> to_pattern_step_id)
);

create index if not exists idx_growth_sequence_pattern_step_edges_pattern
  on growth.sequence_pattern_step_edges (pattern_id);

create index if not exists idx_growth_sequence_pattern_step_edges_from_step
  on growth.sequence_pattern_step_edges (from_pattern_step_id, priority desc);

create table if not exists growth.sequence_enrollment_step_waits (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references growth.sequence_enrollments (id) on delete cascade,
  enrollment_step_id uuid not null references growth.sequence_enrollment_steps (id) on delete cascade,
  pattern_step_id uuid references growth.sequence_pattern_steps (id) on delete set null,
  condition_id uuid references growth.sequence_pattern_step_conditions (id) on delete set null,
  wait_kind text not null check (wait_kind in ('condition', 'duration', 'until_event')),
  status text not null default 'pending' check (status in (
    'pending', 'active', 'resolved', 'timed_out', 'cancelled'
  )),
  waited_for_source text check (waited_for_source in (
    'email', 'share_page', 'sms', 'voice_drop', 'cadence', 'lead', 'engagement'
  )),
  waited_for_event text check (waited_for_event in (
    'email.opened', 'email.clicked', 'email.replied', 'email.bounced',
    'share_page.viewed', 'share_page.engaged', 'share_page.cta_clicked',
    'share_page.booking_started', 'share_page.booking_completed',
    'sms.delivered', 'sms.replied', 'sms.failed',
    'voice_drop.delivered', 'voice_drop.failed',
    'call_task.completed',
    'lead.status', 'lead.hot_tier', 'lead.next_best_action',
    'engagement.score_threshold', 'engagement.tier'
  )),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  timeout_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  resolution_reason text check (resolution_reason is null or char_length(resolution_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_enrollment_step_waits_enrollment
  on growth.sequence_enrollment_step_waits (enrollment_id, status);

create index if not exists idx_growth_sequence_enrollment_step_waits_step
  on growth.sequence_enrollment_step_waits (enrollment_step_id, status);

create index if not exists idx_growth_sequence_enrollment_step_waits_timeout
  on growth.sequence_enrollment_step_waits (timeout_at)
  where status in ('pending', 'active') and timeout_at is not null;

create table if not exists growth.sequence_branch_decisions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references growth.sequence_enrollments (id) on delete cascade,
  enrollment_step_id uuid references growth.sequence_enrollment_steps (id) on delete set null,
  pattern_step_id uuid references growth.sequence_pattern_steps (id) on delete set null,
  condition_id uuid references growth.sequence_pattern_step_conditions (id) on delete set null,
  edge_id uuid references growth.sequence_pattern_step_edges (id) on delete set null,
  decision text not null check (decision in ('true', 'false', 'timeout', 'skipped')),
  dsl_version int not null default 1 check (dsl_version = 1),
  source text not null check (source in (
    'email', 'share_page', 'sms', 'voice_drop', 'cadence', 'lead', 'engagement'
  )),
  event text not null check (event in (
    'email.opened', 'email.clicked', 'email.replied', 'email.bounced',
    'share_page.viewed', 'share_page.engaged', 'share_page.cta_clicked',
    'share_page.booking_started', 'share_page.booking_completed',
    'sms.delivered', 'sms.replied', 'sms.failed',
    'voice_drop.delivered', 'voice_drop.failed',
    'call_task.completed',
    'lead.status', 'lead.hot_tier', 'lead.next_best_action',
    'engagement.score_threshold', 'engagement.tier'
  )),
  outcome_detail text check (outcome_detail is null or char_length(outcome_detail) <= 500),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_branch_decisions_enrollment
  on growth.sequence_branch_decisions (enrollment_id, evaluated_at desc);

create index if not exists idx_growth_sequence_branch_decisions_step
  on growth.sequence_branch_decisions (enrollment_step_id, evaluated_at desc)
  where enrollment_step_id is not null;

-- SR-3 Phase 1 reserved channel timeline event_kind values (column remains event_kind).
comment on column growth.sequence_enrollment_channel_events.event_kind is
  'Timeline kind. SR-3 Phase 1 reserves: branch_evaluated, wait_started, wait_resolved, condition_timeout.';

revoke all on table growth.sequence_pattern_step_conditions from public, anon, authenticated;
grant select, insert, update, delete on table growth.sequence_pattern_step_conditions to service_role;
alter table growth.sequence_pattern_step_conditions enable row level security;
alter table growth.sequence_pattern_step_conditions force row level security;

create policy growth_sequence_pattern_step_conditions_service_role
  on growth.sequence_pattern_step_conditions for all to service_role using (true) with check (true);

revoke all on table growth.sequence_pattern_step_edges from public, anon, authenticated;
grant select, insert, update, delete on table growth.sequence_pattern_step_edges to service_role;
alter table growth.sequence_pattern_step_edges enable row level security;
alter table growth.sequence_pattern_step_edges force row level security;

create policy growth_sequence_pattern_step_edges_service_role
  on growth.sequence_pattern_step_edges for all to service_role using (true) with check (true);

revoke all on table growth.sequence_enrollment_step_waits from public, anon, authenticated;
grant select, insert, update, delete on table growth.sequence_enrollment_step_waits to service_role;
alter table growth.sequence_enrollment_step_waits enable row level security;
alter table growth.sequence_enrollment_step_waits force row level security;

create policy growth_sequence_enrollment_step_waits_service_role
  on growth.sequence_enrollment_step_waits for all to service_role using (true) with check (true);

revoke all on table growth.sequence_branch_decisions from public, anon, authenticated;
grant select, insert on table growth.sequence_branch_decisions to service_role;
alter table growth.sequence_branch_decisions enable row level security;
alter table growth.sequence_branch_decisions force row level security;

create policy growth_sequence_branch_decisions_service_role
  on growth.sequence_branch_decisions for all to service_role using (true) with check (true);

create trigger set_sequence_pattern_step_conditions_updated_at
  before update on growth.sequence_pattern_step_conditions
  for each row execute function public.set_updated_at();

create trigger set_sequence_pattern_step_edges_updated_at
  before update on growth.sequence_pattern_step_edges
  for each row execute function public.set_updated_at();

create trigger set_sequence_enrollment_step_waits_updated_at
  before update on growth.sequence_enrollment_step_waits
  for each row execute function public.set_updated_at();

comment on table growth.sequence_pattern_step_conditions is
  'SR-3 Phase 1 — versioned structured condition DSL attached to pattern steps (persistence only).';
comment on table growth.sequence_pattern_step_edges is
  'SR-3 Phase 1 — directed edges between pattern steps for conditional branching graphs.';
comment on table growth.sequence_enrollment_step_waits is
  'SR-3 Phase 1 — enrollment-level wait records (persistence only; no resolver in Phase 1).';
comment on table growth.sequence_branch_decisions is
  'SR-3 Phase 1 — append-only branch decision audit log.';

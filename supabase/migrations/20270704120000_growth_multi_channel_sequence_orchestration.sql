-- Growth Engine Phase 5.4 — Multi-channel sequence orchestration (email + SMS transport + call cadence).

alter table growth.sequence_pattern_steps
  drop constraint if exists sequence_pattern_steps_channel_check;

alter table growth.sequence_pattern_steps
  add constraint sequence_pattern_steps_channel_check
  check (channel in (
    'email', 'sms', 'call', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.sequence_enrollment_steps
  drop constraint if exists sequence_enrollment_steps_channel_check;

alter table growth.sequence_enrollment_steps
  add constraint sequence_enrollment_steps_channel_check
  check (channel in (
    'email', 'sms', 'call', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.outreach_queue
  drop constraint if exists outreach_queue_channel_check;

alter table growth.outreach_queue
  add constraint outreach_queue_channel_check
  check (channel in (
    'email', 'sms', 'call', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.sequence_execution_jobs
  add column if not exists channel text not null default 'email',
  add column if not exists sms_draft_body text,
  add column if not exists sms_to_e164 text,
  add column if not exists sms_delivery_attempt_id uuid references growth.sms_delivery_attempts (id) on delete set null;

alter table growth.sequence_execution_jobs
  drop constraint if exists sequence_execution_jobs_channel_check;

alter table growth.sequence_execution_jobs
  add constraint sequence_execution_jobs_channel_check
  check (channel in ('email', 'sms'));

create table if not exists growth.sequence_enrollment_channel_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references growth.sequence_enrollments (id) on delete cascade,
  enrollment_step_id uuid references growth.sequence_enrollment_steps (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  channel text not null,
  event_kind text not null,
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sequence_enrollment_channel_events_enrollment
  on growth.sequence_enrollment_channel_events (enrollment_id, occurred_at desc);

create index if not exists idx_sequence_enrollment_channel_events_lead
  on growth.sequence_enrollment_channel_events (lead_id, occurred_at desc);

revoke all on table growth.sequence_enrollment_channel_events from public, anon, authenticated;
grant select, insert on table growth.sequence_enrollment_channel_events to service_role;
alter table growth.sequence_enrollment_channel_events enable row level security;

comment on table growth.sequence_enrollment_channel_events is
  'Unified multi-channel sequence touch timeline (email sent, SMS sent, call completed, reply received).';

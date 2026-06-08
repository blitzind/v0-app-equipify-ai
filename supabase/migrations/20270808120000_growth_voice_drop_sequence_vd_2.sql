-- Growth Engine Phase VD-2 — Voice Drop sequence transport integration.

alter table growth.sequence_pattern_steps
  drop constraint if exists sequence_pattern_steps_channel_check;

alter table growth.sequence_pattern_steps
  add constraint sequence_pattern_steps_channel_check
  check (channel in (
    'email', 'sms', 'voice_drop', 'call', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.sequence_enrollment_steps
  drop constraint if exists sequence_enrollment_steps_channel_check;

alter table growth.sequence_enrollment_steps
  add constraint sequence_enrollment_steps_channel_check
  check (channel in (
    'email', 'sms', 'voice_drop', 'call', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.outreach_queue
  drop constraint if exists outreach_queue_channel_check;

alter table growth.outreach_queue
  add constraint outreach_queue_channel_check
  check (channel in (
    'email', 'sms', 'voice_drop', 'call', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.sequence_pattern_steps
  add column if not exists voice_drop_campaign_id uuid references voice.voice_drop_campaigns (id) on delete set null;

alter table growth.sequence_enrollment_steps
  add column if not exists voice_drop_campaign_id uuid references voice.voice_drop_campaigns (id) on delete set null;

alter table growth.sequence_execution_jobs
  add column if not exists voice_drop_campaign_id uuid references voice.voice_drop_campaigns (id) on delete set null,
  add column if not exists voice_drop_recipient_id uuid,
  add column if not exists voice_drop_delivery_attempt_id uuid;

alter table growth.sequence_execution_jobs
  drop constraint if exists sequence_execution_jobs_channel_check;

alter table growth.sequence_execution_jobs
  add constraint sequence_execution_jobs_channel_check
  check (channel in ('email', 'sms', 'voice_drop'));

comment on column growth.sequence_pattern_steps.voice_drop_campaign_id is
  'Approved voice drop campaign for voice_drop sequence steps — managed in Voice Drop module.';

comment on column growth.sequence_enrollment_steps.voice_drop_campaign_id is
  'Materialized voice drop campaign id copied from pattern step at enrollment.';

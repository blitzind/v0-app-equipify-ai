-- SR-3 Phase 0 — sequence event attribution columns (enrollment → step → job)

alter table growth.delivery_attempts
  add column if not exists sequence_enrollment_step_id uuid,
  add column if not exists sequence_execution_job_id uuid;

create index if not exists idx_growth_delivery_attempts_sequence_enrollment_step
  on growth.delivery_attempts (sequence_enrollment_step_id)
  where sequence_enrollment_step_id is not null;

create index if not exists idx_growth_delivery_attempts_sequence_execution_job
  on growth.delivery_attempts (sequence_execution_job_id)
  where sequence_execution_job_id is not null;

alter table growth.email_opens
  add column if not exists sequence_enrollment_id uuid,
  add column if not exists sequence_enrollment_step_id uuid,
  add column if not exists sequence_execution_job_id uuid;

alter table growth.email_clicks
  add column if not exists sequence_enrollment_id uuid,
  add column if not exists sequence_enrollment_step_id uuid,
  add column if not exists sequence_execution_job_id uuid;

alter table growth.sms_delivery_attempts
  add column if not exists sequence_enrollment_id uuid,
  add column if not exists sequence_enrollment_step_id uuid,
  add column if not exists sequence_execution_job_id uuid;

alter table growth.share_pages
  add column if not exists sequence_enrollment_step_id uuid;

alter table growth.share_page_views
  add column if not exists enrollment_id uuid,
  add column if not exists sequence_enrollment_step_id uuid,
  add column if not exists sequence_step_id uuid,
  add column if not exists sequence_execution_job_id uuid;

alter table growth.share_page_events
  add column if not exists enrollment_id uuid,
  add column if not exists sequence_enrollment_step_id uuid,
  add column if not exists sequence_step_id uuid,
  add column if not exists sequence_execution_job_id uuid;

alter table growth.cadence_tasks
  add column if not exists sequence_enrollment_id uuid,
  add column if not exists sequence_execution_job_id uuid;

comment on column growth.delivery_attempts.sequence_enrollment_step_id is
  'SR-3 Phase 0 — enrollment step that produced this delivery attempt.';
comment on column growth.delivery_attempts.sequence_execution_job_id is
  'SR-3 Phase 0 — approved sequence execution job that triggered this send.';

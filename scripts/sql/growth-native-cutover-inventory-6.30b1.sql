-- =============================================================================
-- Phase 6.30B-1 — Native Email Cutover Preparation Inventory (READ-ONLY)
-- =============================================================================
-- Purpose: Production migration snapshot before GROWTH_OUTBOUND_MODE=standalone
-- Schema:  growth
-- Safety:  SELECT-only — no INSERT/UPDATE/DELETE
-- Run in:  Supabase SQL Editor (service role or platform-admin access)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Cutover gate summary (single row — interpret before section detail)
-- -----------------------------------------------------------------------------
WITH
  blocking_outreach AS (
    SELECT COUNT(*)::bigint AS n
    FROM growth.outreach_queue
    WHERE status IN ('pending_approval', 'approved', 'scheduled')
  ),
  steps_with_queue AS (
    SELECT COUNT(*)::bigint AS n
    FROM growth.sequence_enrollment_steps
    WHERE outreach_queue_id IS NOT NULL
  ),
  scheduler_blocked_steps AS (
    SELECT COUNT(*)::bigint AS n
    FROM growth.sequence_enrollment_steps ses
    JOIN growth.sequence_enrollments se ON se.id = ses.enrollment_id
    WHERE se.status = 'active'
      AND ses.outreach_queue_id IS NOT NULL
      AND ses.status IN ('pending', 'draft_created')
  ),
  stall_enrollments AS (
    SELECT COUNT(DISTINCT se.id)::bigint AS n
    FROM growth.sequence_enrollments se
    JOIN growth.sequence_enrollment_steps ses ON ses.enrollment_id = se.id
    WHERE se.status IN ('active', 'paused')
      AND (
        ses.outreach_queue_id IS NOT NULL
        OR (ses.status = 'queued' AND ses.channel = 'email')
      )
  ),
  enabled_routes AS (
    SELECT COUNT(*)::bigint AS n
    FROM growth.delivery_routes
    WHERE enabled = true
  ),
  connected_mailboxes AS (
    SELECT COUNT(*)::bigint AS n
    FROM growth.mailbox_connections
    WHERE deleted_at IS NULL
      AND status = 'connected'
  ),
  approved_due_jobs AS (
    SELECT COUNT(*)::bigint AS n
    FROM growth.sequence_execution_jobs
    WHERE status = 'approved'
      AND scheduled_for <= NOW()
  )
SELECT
  NOW() AT TIME ZONE 'UTC' AS inventoried_at_utc,
  (SELECT n FROM blocking_outreach) AS blocking_outreach_queue_rows,
  (SELECT n FROM steps_with_queue) AS sequence_steps_with_outreach_queue_id,
  (SELECT n FROM scheduler_blocked_steps) AS active_scheduler_blocked_steps,
  (SELECT n FROM stall_enrollments) AS enrollments_at_risk_of_stall,
  (SELECT n FROM enabled_routes) AS enabled_delivery_routes,
  (SELECT n FROM connected_mailboxes) AS connected_mailbox_connections,
  (SELECT n FROM approved_due_jobs) AS approved_due_sequence_execution_jobs,
  CASE
    WHEN (SELECT n FROM blocking_outreach) = 0
     AND (SELECT n FROM scheduler_blocked_steps) = 0
     AND (SELECT n FROM enabled_routes) > 0
     AND (SELECT n FROM connected_mailboxes) > 0
    THEN 'LIKELY_READY_FOR_MODE_FLIP'
    ELSE 'NOT_READY — resolve blockers in sections 3–6 and verify 8–10'
  END AS cutover_gate_hint;

-- -----------------------------------------------------------------------------
-- 1) email_provider_connections by provider_family / status
-- -----------------------------------------------------------------------------
SELECT
  provider_family,
  status,
  COUNT(*) AS connection_count
FROM growth.email_provider_connections
GROUP BY provider_family, status
ORDER BY provider_family, status;

SELECT
  id,
  provider,
  provider_family,
  label,
  status,
  last_webhook_at,
  last_error,
  created_at,
  updated_at
FROM growth.email_provider_connections
WHERE provider_family IN ('lemlist', 'smartlead', 'instantly', 'emailbison', 'custom')
ORDER BY provider_family, created_at DESC;

-- -----------------------------------------------------------------------------
-- 2) communication_settings.active_email_connection_id
-- -----------------------------------------------------------------------------
SELECT
  cs.id AS settings_id,
  cs.active_email_connection_id,
  cs.updated_at AS settings_updated_at,
  epc.provider_family,
  epc.provider,
  epc.label,
  epc.status AS connection_status
FROM growth.communication_settings cs
LEFT JOIN growth.email_provider_connections epc
  ON epc.id = cs.active_email_connection_id
WHERE cs.singleton = true;

-- -----------------------------------------------------------------------------
-- 3) outreach_queue by status / channel
-- -----------------------------------------------------------------------------
SELECT
  status,
  channel,
  COUNT(*) AS item_count
FROM growth.outreach_queue
GROUP BY status, channel
ORDER BY status, channel;

SELECT
  status,
  COUNT(*) AS item_count
FROM growth.outreach_queue
GROUP BY status
ORDER BY status;

-- -----------------------------------------------------------------------------
-- 4) Blocking outreach_queue rows (adapter execution plane)
--     Blocking = pending_approval | approved | scheduled
-- -----------------------------------------------------------------------------
SELECT
  id,
  lead_id,
  channel,
  status,
  priority,
  scheduled_for,
  provider_connection_id,
  sequence_enrollment_step_id,
  generation_id,
  retry_count,
  failure_class,
  dead_letter_at,
  processing_started_at,
  delivery_attempt_id,
  created_at,
  approved_at,
  executed_at
FROM growth.outreach_queue
WHERE status IN ('pending_approval', 'approved', 'scheduled')
ORDER BY
  CASE status
    WHEN 'pending_approval' THEN 1
    WHEN 'approved' THEN 2
    WHEN 'scheduled' THEN 3
    ELSE 4
  END,
  scheduled_for NULLS LAST,
  created_at;

-- Failed / dead-letter (recovery backlog — not blocking cutover by default)
SELECT
  id,
  lead_id,
  channel,
  status,
  failure_reason,
  retry_count,
  dead_letter_at,
  failed_at,
  delivery_attempt_id,
  updated_at
FROM growth.outreach_queue
WHERE status IN ('failed', 'dead_letter')
ORDER BY COALESCE(dead_letter_at, failed_at, updated_at) DESC;

-- Stuck approved + processing (ops dashboard signal)
SELECT
  id,
  lead_id,
  status,
  processing_started_at,
  approved_at,
  updated_at
FROM growth.outreach_queue
WHERE status = 'approved'
  AND processing_started_at IS NOT NULL;

-- Overdue scheduled (eligible for growth-outreach-execute cron)
SELECT
  id,
  lead_id,
  status,
  scheduled_for,
  provider_connection_id,
  sequence_enrollment_step_id
FROM growth.outreach_queue
WHERE status = 'scheduled'
  AND scheduled_for <= NOW() - INTERVAL '30 minutes';

-- -----------------------------------------------------------------------------
-- 5) sequence_enrollment_steps with outreach_queue_id
-- -----------------------------------------------------------------------------
SELECT
  status,
  channel,
  COUNT(*) AS step_count
FROM growth.sequence_enrollment_steps
WHERE outreach_queue_id IS NOT NULL
GROUP BY status, channel
ORDER BY status, channel;

SELECT
  ses.id AS step_id,
  ses.enrollment_id,
  ses.lead_id,
  ses.step_order,
  ses.channel,
  ses.status AS step_status,
  ses.outreach_queue_id,
  ses.generation_id,
  ses.scheduled_for,
  ses.completed_at,
  oq.status AS queue_status,
  oq.channel AS queue_channel,
  oq.provider_connection_id,
  oq.scheduled_for AS queue_scheduled_for
FROM growth.sequence_enrollment_steps ses
LEFT JOIN growth.outreach_queue oq ON oq.id = ses.outreach_queue_id
WHERE ses.outreach_queue_id IS NOT NULL
ORDER BY ses.updated_at DESC;

-- Scheduler-hard-blocked: active enrollment + outreach_queue_id + pending/draft_created
-- (matches listDueSequenceSchedulerSteps / isSequenceStepDueForScheduler)
SELECT
  ses.id AS step_id,
  ses.enrollment_id,
  ses.lead_id,
  ses.step_order,
  ses.channel,
  ses.status AS step_status,
  ses.outreach_queue_id,
  ses.scheduled_for,
  se.status AS enrollment_status,
  se.current_step_order
FROM growth.sequence_enrollment_steps ses
JOIN growth.sequence_enrollments se ON se.id = ses.enrollment_id
WHERE se.status = 'active'
  AND ses.outreach_queue_id IS NOT NULL
  AND ses.status IN ('pending', 'draft_created')
ORDER BY ses.scheduled_for NULLS LAST, ses.step_order;

-- Email steps stuck in adapter "queued" status (not picked by standalone scheduler)
SELECT
  ses.id AS step_id,
  ses.enrollment_id,
  ses.lead_id,
  ses.step_order,
  ses.status,
  ses.outreach_queue_id,
  oq.status AS queue_status
FROM growth.sequence_enrollment_steps ses
LEFT JOIN growth.outreach_queue oq ON oq.id = ses.outreach_queue_id
WHERE ses.channel = 'email'
  AND ses.status = 'queued'
ORDER BY ses.updated_at DESC;

-- -----------------------------------------------------------------------------
-- 6) Active enrollments that would stall after standalone cutover
-- -----------------------------------------------------------------------------
SELECT
  se.id AS enrollment_id,
  se.lead_id,
  se.status AS enrollment_status,
  se.current_step_order,
  se.pause_reason,
  se.sequence_pattern_id,
  COUNT(ses.id) FILTER (WHERE ses.outreach_queue_id IS NOT NULL) AS steps_with_outreach_queue_id,
  COUNT(ses.id) FILTER (
    WHERE ses.status = 'queued' AND ses.channel = 'email'
  ) AS email_steps_status_queued,
  COUNT(ses.id) FILTER (
    WHERE se.status = 'active'
      AND ses.status IN ('pending', 'draft_created')
      AND ses.outreach_queue_id IS NOT NULL
  ) AS scheduler_blocked_step_count,
  MAX(ses.updated_at) AS last_step_activity
FROM growth.sequence_enrollments se
JOIN growth.sequence_enrollment_steps ses ON ses.enrollment_id = se.id
WHERE se.status IN ('active', 'paused')
GROUP BY
  se.id,
  se.lead_id,
  se.status,
  se.current_step_order,
  se.pause_reason,
  se.sequence_pattern_id
HAVING
  COUNT(ses.id) FILTER (WHERE ses.outreach_queue_id IS NOT NULL) > 0
  OR COUNT(ses.id) FILTER (WHERE ses.status = 'queued' AND ses.channel = 'email') > 0
ORDER BY scheduler_blocked_step_count DESC, email_steps_status_queued DESC, last_step_activity DESC;

-- Active enrollments with open sequence-linked outreach queue items
SELECT DISTINCT
  se.id AS enrollment_id,
  se.lead_id,
  se.status AS enrollment_status,
  oq.id AS outreach_queue_id,
  oq.status AS queue_status,
  oq.channel AS queue_channel,
  ses.id AS step_id,
  ses.step_order,
  ses.status AS step_status
FROM growth.sequence_enrollments se
JOIN growth.sequence_enrollment_steps ses ON ses.enrollment_id = se.id
JOIN growth.outreach_queue oq ON oq.id = ses.outreach_queue_id
WHERE se.status = 'active'
  AND oq.status IN ('pending_approval', 'approved', 'scheduled')
ORDER BY se.id, ses.step_order;

-- -----------------------------------------------------------------------------
-- 7) Adapter-plane delivery_attempts
-- -----------------------------------------------------------------------------
SELECT
  COALESCE(send_plane, '(null)') AS send_plane,
  status,
  COUNT(*) AS attempt_count
FROM growth.delivery_attempts
WHERE send_plane = 'adapter'
   OR provider_connection_id IS NOT NULL
   OR outreach_queue_id IS NOT NULL
GROUP BY send_plane, status
ORDER BY send_plane, status;

SELECT
  id,
  status,
  send_plane,
  provider_connection_id,
  outreach_queue_id,
  sender_account_id,
  provider_id,
  failure_class,
  created_at,
  sent_at
FROM growth.delivery_attempts
WHERE created_at > NOW() - INTERVAL '7 days'
  AND (
    send_plane = 'adapter'
    OR provider_connection_id IS NOT NULL
    OR outreach_queue_id IS NOT NULL
  )
ORDER BY created_at DESC
LIMIT 200;

-- -----------------------------------------------------------------------------
-- 8) Native sender_accounts
-- -----------------------------------------------------------------------------
SELECT
  provider_family,
  status,
  health_status,
  COUNT(*) AS account_count
FROM growth.sender_accounts
WHERE deleted_at IS NULL
GROUP BY provider_family, status, health_status
ORDER BY provider_family, status, health_status;

SELECT
  id,
  provider_family,
  email_address,
  display_name,
  status,
  health_status,
  daily_send_limit,
  daily_send_used,
  warmup_enabled,
  warmup_eligible,
  last_send_at,
  last_health_check,
  created_at
FROM growth.sender_accounts
WHERE deleted_at IS NULL
ORDER BY status, email_address;

-- -----------------------------------------------------------------------------
-- 9) mailbox_connections
-- -----------------------------------------------------------------------------
SELECT
  provider_family,
  status,
  COUNT(*) AS connection_count
FROM growth.mailbox_connections
WHERE deleted_at IS NULL
GROUP BY provider_family, status
ORDER BY provider_family, status;

SELECT
  mc.id,
  mc.sender_account_id,
  mc.provider_family,
  mc.status,
  mc.email_address,
  mc.display_name,
  mc.connection_health,
  mc.health_reason,
  mc.token_expires_at,
  mc.last_validation_at,
  mc.validation_failure_count,
  sa.status AS sender_account_status,
  sa.email_address AS sender_email
FROM growth.mailbox_connections mc
LEFT JOIN growth.sender_accounts sa ON sa.id = mc.sender_account_id AND sa.deleted_at IS NULL
WHERE mc.deleted_at IS NULL
ORDER BY mc.status, mc.provider_family, mc.email_address;

-- -----------------------------------------------------------------------------
-- 10) delivery_routes (native transport routing)
-- -----------------------------------------------------------------------------
SELECT
  dr.enabled,
  COUNT(*) AS route_count
FROM growth.delivery_routes dr
GROUP BY dr.enabled;

SELECT
  dr.id,
  dr.enabled,
  dr.priority,
  dr.daily_cap,
  dr.current_volume,
  dr.health_weight,
  dr.sender_account_id,
  sa.email_address AS sender_email,
  sa.status AS sender_status,
  dr.provider_id,
  dp.provider_family,
  dp.label AS provider_label
FROM growth.delivery_routes dr
JOIN growth.sender_accounts sa ON sa.id = dr.sender_account_id AND sa.deleted_at IS NULL
LEFT JOIN growth.delivery_providers dp ON dp.id = dr.provider_id
ORDER BY dr.enabled DESC, dr.priority ASC, sa.email_address;

-- -----------------------------------------------------------------------------
-- 11) Approved due sequence_execution_jobs (growth-sequence-safe-execute cron)
--     Matches listApprovedDueSequenceExecutionJobs: status=approved, scheduled_for<=now
-- -----------------------------------------------------------------------------
SELECT
  status,
  COUNT(*) AS job_count
FROM growth.sequence_execution_jobs
GROUP BY status
ORDER BY status;

SELECT
  COUNT(*) AS approved_due_job_count
FROM growth.sequence_execution_jobs
WHERE status = 'approved'
  AND scheduled_for <= NOW();

SELECT
  j.id,
  j.sequence_enrollment_id,
  j.sequence_step_id,
  j.lead_id,
  j.status,
  j.channel,
  j.scheduled_for,
  j.sender_account_id,
  j.provider_id,
  j.requires_human_approval,
  j.human_approved_at,
  j.human_approved_by,
  j.locked_at,
  j.locked_by,
  j.attempt_count,
  j.last_error,
  j.delivery_attempt_id,
  j.created_at
FROM growth.sequence_execution_jobs j
WHERE j.status = 'approved'
  AND j.scheduled_for <= NOW()
ORDER BY j.scheduled_for ASC, j.created_at ASC;

-- Pending approval backlog (native plane — post-cutover operator queue)
SELECT
  j.id,
  j.sequence_enrollment_id,
  j.sequence_step_id,
  j.lead_id,
  j.channel,
  j.status,
  j.scheduled_for,
  j.created_at
FROM growth.sequence_execution_jobs j
WHERE j.status IN ('pending_approval', 'draft')
ORDER BY j.created_at DESC
LIMIT 200;

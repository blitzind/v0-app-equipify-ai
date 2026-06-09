import type { GrowthReplyFlowInspectSnapshot } from "@/lib/growth/qa/reply-flow-report"

export const EXECUTION_3_QA_MARKER = "execution-3-controlled-transport-cert-v1" as const
export const EXECUTION_3_COMPANY_PREFIX = "Execution-3 Transport Cert" as const

export const HENRY_SCHEIN_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56" as const
export const HENRY_SCHEIN_JOB_ID = "4d765ebd-c635-471c-8231-b0eb10b6a555" as const

export type Execution3CertResult = "PASS" | "PASS_PARTIAL" | "FAIL"

export type Execution3DuplicateExecuteEvidence = {
  first_run: Record<string, unknown>
  second_run: Record<string, unknown>
  idempotent: boolean
  batch_rerun: Record<string, unknown>
  sent_delivery_attempt_count: number
}

export type Execution3RollbackEvidence = {
  henry_schein_job_untouched: boolean
  henry_schein_job_status: string | null
  henry_schein_delivery_attempt_id: string | null
  audit_events_present: boolean
  transport_audit_events: number
  job_audit_events: number
}

export type Execution3ControlledTransportEvidence = {
  qa_marker: typeof EXECUTION_3_QA_MARKER
  result: Execution3CertResult
  generated_at: string
  transport: {
    provider: string | null
    provider_family: string | null
    message_id: string | null
    delivery_id: string | null
    thread_id: string | null
    execution_job_id: string | null
    simulated: boolean
  }
  inbox: {
    thread_created: boolean
    thread_ids: string[]
    outbound_message_visible: boolean
    outbound_message_count: number
    tracking_initialized: boolean
    tracking_disabled: boolean
  }
  safety: {
    exactly_one_send: boolean
    no_duplicate_execution: boolean
    no_retry_loop: boolean
    duplicate_execute_idempotent: boolean
  }
  duplicate_execute: Execution3DuplicateExecuteEvidence
  rollback: Execution3RollbackEvidence
  ids: {
    lead_id: string | null
    enrollment_id: string | null
    enrollment_step_id: string | null
    generation_id: string | null
    execution_job_id: string | null
    delivery_attempt_id: string | null
    contact_email: string | null
  }
  diagnostics: string[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function recordString(row: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!row) return ""
  for (const key of keys) {
    const value = asString(row[key])
    if (value) return value
  }
  return ""
}

function isSimulatedMessageId(messageId: string | null): boolean {
  return Boolean(messageId && messageId.startsWith("sim-"))
}

export function buildExecution3ControlledTransportEvidence(input: {
  snapshot: GrowthReplyFlowInspectSnapshot
  duplicateExecute: Execution3DuplicateExecuteEvidence
  henryScheinJob: Record<string, unknown> | null
  inboxThreadIds: string[]
  trackingDisabled?: boolean
}): Execution3ControlledTransportEvidence {
  const { snapshot, duplicateExecute, henryScheinJob, inboxThreadIds } = input
  const trackingDisabled = input.trackingDisabled === true

  const stepOne =
    snapshot.steps.find((step) => Number(step.step_order) === 1) ?? snapshot.steps[0] ?? null
  const job =
    snapshot.jobs.find((row) => asString(row.sequence_step_id) === asString(stepOne?.id)) ??
    snapshot.jobs[0] ??
    null
  const attempt =
    snapshot.deliveryAttempts.find((row) => asString(row.id) === asString(job?.delivery_attempt_id)) ??
    snapshot.deliveryAttempts[0] ??
    null

  const metadata = asRecord(attempt?.metadata)
  const trackingMetadata = asRecord(metadata.tracking)
  const messageId = asString(attempt?.provider_message_id) || asString(metadata.provider_message_id) || null
  const threadId = asString(metadata.provider_thread_id) || inboxThreadIds[0] || null
  const simulated = isSimulatedMessageId(messageId)

  const sentAttempts = snapshot.deliveryAttempts.filter((row) => asString(row.status) === "sent")
  const exactlyOneSend = sentAttempts.length === 1
  const noDuplicateExecution = duplicateExecute.sent_delivery_attempt_count <= 1
  const noRetryLoop =
    duplicateExecute.second_run.message === "already_sent" &&
    Number(asRecord(duplicateExecute.batch_rerun).sent ?? 0) === 0

  const outboundMessages = snapshot.inboxMessages.filter((row) => asString(row.direction) === "outbound")
  const threadCreated = inboxThreadIds.length > 0
  const outboundVisible = outboundMessages.length > 0
  const trackingInitialized =
    trackingDisabled || Boolean(trackingMetadata.pixel_url || trackingMetadata.tracking_token || trackingMetadata.links)

  const transportSent = asString(attempt?.status) === "sent"
  const hasRealMessageId = Boolean(messageId && !simulated)
  const jobSent = asString(job?.status) === "sent"
  const auditEventsPresent =
    snapshot.jobEvents.some((event) => ["job_sent", "job_approved", "solo_approval_used"].includes(asString(event.event_type))) ||
    snapshot.transportEvents.length > 0

  const henryUntouched =
    !henryScheinJob ||
    (asString(henryScheinJob.status) === "approved" && !asString(henryScheinJob.delivery_attempt_id))

  const diagnostics: string[] = []
  if (simulated) diagnostics.push("Transport used simulated provider_message_id (sim-*).")
  if (!threadCreated && transportSent) diagnostics.push("No inbox_threads row for lead after send (may need inbox sync).")
  if (!outboundVisible && transportSent) diagnostics.push("No outbound inbox_messages visible for lead.")
  if (!trackingInitialized && transportSent && !trackingDisabled) {
    diagnostics.push("Delivery attempt metadata.tracking missing despite tracking enabled.")
  }
  if (!henryUntouched) diagnostics.push("Henry Schein execution job was modified during cert run.")

  const transportPass = transportSent && hasRealMessageId && jobSent
  const inboxPass = threadCreated && outboundVisible && trackingInitialized
  const safetyPass =
    exactlyOneSend &&
    noDuplicateExecution &&
    duplicateExecute.idempotent &&
    noRetryLoop &&
    henryUntouched

  let result: Execution3CertResult = "FAIL"
  if (transportPass && inboxPass && safetyPass && auditEventsPresent) {
    result = "PASS"
  } else if (transportPass && safetyPass && auditEventsPresent) {
    result = "PASS_PARTIAL"
  }

  return {
    qa_marker: EXECUTION_3_QA_MARKER,
    result,
    generated_at: new Date().toISOString(),
    transport: {
      provider: asString(snapshot.provider?.provider_name) || null,
      provider_family: asString(snapshot.provider?.provider_family) || null,
      message_id: messageId,
      delivery_id: asString(attempt?.id) || null,
      thread_id: threadId,
      execution_job_id: asString(job?.id) || null,
      simulated,
    },
    inbox: {
      thread_created: threadCreated,
      thread_ids: inboxThreadIds,
      outbound_message_visible: outboundVisible,
      outbound_message_count: outboundMessages.length,
      tracking_initialized: trackingInitialized,
      tracking_disabled: trackingDisabled,
    },
    safety: {
      exactly_one_send: exactlyOneSend,
      no_duplicate_execution: noDuplicateExecution,
      no_retry_loop: noRetryLoop,
      duplicate_execute_idempotent: duplicateExecute.idempotent,
    },
    duplicate_execute: duplicateExecute,
    rollback: {
      henry_schein_job_untouched: henryUntouched,
      henry_schein_job_status: henryScheinJob ? asString(henryScheinJob.status) : null,
      henry_schein_delivery_attempt_id: henryScheinJob ? asString(henryScheinJob.delivery_attempt_id) : null,
      audit_events_present: auditEventsPresent,
      transport_audit_events: snapshot.transportEvents.length,
      job_audit_events: snapshot.jobEvents.length,
    },
    ids: {
      lead_id: recordString(snapshot.lead, "id") || null,
      enrollment_id: asString(snapshot.enrollment?.id) || null,
      enrollment_step_id: asString(stepOne?.id) || null,
      generation_id: asString(stepOne?.generation_id) || null,
      execution_job_id: asString(job?.id) || null,
      delivery_attempt_id: asString(attempt?.id) || null,
      contact_email: recordString(snapshot.lead, "contact_email", "contactEmail") || null,
    },
    diagnostics,
  }
}

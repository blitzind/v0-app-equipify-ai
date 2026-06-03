/** Pure report builders for Growth Engine reply-flow QA (no server deps). */

import {
  GROWTH_REPLY_FLOW_CHECK_LABELS,
  GROWTH_REPLY_FLOW_QA_MARKER,
  type GrowthReplyFlowCheckLabel,
  type GrowthReplyFlowCheckResult,
  type GrowthReplyFlowFkIssue,
  type GrowthReplyFlowHarnessReport,
} from "@/lib/growth/qa/reply-flow-harness-types"

export type GrowthReplyFlowInspectSnapshot = {
  lead: Record<string, unknown> | null
  enrollment: Record<string, unknown> | null
  steps: Record<string, unknown>[]
  jobs: Record<string, unknown>[]
  jobEvents: Record<string, unknown>[]
  deliveryAttempts: Record<string, unknown>[]
  transportEvents: Record<string, unknown>[]
  sender: Record<string, unknown> | null
  provider: Record<string, unknown> | null
  mailbox: Record<string, unknown> | null
  timelineEvents: Record<string, unknown>[]
  inboxMessages: Record<string, unknown>[]
  replyIngestionEvents: Record<string, unknown>[]
  inboxSyncRuns: Record<string, unknown>[]
  leadMemory: {
    profile?: { id?: string; updatedAt?: string } | null
    relationshipContext?: unknown | null
    events?: unknown[]
  } | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function recordString(record: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!record) return ""
  for (const key of keys) {
    const value = asString(record[key])
    if (value) return value
  }
  return ""
}

function buildFkIssues(snapshot: GrowthReplyFlowInspectSnapshot): GrowthReplyFlowFkIssue[] {
  const issues: GrowthReplyFlowFkIssue[] = []
  const leadId = recordString(snapshot.lead, "id")
  const enrollmentId = asString(snapshot.enrollment?.id)

  for (const job of snapshot.jobs) {
    if (leadId && asString(job.lead_id) && asString(job.lead_id) !== leadId) {
      issues.push({
        code: "job_lead_mismatch",
        message: "Execution job lead_id does not match inspected lead.",
        expected: leadId,
        actual: asString(job.lead_id),
      })
    }
    if (enrollmentId && asString(job.sequence_enrollment_id) && asString(job.sequence_enrollment_id) !== enrollmentId) {
      issues.push({
        code: "job_enrollment_mismatch",
        message: "Execution job enrollment id does not match active enrollment.",
        expected: enrollmentId,
        actual: asString(job.sequence_enrollment_id),
      })
    }
    const stepId = asString(job.sequence_step_id)
    if (stepId && !snapshot.steps.some((step) => asString(step.id) === stepId)) {
      issues.push({
        code: "job_step_missing",
        message: "Execution job references a sequence step that is missing for this lead.",
        expected: stepId,
        actual: null,
      })
    }
    const attemptId = asString(job.delivery_attempt_id)
    if (attemptId && !snapshot.deliveryAttempts.some((attempt) => asString(attempt.id) === attemptId)) {
      issues.push({
        code: "job_delivery_attempt_missing",
        message: "Execution job delivery_attempt_id not found in delivery_attempts.",
        expected: attemptId,
        actual: null,
      })
    }
  }

  for (const attempt of snapshot.deliveryAttempts) {
    const attemptLeadId = asString(attempt.lead_id)
    if (leadId && attemptLeadId && attemptLeadId !== leadId) {
      issues.push({
        code: "attempt_lead_mismatch",
        message: "Delivery attempt lead_id does not match inspected lead.",
        expected: leadId,
        actual: attemptLeadId,
      })
    }
  }

  const senderAccountId = asString(snapshot.sender?.id)
  const mailboxSenderId = asString(snapshot.mailbox?.sender_account_id)
  if (senderAccountId && mailboxSenderId && senderAccountId !== mailboxSenderId) {
    issues.push({
      code: "mailbox_sender_mismatch",
      message: "Mailbox connection sender_account_id does not match job sender account.",
      expected: senderAccountId,
      actual: mailboxSenderId,
    })
  }

  return issues
}

function isSimulatedAttempt(attempt: Record<string, unknown> | null): boolean {
  if (!attempt) return false
  const metadata = asRecord(attempt.metadata)
  if (metadata.simulated === true) return true
  const messageId = asString(attempt.provider_message_id)
  return messageId.startsWith("sim-")
}

function buildChecks(
  snapshot: GrowthReplyFlowInspectSnapshot,
  options: { requireReply: boolean },
): GrowthReplyFlowCheckResult[] {
  const stepOne = snapshot.steps.find((step) => Number(step.step_order) === 1) ?? snapshot.steps[0] ?? null
  const job =
    snapshot.jobs.find((row) => asString(row.sequence_step_id) === asString(stepOne?.id)) ?? snapshot.jobs[0] ?? null
  const attempt =
    snapshot.deliveryAttempts.find((row) => asString(row.id) === asString(job?.delivery_attempt_id)) ??
    snapshot.deliveryAttempts[0] ??
    null

  const metadata = asRecord(attempt?.metadata)
  const gmailMessageId = asString(attempt?.provider_message_id) || asString(metadata.provider_message_id) || null
  const simulated = isSimulatedAttempt(attempt)
  const transportSent = asString(attempt?.status) === "sent"
  const hasRealGmailId = Boolean(gmailMessageId && !gmailMessageId.startsWith("sim-"))

  const inboundReply =
    snapshot.inboxMessages.some((row) => asString(row.direction) === "inbound") ||
    snapshot.replyIngestionEvents.some((row) => ["processed", "received"].includes(asString(row.status)))

  const inboxSyncProcessed = snapshot.inboxSyncRuns.some((row) => asString(row.status) === "completed")

  const memoryUpdated = Boolean(
    snapshot.leadMemory?.profile?.updatedAt ||
      (snapshot.leadMemory?.events?.length ?? 0) > 0 ||
      snapshot.leadMemory?.relationshipContext,
  )

  const approvalCreated =
    snapshot.jobEvents.some((event) =>
      ["solo_approval_used", "job_approved"].includes(asString(event.event_type)),
    ) || Boolean(job?.human_approved_at)

  const checkMap: Record<GrowthReplyFlowCheckLabel, GrowthReplyFlowCheckResult> = {
    "Lead Created": {
      label: "Lead Created",
      pass: Boolean(recordString(snapshot.lead, "id")),
      detail: recordString(snapshot.lead, "id")
        ? `lead_id=${recordString(snapshot.lead, "id")}`
        : "missing growth.leads row",
    },
    "Enrollment Created": {
      label: "Enrollment Created",
      pass: Boolean(snapshot.enrollment?.id),
      detail: snapshot.enrollment?.id
        ? `enrollment_id=${asString(snapshot.enrollment.id)} status=${asString(snapshot.enrollment.status)}`
        : "missing sequence_enrollments row",
    },
    "Step Created": {
      label: "Step Created",
      pass: Boolean(stepOne?.id),
      detail: stepOne?.id
        ? `step_id=${asString(stepOne.id)} order=${String(stepOne.step_order)} channel=${asString(stepOne.channel)} status=${asString(stepOne.status)}`
        : "missing sequence_enrollment_steps row",
    },
    "Approval Created": {
      label: "Approval Created",
      pass: approvalCreated,
      detail: approvalCreated
        ? `job_id=${asString(job?.id)} approved_at=${asString(job?.human_approved_at) || "event"}`
        : "no solo_approval_used / job_approved audit event",
    },
    "Execution Job Created": {
      label: "Execution Job Created",
      pass: Boolean(job?.id),
      detail: job?.id ? `job_id=${asString(job.id)} status=${asString(job.status)}` : "missing sequence_execution_jobs row",
    },
    "Delivery Attempt Created": {
      label: "Delivery Attempt Created",
      pass: Boolean(attempt?.id),
      detail: attempt?.id
        ? `delivery_attempt_id=${asString(attempt.id)} status=${asString(attempt.status)}`
        : "missing delivery_attempts row",
    },
    "Transport Sent": {
      label: "Transport Sent",
      pass: transportSent,
      detail: transportSent
        ? `delivery_attempt status=sent simulated=${simulated}`
        : `delivery status=${asString(attempt?.status) || "missing"}`,
    },
    "Gmail Message ID Present": {
      label: "Gmail Message ID Present",
      pass: hasRealGmailId,
      detail: gmailMessageId
        ? simulated
          ? `simulated provider_message_id=${gmailMessageId}`
          : `provider_message_id=${gmailMessageId}`
        : "provider_message_id missing on delivery attempt",
    },
    "Reply Received": {
      label: "Reply Received",
      pass: options.requireReply ? inboundReply : true,
      detail: inboundReply
        ? `inbox_messages=${snapshot.inboxMessages.length} reply_ingestion_events=${snapshot.replyIngestionEvents.length}`
        : options.requireReply
          ? "no inbound inbox_messages or processed reply_ingestion_events"
          : "not required for outbound-only harness run",
    },
    "Inbox Sync Processed": {
      label: "Inbox Sync Processed",
      pass: inboxSyncProcessed || snapshot.inboxSyncRuns.length === 0,
      detail:
        snapshot.inboxSyncRuns.length === 0
          ? "no inbox_sync_runs for mailbox (skipped)"
          : inboxSyncProcessed
            ? `latest_status=${asString(snapshot.inboxSyncRuns[0]?.status)}`
            : `latest_status=${asString(snapshot.inboxSyncRuns[0]?.status) || "missing"}`,
    },
    "Relationship Memory Updated": {
      label: "Relationship Memory Updated",
      pass: memoryUpdated,
      detail: memoryUpdated
        ? `profile=${snapshot.leadMemory?.profile?.id ?? "context"} events=${snapshot.leadMemory?.events?.length ?? 0}`
        : "no lead_memory_profiles / events for lead",
    },
  }

  return GROWTH_REPLY_FLOW_CHECK_LABELS.map((label) => checkMap[label])
}

export function buildGrowthReplyFlowReport(
  snapshot: GrowthReplyFlowInspectSnapshot,
  input?: { requireReply?: boolean; actions?: Record<string, unknown> },
): GrowthReplyFlowHarnessReport {
  const requireReply = input?.requireReply === true
  const checks = buildChecks(snapshot, { requireReply })
  const overall = checks.every((check) => check.pass) ? "PASS" : "FAIL"

  const stepOne = snapshot.steps.find((step) => Number(step.step_order) === 1) ?? snapshot.steps[0] ?? null
  const job =
    snapshot.jobs.find((row) => asString(row.sequence_step_id) === asString(stepOne?.id)) ?? snapshot.jobs[0] ?? null
  const attempt =
    snapshot.deliveryAttempts.find((row) => asString(row.id) === asString(job?.delivery_attempt_id)) ??
    snapshot.deliveryAttempts[0] ??
    null
  const metadata = asRecord(attempt?.metadata)
  const fkIssues = buildFkIssues(snapshot)
  const leadContactEmail = recordString(snapshot.lead, "contact_email", "contactEmail")

  const missingRecords: string[] = []
  if (!snapshot.lead) missingRecords.push("growth.leads")
  if (!snapshot.enrollment) missingRecords.push("growth.sequence_enrollments")
  if (snapshot.steps.length === 0) missingRecords.push("growth.sequence_enrollment_steps")
  if (snapshot.jobs.length === 0) missingRecords.push("growth.sequence_execution_jobs")
  if (snapshot.deliveryAttempts.length === 0) missingRecords.push("growth.delivery_attempts")
  if (!snapshot.sender) missingRecords.push("growth.sender_accounts")
  if (!snapshot.mailbox) missingRecords.push("growth.mailbox_connections")

  const diagnostics: string[] = []
  if (leadContactEmail !== asString(metadata.to) && asString(metadata.to)) {
    diagnostics.push(
      `Recipient mismatch: lead.contact_email=${leadContactEmail || "null"} delivery.metadata.to=${asString(metadata.to)}`,
    )
  }
  if (isSimulatedAttempt(attempt)) diagnostics.push("Transport ran in simulated mode (sim-* provider_message_id).")
  if (asString(job?.last_error)) diagnostics.push(`Job last_error=${asString(job?.last_error)}`)
  if (asString(attempt?.failure_reason)) diagnostics.push(`Delivery failure_reason=${asString(attempt?.failure_reason)}`)
  for (const issue of fkIssues) diagnostics.push(`${issue.code}: ${issue.message}`)

  return {
    qaMarker: GROWTH_REPLY_FLOW_QA_MARKER,
    overall,
    generatedAt: new Date().toISOString(),
    checks,
    ids: {
      leadId: recordString(snapshot.lead, "id") || null,
      enrollmentId: asString(snapshot.enrollment?.id) || null,
      enrollmentStepId: asString(stepOne?.id) || null,
      executionJobId: asString(job?.id) || null,
      deliveryAttemptId: asString(attempt?.id) || null,
      senderAccountId: asString(snapshot.sender?.id) || null,
      mailboxConnectionId: asString(snapshot.mailbox?.id) || null,
      providerId: asString(snapshot.provider?.id) || null,
      sequencePatternId: asString(snapshot.enrollment?.sequence_pattern_id) || null,
    },
    statuses: {
      leadStatus: recordString(snapshot.lead, "status") || null,
      enrollmentStatus: asString(snapshot.enrollment?.status) || null,
      step1Status: asString(stepOne?.status) || null,
      step1Channel: asString(stepOne?.channel) || null,
      jobStatus: asString(job?.status) || null,
      deliveryAttemptStatus: asString(attempt?.status) || null,
      mailboxConnectionStatus: asString(snapshot.mailbox?.status) || null,
      senderAccountStatus: recordString(snapshot.sender, "status") || null,
    },
    transport: {
      recipientEmail: asString(metadata.to) || null,
      leadContactEmail: leadContactEmail || null,
      gmailMessageId: asString(attempt?.provider_message_id) || asString(metadata.provider_message_id) || null,
      gmailThreadId: asString(metadata.provider_thread_id) || null,
      rfcMessageId: asString(metadata.rfc_message_id) || null,
      simulated: attempt ? isSimulatedAttempt(attempt) : null,
      senderEmail: recordString(snapshot.sender, "email_address", "emailAddress") || null,
      providerFamily: asString(snapshot.provider?.provider_family) || null,
      providerName: asString(snapshot.provider?.provider_name) || null,
    },
    counts: {
      timelineEvents: snapshot.timelineEvents.length,
      jobEvents: snapshot.jobEvents.length,
      transportAuditEvents: snapshot.transportEvents.length,
      inboxMessages: snapshot.inboxMessages.length,
      replyIngestionEvents: snapshot.replyIngestionEvents.length,
      leadMemoryEvents: snapshot.leadMemory?.events?.length ?? 0,
      inboxSyncRuns: snapshot.inboxSyncRuns.length,
    },
    missingRecords,
    fkIssues,
    diagnostics,
    actions: input?.actions ?? {},
  }
}

export function formatGrowthReplyFlowReport(report: GrowthReplyFlowHarnessReport): string {
  const lines: string[] = []
  lines.push("═".repeat(56))
  lines.push(` GROWTH REPLY FLOW QA — ${report.overall}`)
  lines.push("═".repeat(56))
  lines.push("")

  for (const check of report.checks) {
    const status = check.pass ? "PASS" : "FAIL"
    const padded = `${check.label}`.padEnd(28, ".")
    lines.push(`${padded} ${status}`)
    if (!check.pass || check.detail.includes("=")) {
      lines.push(`  ${check.detail}`)
    }
  }

  lines.push("")
  lines.push("IDs")
  for (const [key, value] of Object.entries(report.ids)) {
    lines.push(`  ${key}: ${value ?? "—"}`)
  }

  lines.push("")
  lines.push("Statuses")
  for (const [key, value] of Object.entries(report.statuses)) {
    lines.push(`  ${key}: ${value ?? "—"}`)
  }

  lines.push("")
  lines.push("Transport")
  for (const [key, value] of Object.entries(report.transport)) {
    lines.push(`  ${key}: ${value ?? "—"}`)
  }

  if (report.missingRecords.length > 0) {
    lines.push("")
    lines.push("Missing records")
    for (const item of report.missingRecords) lines.push(`  - ${item}`)
  }

  if (report.fkIssues.length > 0) {
    lines.push("")
    lines.push("Foreign key / ownership mismatches")
    for (const issue of report.fkIssues) {
      lines.push(`  - ${issue.code}: ${issue.message}`)
      if (issue.expected || issue.actual) {
        lines.push(`    expected=${issue.expected ?? "—"} actual=${issue.actual ?? "—"}`)
      }
    }
  }

  if (report.diagnostics.length > 0) {
    lines.push("")
    lines.push("Diagnostics")
    for (const item of report.diagnostics) lines.push(`  - ${item}`)
  }

  if (Object.keys(report.actions).length > 0) {
    lines.push("")
    lines.push("Actions")
    lines.push(JSON.stringify(report.actions, null, 2))
  }

  lines.push("")
  lines.push(`qaMarker: ${report.qaMarker}`)
  lines.push(`generatedAt: ${report.generatedAt}`)
  return lines.join("\n")
}

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  automationAnalyticsSafetyPayload,
} from "@/lib/growth/automation/growth-automation-analytics-utils"
import type {
  GrowthAutomationAuditTimelineEntry,
  GrowthAutomationAuditTimelineSnapshot,
} from "@/lib/growth/automation/growth-automation-analytics-types"
import {
  loadAutomationAnalyticsContext,
  type AutomationAnalyticsContext,
} from "@/lib/growth/automation/growth-automation-analytics-service"
import { readAutomationExecutionMetadata } from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import { readRuntimeKillSwitch } from "@/lib/growth/automation/growth-automation-observability-utils"

function pushAuditEntry(
  entries: GrowthAutomationAuditTimelineEntry[],
  entry: GrowthAutomationAuditTimelineEntry,
): void {
  entries.push(entry)
}

function buildRuntimeLifecycleAuditEntries(context: AutomationAnalyticsContext): GrowthAutomationAuditTimelineEntry[] {
  const entries: GrowthAutomationAuditTimelineEntry[] = []
  const metadata = context.metadata
  if (!metadata) return entries

  for (const publish of metadata.publishHistory ?? []) {
    pushAuditEntry(entries, {
      timestamp: publish.publishedAt,
      eventType: "runtime_published",
      flowId: context.flowId,
      enrollmentId: null,
      stepId: null,
      actorId: null,
      summary: `Runtime artifacts published · pattern ${publish.patternId}`,
      metadata: {
        versionId: publish.versionId,
        artifactVersion: publish.artifactVersion,
      },
    })
  }

  if (metadata.lastActivatedAt) {
    pushAuditEntry(entries, {
      timestamp: metadata.lastActivatedAt,
      eventType: "runtime_activated",
      flowId: context.flowId,
      enrollmentId: null,
      stepId: null,
      actorId: null,
      summary: "Runtime pattern activated.",
      metadata: {
        activationStatus: metadata.activationStatus,
        compiledPatternId: metadata.compiledPatternId,
      },
    })
  }

  if (metadata.lastPausedAt) {
    pushAuditEntry(entries, {
      timestamp: metadata.lastPausedAt,
      eventType: "runtime_paused",
      flowId: context.flowId,
      enrollmentId: null,
      stepId: null,
      actorId: null,
      summary: "Runtime pattern paused.",
      metadata: { activationStatus: metadata.activationStatus },
    })
  }

  if (
    metadata.lastActivatedAt &&
    metadata.lastPausedAt &&
    Date.parse(metadata.lastActivatedAt) > Date.parse(metadata.lastPausedAt)
  ) {
    pushAuditEntry(entries, {
      timestamp: metadata.lastActivatedAt,
      eventType: "runtime_resumed",
      flowId: context.flowId,
      enrollmentId: null,
      stepId: null,
      actorId: null,
      summary: "Runtime resumed after pause.",
      metadata: { activationStatus: metadata.activationStatus },
    })
  }

  const killSwitch = readRuntimeKillSwitch(metadata)
  if (killSwitch.enabled && killSwitch.enabledAt) {
    pushAuditEntry(entries, {
      timestamp: killSwitch.enabledAt,
      eventType: "kill_switch_enabled",
      flowId: context.flowId,
      enrollmentId: null,
      stepId: null,
      actorId: killSwitch.enabledBy,
      summary: killSwitch.reason ?? "Kill switch enabled.",
      metadata: { killSwitch },
    })
  } else if (!killSwitch.enabled && killSwitch.enabledAt) {
    pushAuditEntry(entries, {
      timestamp: killSwitch.enabledAt,
      eventType: "kill_switch_disabled",
      flowId: context.flowId,
      enrollmentId: null,
      stepId: null,
      actorId: killSwitch.enabledBy,
      summary: "Kill switch disabled.",
      metadata: { killSwitch },
    })
  }

  return entries
}

function buildEnrollmentAuditEntries(context: AutomationAnalyticsContext): GrowthAutomationAuditTimelineEntry[] {
  const entries: GrowthAutomationAuditTimelineEntry[] = []

  for (const row of context.enrollmentRows) {
    const enrollmentId = String(row.id ?? "")
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    const executionMeta = readAutomationExecutionMetadata(metadata)
    const createdAt = String(row.created_at ?? new Date().toISOString())
    const updatedAt = String(row.updated_at ?? createdAt)
    const status = String(row.status ?? "draft")

    pushAuditEntry(entries, {
      timestamp: createdAt,
      eventType: "lead_enrolled",
      flowId: context.flowId,
      enrollmentId,
      stepId: null,
      actorId: typeof metadata.enrolled_by === "string" ? metadata.enrolled_by : null,
      summary: `Lead enrolled · trigger ${String(metadata.trigger_source ?? "unknown")}`,
      metadata: {
        leadId: String(row.lead_id ?? ""),
        entryReason: metadata.entry_reason ?? null,
      },
    })

    if (status === "cancelled") {
      pushAuditEntry(entries, {
        timestamp: updatedAt,
        eventType: "runtime_cancelled",
        flowId: context.flowId,
        enrollmentId,
        stepId: null,
        actorId: typeof executionMeta.cancelled_by === "string" ? String(executionMeta.cancelled_by) : null,
        summary: String(executionMeta.cancel_reason ?? "Enrollment cancelled."),
        metadata: { status },
      })
      pushAuditEntry(entries, {
        timestamp: updatedAt,
        eventType: "lead_unenrolled",
        flowId: context.flowId,
        enrollmentId,
        stepId: null,
        actorId: typeof executionMeta.cancelled_by === "string" ? String(executionMeta.cancelled_by) : null,
        summary: "Lead unenrolled from automation runtime.",
        metadata: { status },
      })
    }

    if (status === "completed") {
      pushAuditEntry(entries, {
        timestamp: updatedAt,
        eventType: "runtime_completed",
        flowId: context.flowId,
        enrollmentId,
        stepId: null,
        actorId: null,
        summary: "Enrollment completed.",
        metadata: { status },
      })
    }

    const currentStepOrder = Number(row.current_step_order ?? 0)
    if (currentStepOrder > 0 && updatedAt !== createdAt) {
      pushAuditEntry(entries, {
        timestamp: updatedAt,
        eventType: "step_advanced",
        flowId: context.flowId,
        enrollmentId,
        stepId: typeof executionMeta.current_step_id === "string" ? executionMeta.current_step_id : null,
        actorId: null,
        summary: `Step advanced to order ${currentStepOrder} · ${String(executionMeta.last_status ?? status)}`,
        metadata: {
          currentStepOrder,
          lastStatus: executionMeta.last_status ?? null,
        },
      })
    }
  }

  return entries
}

function buildWaitAuditEntries(context: AutomationAnalyticsContext): GrowthAutomationAuditTimelineEntry[] {
  const entries: GrowthAutomationAuditTimelineEntry[] = []

  for (const row of context.waitRows) {
    const enrollmentId = String(row.enrollment_id ?? "")
    const waitId = String(row.id ?? "")
    const stepId = String(row.enrollment_step_id ?? "")
    const startedAt = typeof row.started_at === "string" ? row.started_at : String(row.created_at ?? new Date().toISOString())
    const status = String(row.status ?? "")

    pushAuditEntry(entries, {
      timestamp: startedAt,
      eventType: "wait_started",
      flowId: context.flowId,
      enrollmentId,
      stepId,
      actorId: null,
      summary: `Wait started · ${String(row.wait_kind ?? "unknown")}`,
      metadata: { waitId, status },
    })

    if (status === "resolved" && typeof row.resolved_at === "string") {
      pushAuditEntry(entries, {
        timestamp: row.resolved_at,
        eventType: "wait_resolved",
        flowId: context.flowId,
        enrollmentId,
        stepId,
        actorId: null,
        summary: `Wait resolved · ${String(row.resolution_reason ?? "matched")}`,
        metadata: { waitId },
      })
    }

    if (status === "timed_out") {
      pushAuditEntry(entries, {
        timestamp: String(row.updated_at ?? row.resolved_at ?? startedAt),
        eventType: "wait_timed_out",
        flowId: context.flowId,
        enrollmentId,
        stepId,
        actorId: null,
        summary: "Wait timed out.",
        metadata: { waitId },
      })
    }
  }

  return entries
}

function buildApprovalAuditEntries(context: AutomationAnalyticsContext): GrowthAutomationAuditTimelineEntry[] {
  const entries: GrowthAutomationAuditTimelineEntry[] = []

  for (const approval of context.approvals) {
    pushAuditEntry(entries, {
      timestamp: approval.createdAt,
      eventType: "approval_created",
      flowId: context.flowId,
      enrollmentId: approval.enrollmentId,
      stepId: approval.stepId,
      actorId: approval.requestedBy,
      summary: `Approval requested · ${approval.actionType}`,
      metadata: {
        approvalId: approval.approvalId,
        status: approval.status,
        riskLevel: approval.riskLevel,
      },
    })

    if (approval.status === "approved" && approval.reviewedAt) {
      pushAuditEntry(entries, {
        timestamp: approval.reviewedAt,
        eventType: "approval_approved",
        flowId: context.flowId,
        enrollmentId: approval.enrollmentId,
        stepId: approval.stepId,
        actorId: approval.reviewedBy,
        summary: `Approval approved · ${approval.actionType}`,
        metadata: { approvalId: approval.approvalId, reviewNote: approval.reviewNote },
      })
    }

    if (approval.status === "rejected" && approval.reviewedAt) {
      pushAuditEntry(entries, {
        timestamp: approval.reviewedAt,
        eventType: "approval_rejected",
        flowId: context.flowId,
        enrollmentId: approval.enrollmentId,
        stepId: approval.stepId,
        actorId: approval.reviewedBy,
        summary: `Approval rejected · ${approval.actionType}`,
        metadata: { approvalId: approval.approvalId, reviewNote: approval.reviewNote },
      })
    }

    if (approval.status === "cancelled") {
      pushAuditEntry(entries, {
        timestamp: approval.reviewedAt ?? approval.updatedAt,
        eventType: "approval_cancelled",
        flowId: context.flowId,
        enrollmentId: approval.enrollmentId,
        stepId: approval.stepId,
        actorId: approval.reviewedBy,
        summary: `Approval cancelled · ${approval.actionType}`,
        metadata: { approvalId: approval.approvalId, reviewNote: approval.reviewNote },
      })
    }
  }

  return entries
}

function buildJobAuditEntries(context: AutomationAnalyticsContext): GrowthAutomationAuditTimelineEntry[] {
  const entries: GrowthAutomationAuditTimelineEntry[] = []

  for (const job of context.jobs) {
    pushAuditEntry(entries, {
      timestamp: job.scheduledFor,
      eventType: "job_created",
      flowId: context.flowId,
      enrollmentId: job.enrollmentId,
      stepId: null,
      actorId: null,
      summary: `${job.channel} job created · ${job.status}`,
      metadata: { jobId: job.jobId, leadId: job.leadId },
    })
  }

  return entries
}

export function buildAutomationAuditTimelineFromContext(
  context: AutomationAnalyticsContext,
): GrowthAutomationAuditTimelineEntry[] {
  const entries = [
    ...buildRuntimeLifecycleAuditEntries(context),
    ...buildEnrollmentAuditEntries(context),
    ...buildWaitAuditEntries(context),
    ...buildApprovalAuditEntries(context),
    ...buildJobAuditEntries(context),
  ]

  return entries.sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export async function getAutomationAuditTimeline(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; limit?: number },
): Promise<GrowthAutomationAuditTimelineSnapshot> {
  const context = await loadAutomationAnalyticsContext(admin, input)
  const entries = buildAutomationAuditTimelineFromContext(context).slice(0, input.limit ?? 100)

  return {
    auditId: randomUUID(),
    flowId: input.flowId,
    generatedAt: new Date().toISOString(),
    entries,
    safety: automationAnalyticsSafetyPayload(),
  }
}

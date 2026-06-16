import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { getFlow } from "@/lib/growth/automation/growth-automation-repository"
import {
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  type GrowthAutomationApprovalListInput,
  type GrowthAutomationApprovalOperationResult,
  type GrowthAutomationApprovalRecord,
  type GrowthAutomationApprovalResumeInput,
  type GrowthAutomationApprovalReviewInput,
} from "@/lib/growth/automation/growth-automation-approval-types"
import {
  approvalIssue,
  buildApprovalPreview,
  buildAutomationApprovalRecord,
  extractPendingApprovalsFromEnrollmentMetadata,
  findStoredAutomationApproval,
  readStoredAutomationApprovals,
  upsertStoredAutomationApproval,
} from "@/lib/growth/automation/growth-automation-approval-utils"
import {
  advanceAutomationEnrollment,
  getAutomationRuntimeExecutionStatus,
} from "@/lib/growth/automation/growth-automation-runtime-orchestrator"
import type { GrowthAutomationRuntimeExecutionRun } from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import {
  mergeAutomationExecutionMetadata,
  readAutomationExecutionMetadata,
} from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"
import { advanceGrowthSequenceEnrollmentAfterStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import {
  fetchGrowthSequenceEnrollmentById,
  updateGrowthSequenceEnrollment,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  getSequenceExecutionJob,
  updateSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"

type LoadedApprovalContext = {
  enrollment: NonNullable<Awaited<ReturnType<typeof fetchGrowthSequenceEnrollmentById>>>
  flowId: string
  versionId: string
  approval: GrowthAutomationApprovalRecord
}

async function loadApprovalContext(
  admin: SupabaseClient,
  input: { organizationId: string; approvalId: string },
): Promise<LoadedApprovalContext> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id, metadata, status")
    .not("metadata", "is", null)
    .limit(200)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const flowId = String(metadata.automation_flow_id ?? "")
    if (!flowId) continue

    const flow = await getFlow(admin, { flowId, organizationId: input.organizationId }).catch(() => null)
    if (!flow) continue

    const versionId = String(metadata.automation_version_id ?? flow.publishedVersionId ?? "")
    const pending = extractPendingApprovalsFromEnrollmentMetadata({
      metadata,
      flowId,
      versionId,
      enrollmentId: String(row.id),
      leadId: String(row.lead_id),
    })
    const stored = readStoredAutomationApprovals(metadata)
    const candidates = [...pending, ...stored.filter((entry) => entry.status !== "pending")]
    const approval = candidates.find((entry) => entry.approvalId === input.approvalId)
    if (!approval) continue

    const enrollment = await fetchGrowthSequenceEnrollmentById(admin, String(row.id))
    if (!enrollment) continue

    return { enrollment, flowId, versionId, approval }
  }

  throw new Error("not_found")
}

async function resolveLeadLabel(admin: SupabaseClient, leadId: string): Promise<string | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  return lead.contactName?.trim() || lead.contactEmail?.trim() || lead.companyName?.trim() || leadId
}

function patchExecutionCollections(
  metadata: Record<string, unknown>,
  input: {
    approvalId: string
    gateStatus?: "pending" | "approved" | "rejected" | "cancelled"
    jobStatus?: "pending_approval" | "approved" | "blocked" | "skipped"
  },
): Record<string, unknown> {
  const executionMeta = readAutomationExecutionMetadata(metadata)

  const approvalGates = Array.isArray(executionMeta.approval_gates)
    ? [...(executionMeta.approval_gates as Array<Record<string, unknown>>)]
    : []
  const pendingJobs = Array.isArray(executionMeta.pending_jobs)
    ? [...(executionMeta.pending_jobs as Array<Record<string, unknown>>)]
    : []

  for (const gate of approvalGates) {
    if (String(gate.gateId ?? "") === input.approvalId && input.gateStatus) {
      gate.status = input.gateStatus
    }
  }

  for (const job of pendingJobs) {
    if (String(job.jobId ?? "") === input.approvalId && input.jobStatus) {
      job.status = input.jobStatus
    }
  }

  return mergeAutomationExecutionMetadata(metadata, {
    approval_gates: approvalGates,
    pending_jobs: pendingJobs,
    qa_marker: GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  })
}

async function persistApprovalReview(
  admin: SupabaseClient,
  context: LoadedApprovalContext,
  input: {
    status: GrowthAutomationApprovalRecord["status"]
    reviewNote?: string | null
    actingUserId?: string | null
    actingUserEmail?: string | null
    gateStatus?: "pending" | "approved" | "rejected" | "cancelled"
    jobStatus?: "pending_approval" | "approved" | "blocked" | "skipped"
    lastStatus: string
    enrollmentStalled?: boolean
  },
): Promise<GrowthAutomationApprovalRecord> {
  const now = new Date().toISOString()
  const reviewedBy = input.actingUserEmail ?? input.actingUserId ?? null

  const updatedApproval = buildAutomationApprovalRecord({
    ...context.approval,
    status: input.status,
    reviewedBy,
    reviewNote: input.reviewNote ?? null,
    reviewedAt: now,
    updatedAt: now,
  })

  let metadata = upsertStoredAutomationApproval(context.enrollment.metadata ?? {}, updatedApproval)
  metadata = patchExecutionCollections(metadata, {
    approvalId: context.approval.approvalId,
    gateStatus: input.gateStatus,
    jobStatus: input.jobStatus,
  })

  metadata = mergeAutomationExecutionMetadata(metadata, {
    last_status: input.lastStatus,
    qa_marker: GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  })

  await updateGrowthSequenceEnrollment(admin, context.enrollment.id, {
    enrollmentStalled: input.enrollmentStalled ?? context.enrollment.enrollmentStalled,
    metadata,
  })

  if (context.approval.jobId && input.jobStatus) {
    const patch: Parameters<typeof updateSequenceExecutionJob>[2] = { status: input.jobStatus }
    if (input.status === "approved") {
      patch.humanApprovedAt = now
      patch.humanApprovedBy = reviewedBy
    }
    await updateSequenceExecutionJob(admin, context.approval.jobId, patch)
  }

  return updatedApproval
}

export async function listPendingAutomationApprovals(
  admin: SupabaseClient,
  input: GrowthAutomationApprovalListInput,
): Promise<GrowthAutomationApprovalRecord[]> {
  let query = admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id, metadata, status")
    .not("metadata", "is", null)
    .limit(250)

  if (input.enrollmentId) {
    query = query.eq("id", input.enrollmentId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const results: GrowthAutomationApprovalRecord[] = []

  for (const row of data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const flowId = String(metadata.automation_flow_id ?? "")
    if (!flowId) continue
    if (input.flowId && input.flowId !== flowId) continue

    const flow = await getFlow(admin, { flowId, organizationId: input.organizationId }).catch(() => null)
    if (!flow) continue

    const versionId = String(metadata.automation_version_id ?? flow.publishedVersionId ?? "")
    const leadLabel = await resolveLeadLabel(admin, String(row.lead_id))
    const extracted = extractPendingApprovalsFromEnrollmentMetadata({
      metadata,
      flowId,
      versionId,
      enrollmentId: String(row.id),
      leadId: String(row.lead_id),
      leadLabel,
    })

    for (const approval of extracted) {
      if (input.status && input.status !== "pending_only" && approval.status !== input.status) continue
      if ((!input.status || input.status === "pending_only") && approval.status !== "pending") continue
      results.push(approval)
    }
  }

  return results.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function getAutomationApproval(
  admin: SupabaseClient,
  input: { organizationId: string; approvalId: string },
): Promise<GrowthAutomationApprovalRecord> {
  const context = await loadApprovalContext(admin, input)
  const leadLabel = await resolveLeadLabel(admin, context.enrollment.leadId)
  const stored = findStoredAutomationApproval(context.enrollment.metadata ?? {}, input.approvalId)
  if (stored) return stored

  const refreshed = extractPendingApprovalsFromEnrollmentMetadata({
    metadata: context.enrollment.metadata ?? {},
    flowId: context.flowId,
    versionId: context.versionId,
    enrollmentId: context.enrollment.id,
    leadId: context.enrollment.leadId,
    leadLabel,
  }).find((entry) => entry.approvalId === input.approvalId)

  if (!refreshed) throw new Error("not_found")
  return refreshed
}

export async function approveAutomationAction(
  admin: SupabaseClient,
  input: GrowthAutomationApprovalReviewInput,
): Promise<GrowthAutomationApprovalOperationResult> {
  const warnings: GrowthAutomationValidationIssue[] = []
  const errors: GrowthAutomationValidationIssue[] = []
  const context = await loadApprovalContext(admin, input)

  if (context.approval.status !== "pending") {
    throw new Error("invalid_status")
  }

  const gateStatus = context.approval.actionType === "approval_gate" ? "approved" : undefined
  const jobStatus =
    context.approval.actionType === "approval_gate" ? undefined : ("approved" as const)

  const approval = await persistApprovalReview(admin, context, {
    status: "approved",
    reviewNote: input.reviewNote,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    gateStatus,
    jobStatus,
    lastStatus: "approved",
    enrollmentStalled: context.approval.actionType === "approval_gate",
  })

  if (context.approval.jobId) {
    const job = await getSequenceExecutionJob(admin, context.approval.jobId)
    if (job?.status === "sent" || job?.status === "running") {
      errors.push(
        approvalIssue("error", "forbidden_send_detected", "Approved job must not execute sends in S5-K."),
      )
    }
  }

  warnings.push(
    approvalIssue(
      "warning",
      "approved_without_send",
      "Approval recorded — message send execution remains disabled.",
    ),
  )

  return { ok: errors.length === 0, approval, warnings, errors }
}

export async function rejectAutomationAction(
  admin: SupabaseClient,
  input: GrowthAutomationApprovalReviewInput,
): Promise<GrowthAutomationApprovalOperationResult> {
  const context = await loadApprovalContext(admin, input)
  if (context.approval.status !== "pending") throw new Error("invalid_status")

  const gateStatus = context.approval.actionType === "approval_gate" ? "rejected" : undefined
  const jobStatus = context.approval.actionType === "approval_gate" ? undefined : ("blocked" as const)

  const approval = await persistApprovalReview(admin, context, {
    status: "rejected",
    reviewNote: input.reviewNote,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    gateStatus,
    jobStatus,
    lastStatus: "blocked",
    enrollmentStalled: true,
  })

  return {
    ok: true,
    approval,
    warnings: [
      approvalIssue(
        "warning",
        "rejected_path",
        "Approval rejected — enrollment remains blocked pending fallback handling.",
      ),
    ],
    errors: [],
  }
}

export async function cancelAutomationApproval(
  admin: SupabaseClient,
  input: GrowthAutomationApprovalReviewInput,
): Promise<GrowthAutomationApprovalOperationResult> {
  const context = await loadApprovalContext(admin, input)
  if (context.approval.status !== "pending") throw new Error("invalid_status")

  const gateStatus = context.approval.actionType === "approval_gate" ? "cancelled" : undefined
  const jobStatus = context.approval.actionType === "approval_gate" ? undefined : ("blocked" as const)

  const approval = await persistApprovalReview(admin, context, {
    status: "cancelled",
    reviewNote: input.reviewNote,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    gateStatus,
    jobStatus,
    lastStatus: "blocked",
    enrollmentStalled: true,
  })

  return {
    ok: true,
    approval,
    warnings: [
      approvalIssue("warning", "approval_cancelled", "Approval cancelled — enrollment remains blocked."),
    ],
    errors: [],
  }
}

export async function resumeAutomationAfterApproval(
  admin: SupabaseClient,
  input: GrowthAutomationApprovalResumeInput,
): Promise<{
  ok: boolean
  execution: GrowthAutomationRuntimeExecutionRun
  warnings: GrowthAutomationValidationIssue[]
}> {
  const warnings: GrowthAutomationValidationIssue[] = []
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("not_found")
  if (String(enrollment.metadata?.automation_flow_id ?? "") !== input.flowId) throw new Error("flow_mismatch")

  await getFlow(admin, { flowId: input.flowId, organizationId: input.organizationId })

  const metadata = enrollment.metadata ?? {}
  const storedApprovals = readStoredAutomationApprovals(metadata)
  const approved = input.approvalId
    ? storedApprovals.find((entry) => entry.approvalId === input.approvalId && entry.status === "approved")
    : storedApprovals.find((entry) => entry.status === "approved")

  if (!approved) throw new Error("approval_not_approved")

  if (approved.actionType === "approval_gate") {
    await advanceGrowthSequenceEnrollmentAfterStep(admin, {
      enrollmentStepId: approved.stepId,
    })

    const refreshed = await fetchGrowthSequenceEnrollmentById(admin, enrollment.id)
    const nextMetadata = mergeAutomationExecutionMetadata(refreshed?.metadata ?? metadata, {
      last_status: "advanced",
      enrollmentStalled: false,
    })

    await updateGrowthSequenceEnrollment(admin, enrollment.id, {
      enrollmentStalled: false,
      metadata: nextMetadata,
    })
  } else {
    await updateGrowthSequenceEnrollment(admin, enrollment.id, {
      enrollmentStalled: true,
      metadata: mergeAutomationExecutionMetadata(metadata, {
        last_status: "approved",
      }),
    })
    warnings.push(
      approvalIssue(
        "warning",
        "approved_job_no_send",
        "Approved action job recorded — send execution remains disabled in S5-K.",
      ),
    )
  }

  const execution = await advanceAutomationEnrollment(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
    enrollmentId: input.enrollmentId,
    leadId: input.leadId ?? enrollment.leadId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })

  return { ok: true, execution, warnings }
}

export function buildApprovalPreviewForRecord(
  approval: GrowthAutomationApprovalRecord,
): GrowthAutomationApprovalRecord["previewPayload"] {
  return buildApprovalPreview({
    actionType: approval.actionType,
    stepOrder: approval.previewPayload.stepOrder,
    stepKind: approval.previewPayload.stepKind,
    channel: approval.previewPayload.channel,
    leadLabel: approval.previewPayload.leadLabel,
    entryReason: approval.previewPayload.entryReason,
  })
}

export { buildApprovalPreview }

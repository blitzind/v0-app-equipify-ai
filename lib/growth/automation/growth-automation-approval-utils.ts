/** Growth Engine S5-K — automation operator approval helpers (client-safe). */

import type {
  GrowthAutomationRuntimeApprovalGate,
  GrowthAutomationRuntimePendingJob,
} from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import { readAutomationExecutionMetadata, mergeAutomationExecutionMetadata } from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import {
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  type GrowthAutomationApprovalActionType,
  type GrowthAutomationApprovalPreviewPayload,
  type GrowthAutomationApprovalRecord,
  type GrowthAutomationApprovalRiskLevel,
  type GrowthAutomationApprovalStatus,
} from "@/lib/growth/automation/growth-automation-approval-types"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"

type StoredApprovalGate = GrowthAutomationRuntimeApprovalGate & {
  status?: GrowthAutomationApprovalStatus | "pending"
}

type StoredPendingJob = GrowthAutomationRuntimePendingJob & {
  status?: GrowthAutomationApprovalStatus | "pending_approval" | "approved"
}

export function approvalIssue(
  severity: GrowthAutomationValidationIssue["severity"],
  ruleCode: string,
  message: string,
): GrowthAutomationValidationIssue {
  return { severity, ruleCode, message, nodeId: null }
}

export function automationApprovalSafetyPayload(): typeof GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS }
}

export function resolveApprovalActionType(input: {
  gate?: StoredApprovalGate | null
  job?: StoredPendingJob | null
  channel?: string | null
}): GrowthAutomationApprovalActionType {
  if (input.gate) return "approval_gate"
  const channel = (input.job?.channel ?? input.channel ?? "").trim()
  if (channel === "sms") return "send_sms"
  if (channel === "voice_drop") return "send_voice_drop"
  if (channel === "email") return "send_email"
  return "unknown_action"
}

export function resolveApprovalRiskLevel(actionType: GrowthAutomationApprovalActionType): GrowthAutomationApprovalRiskLevel {
  if (actionType === "approval_gate") return "low"
  if (actionType === "send_email") return "medium"
  if (actionType === "send_sms" || actionType === "send_voice_drop") return "high"
  return "medium"
}

export function buildApprovalPreview(input: {
  actionType: GrowthAutomationApprovalActionType
  stepOrder: number
  stepKind: string
  channel: string | null
  leadLabel: string | null
  entryReason: string | null
}): GrowthAutomationApprovalPreviewPayload {
  const channelLabel = input.channel ?? input.actionType.replace("send_", "")
  const summary =
    input.actionType === "approval_gate"
      ? `Approval gate at step ${input.stepOrder} — human review required before progression.`
      : `Pending ${channelLabel} action at step ${input.stepOrder} — approved status does not send yet.`

  return {
    summary,
    stepOrder: input.stepOrder,
    stepKind: input.stepKind,
    channel: input.channel,
    leadLabel: input.leadLabel,
    entryReason: input.entryReason,
    executionBlocked: true,
    sendBlocked: true,
  }
}

export function readStoredAutomationApprovals(
  metadata: Record<string, unknown> | null | undefined,
): GrowthAutomationApprovalRecord[] {
  const executionMeta = readAutomationExecutionMetadata(metadata)
  const stored = executionMeta.approvals
  if (!Array.isArray(stored)) return []
  return stored.filter((entry): entry is GrowthAutomationApprovalRecord => {
    return Boolean(entry && typeof entry === "object" && typeof (entry as GrowthAutomationApprovalRecord).approvalId === "string")
  })
}

export function findStoredAutomationApproval(
  metadata: Record<string, unknown> | null | undefined,
  approvalId: string,
): GrowthAutomationApprovalRecord | null {
  return readStoredAutomationApprovals(metadata).find((entry) => entry.approvalId === approvalId) ?? null
}

export function mergeStoredAutomationApprovals(
  metadata: Record<string, unknown> | null | undefined,
  approvals: GrowthAutomationApprovalRecord[],
): Record<string, unknown> {
  return mergeAutomationExecutionMetadata(metadata, { approvals })
}

export function upsertStoredAutomationApproval(
  metadata: Record<string, unknown> | null | undefined,
  approval: GrowthAutomationApprovalRecord,
): Record<string, unknown> {
  const existing = readStoredAutomationApprovals(metadata)
  const next = existing.filter((entry) => entry.approvalId !== approval.approvalId)
  next.push(approval)
  return mergeStoredAutomationApprovals(metadata, next)
}

export function buildAutomationApprovalRecord(input: {
  approvalId: string
  flowId: string
  versionId: string
  enrollmentId: string
  leadId: string
  stepId: string
  jobId?: string | null
  actionType: GrowthAutomationApprovalActionType
  status?: GrowthAutomationApprovalStatus
  requestedBy?: string | null
  reviewedBy?: string | null
  reviewNote?: string | null
  previewPayload: GrowthAutomationApprovalPreviewPayload
  riskLevel?: GrowthAutomationApprovalRiskLevel
  createdAt?: string
  reviewedAt?: string | null
  updatedAt?: string
}): GrowthAutomationApprovalRecord {
  const now = new Date().toISOString()
  return {
    approvalId: input.approvalId,
    flowId: input.flowId,
    versionId: input.versionId,
    enrollmentId: input.enrollmentId,
    leadId: input.leadId,
    stepId: input.stepId,
    jobId: input.jobId ?? null,
    actionType: input.actionType,
    status: input.status ?? "pending",
    requestedBy: input.requestedBy ?? null,
    reviewedBy: input.reviewedBy ?? null,
    reviewNote: input.reviewNote ?? null,
    previewPayload: input.previewPayload,
    riskLevel: input.riskLevel ?? resolveApprovalRiskLevel(input.actionType),
    createdAt: input.createdAt ?? now,
    reviewedAt: input.reviewedAt ?? null,
    updatedAt: input.updatedAt ?? now,
    safety: GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  }
}

export function extractPendingApprovalsFromEnrollmentMetadata(input: {
  metadata: Record<string, unknown> | null | undefined
  flowId: string
  versionId: string
  enrollmentId: string
  leadId: string
  leadLabel?: string | null
}): GrowthAutomationApprovalRecord[] {
  const executionMeta = readAutomationExecutionMetadata(input.metadata)
  const stored = readStoredAutomationApprovals(input.metadata)
  const storedById = new Map(stored.map((entry) => [entry.approvalId, entry]))

  const gates = Array.isArray(executionMeta.approval_gates)
    ? (executionMeta.approval_gates as StoredApprovalGate[])
    : []
  const jobs = Array.isArray(executionMeta.pending_jobs)
    ? (executionMeta.pending_jobs as StoredPendingJob[])
    : []

  const extracted: GrowthAutomationApprovalRecord[] = []

  for (const gate of gates) {
    const gateStatus = gate.status ?? "pending"
    if (gateStatus !== "pending") continue
    const approvalId = gate.gateId
    const existing = storedById.get(approvalId)
    if (existing && existing.status !== "pending") continue

    const actionType = resolveApprovalActionType({ gate })
    extracted.push(
      buildAutomationApprovalRecord({
        approvalId,
        flowId: input.flowId,
        versionId: input.versionId,
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
        stepId: gate.enrollmentStepId,
        actionType,
        status: existing?.status ?? "pending",
        requestedBy: existing?.requestedBy ?? null,
        reviewedBy: existing?.reviewedBy ?? null,
        reviewNote: existing?.reviewNote ?? null,
        previewPayload:
          existing?.previewPayload ??
          buildApprovalPreview({
            actionType,
            stepOrder: gate.stepOrder,
            stepKind: "approval",
            channel: null,
            leadLabel: input.leadLabel ?? null,
            entryReason: gate.entryReason,
          }),
        createdAt: existing?.createdAt ?? gate.createdAt,
        reviewedAt: existing?.reviewedAt ?? null,
        updatedAt: existing?.updatedAt ?? gate.createdAt,
      }),
    )
  }

  for (const job of jobs) {
    const jobStatus = job.status ?? "pending_approval"
    if (jobStatus !== "pending_approval") continue
    const approvalId = job.jobId
    const existing = storedById.get(approvalId)
    if (existing && existing.status !== "pending") continue

    const actionType = resolveApprovalActionType({ job })
    extracted.push(
      buildAutomationApprovalRecord({
        approvalId,
        flowId: input.flowId,
        versionId: input.versionId,
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
        stepId: job.enrollmentStepId,
        jobId: job.jobId,
        actionType,
        status: existing?.status ?? "pending",
        requestedBy: existing?.requestedBy ?? null,
        reviewedBy: existing?.reviewedBy ?? null,
        reviewNote: existing?.reviewNote ?? null,
        previewPayload:
          existing?.previewPayload ??
          buildApprovalPreview({
            actionType,
            stepOrder: job.stepOrder,
            stepKind: "action",
            channel: job.channel,
            leadLabel: input.leadLabel ?? null,
            entryReason: "Pending action job awaiting operator approval.",
          }),
        createdAt: existing?.createdAt ?? job.createdAt,
        reviewedAt: existing?.reviewedAt ?? null,
        updatedAt: existing?.updatedAt ?? job.createdAt,
      }),
    )
  }

  return extracted.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function isPendingAutomationApproval(approval: GrowthAutomationApprovalRecord): boolean {
  return approval.status === "pending"
}

export function automationApprovalQaMarkerPresent(metadata: Record<string, unknown> | null | undefined): boolean {
  const stored = readStoredAutomationApprovals(metadata)
  return stored.some((entry) => entry.safety?.approval_execution_enabled === true) || stored.length === 0
}

export { GROWTH_AUTOMATION_APPROVAL_QA_MARKER }

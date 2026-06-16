/** Growth Engine S5-K — automation operator approval types (client-safe). */

import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_APPROVAL_QA_MARKER = "growth-automation-approval-s5k-v1" as const

export const GROWTH_AUTOMATION_APPROVAL_METADATA_KEY = "automation_approvals" as const

export const GROWTH_AUTOMATION_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
] as const
export type GrowthAutomationApprovalStatus = (typeof GROWTH_AUTOMATION_APPROVAL_STATUSES)[number]

export const GROWTH_AUTOMATION_APPROVAL_ACTION_TYPES = [
  "approval_gate",
  "send_email",
  "send_sms",
  "send_voice_drop",
  "unknown_action",
] as const
export type GrowthAutomationApprovalActionType = (typeof GROWTH_AUTOMATION_APPROVAL_ACTION_TYPES)[number]

export const GROWTH_AUTOMATION_APPROVAL_RISK_LEVELS = ["low", "medium", "high"] as const
export type GrowthAutomationApprovalRiskLevel = (typeof GROWTH_AUTOMATION_APPROVAL_RISK_LEVELS)[number]

export const GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS = {
  approval_execution_enabled: true,
  message_send_execution_enabled: false,
  provider_execution_enabled: false,
  notifications_enabled: false,
  autonomous_approval_enabled: false,
  requires_human_review: true,
  approved_job_execution_enabled: false,
  no_message_sends: true,
  no_provider_execution: true,
  no_notifications: true,
  no_autonomous_approval: true,
  no_background_jobs: true,
} as const

export type GrowthAutomationApprovalSafetyFlags = typeof GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS

export type GrowthAutomationApprovalPreviewPayload = {
  summary: string
  stepOrder: number
  stepKind: string
  channel: string | null
  leadLabel: string | null
  entryReason: string | null
  executionBlocked: true
  sendBlocked: true
}

export type GrowthAutomationApprovalRecord = {
  approvalId: string
  flowId: string
  versionId: string
  enrollmentId: string
  leadId: string
  stepId: string
  jobId: string | null
  actionType: GrowthAutomationApprovalActionType
  status: GrowthAutomationApprovalStatus
  requestedBy: string | null
  reviewedBy: string | null
  reviewNote: string | null
  previewPayload: GrowthAutomationApprovalPreviewPayload
  riskLevel: GrowthAutomationApprovalRiskLevel
  createdAt: string
  reviewedAt: string | null
  updatedAt: string
  safety: GrowthAutomationApprovalSafetyFlags
}

export type GrowthAutomationApprovalListInput = {
  organizationId: string
  flowId?: string | null
  enrollmentId?: string | null
  status?: GrowthAutomationApprovalStatus | "pending_only"
}

export type GrowthAutomationApprovalReviewInput = {
  organizationId: string
  approvalId: string
  reviewNote?: string | null
  actingUserId?: string | null
  actingUserEmail?: string | null
}

export type GrowthAutomationApprovalResumeInput = {
  flowId: string
  organizationId: string
  enrollmentId: string
  approvalId?: string | null
  leadId?: string | null
  actingUserId?: string | null
  actingUserEmail?: string | null
}

export type GrowthAutomationApprovalOperationResult = {
  ok: boolean
  approval: GrowthAutomationApprovalRecord
  warnings: GrowthAutomationValidationIssue[]
  errors: GrowthAutomationValidationIssue[]
}

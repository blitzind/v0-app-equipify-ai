/** Growth Engine S5-I — automation runtime enrollment types (client-safe). */

import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER = "growth-automation-enrollment-s5i-v1" as const

export const GROWTH_AUTOMATION_ENROLLMENT_METADATA_KEY = "automation_enrollment" as const

export const GROWTH_AUTOMATION_ENROLLMENT_STATUSES = [
  "draft",
  "enrolled",
  "blocked",
  "duplicate",
  "cancelled",
  "failed",
  "completed",
] as const
export type GrowthAutomationEnrollmentStatus = (typeof GROWTH_AUTOMATION_ENROLLMENT_STATUSES)[number]

export const GROWTH_AUTOMATION_ENROLLMENT_SUPPORTED_TRIGGERS = [
  "manual.enrollment",
  "media.viewed",
  "media.play_started",
  "media.completed",
  "media.cta_clicked",
  "booking_handoff.ready",
  "high_intent.detected",
] as const
export type GrowthAutomationEnrollmentSupportedTrigger =
  (typeof GROWTH_AUTOMATION_ENROLLMENT_SUPPORTED_TRIGGERS)[number]

export const GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS = {
  runtime_publish_enabled: true,
  runtime_activation_enabled: true,
  enrollment_execution_enabled: true,
  sequence_execution_enabled: false,
  notifications_enabled: false,
  provider_execution_enabled: false,
  requires_human_review: true,
  sr3_artifact_writes_enabled: false,
  automation_execution_enabled: false,
  no_sequence_execution: true,
  no_notifications: true,
  no_provider_execution: true,
  no_background_jobs: true,
  no_autonomous_approval: true,
} as const

export type GrowthAutomationEnrollmentSafetyFlags = typeof GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS

export type GrowthAutomationEnrollmentRecord = {
  enrollmentId: string
  flowId: string
  versionId: string
  compiledPatternId: string
  leadId: string
  organizationId: string
  triggerSource: string
  triggerEvent: string | null
  triggerPayload: Record<string, unknown>
  status: GrowthAutomationEnrollmentStatus
  entryStepId: string | null
  entryReason: string
  duplicateEnrollment: boolean
  warnings: GrowthAutomationValidationIssue[]
  errors: GrowthAutomationValidationIssue[]
  safety: GrowthAutomationEnrollmentSafetyFlags
  createdAt: string
  updatedAt: string
}

export type GrowthAutomationRuntimeMatch = {
  flowId: string
  flowName: string
  versionId: string
  compiledPatternId: string
  patternKey: string
  triggerSource: string
  triggerEvent: string | null
  activationStatus: string
  patternActive: boolean
  entryReason: string
}

export type GrowthAutomationTriggerMatchInput = {
  organizationId: string
  triggerSource: string
  triggerEvent?: string | null
  triggerPayload?: Record<string, unknown>
  leadId?: string | null
}

export type GrowthAutomationTriggerMatchResult = {
  ok: boolean
  matches: GrowthAutomationRuntimeMatch[]
  warnings: GrowthAutomationValidationIssue[]
  errors: GrowthAutomationValidationIssue[]
}

export type GrowthAutomationEnrollLeadInput = {
  flowId: string
  organizationId: string
  leadId: string
  triggerSource?: string
  triggerEvent?: string | null
  triggerPayload?: Record<string, unknown>
  entryReason?: string
  allowReEnrollmentOverride?: boolean
  actingUserId?: string | null
  actingUserEmail?: string | null
}

export type GrowthAutomationBulkEnrollInput = {
  flowId: string
  organizationId: string
  leadIds: string[]
  triggerSource?: string
  triggerEvent?: string | null
  triggerPayload?: Record<string, unknown>
  entryReason?: string
  allowReEnrollmentOverride?: boolean
  actingUserId?: string | null
  actingUserEmail?: string | null
}

export type GrowthAutomationBulkEnrollResult = {
  ok: boolean
  enrolled: GrowthAutomationEnrollmentRecord[]
  blocked: GrowthAutomationEnrollmentRecord[]
  duplicates: GrowthAutomationEnrollmentRecord[]
  failed: GrowthAutomationEnrollmentRecord[]
}

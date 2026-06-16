/** Growth Engine S5-D — automation flow → SR-3 compiler types (client-safe). */

import type { SequenceBranchEdgeType } from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type { SequenceConditionSpec } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import type { SequenceEnrollmentWaitKind } from "@/lib/growth/sequences/conditions/sequence-wait-types"

export const GROWTH_AUTOMATION_COMPILER_QA_MARKER = "growth-automation-compiler-s5d-v1" as const

export const GROWTH_AUTOMATION_COMPILE_STATUSES = ["draft", "compiled", "failed"] as const
export type GrowthAutomationCompileStatus = (typeof GROWTH_AUTOMATION_COMPILE_STATUSES)[number]

export const GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS = {
  compiler_execution_enabled: false,
  compile_preview_only: true,
  no_sequence_pattern_writes: true,
  no_sequence_execution: true,
  no_notifications: true,
  no_provider_execution: true,
} as const

export const GROWTH_AUTOMATION_COMPILER_SUPPORTED_TRIGGERS = [
  "share_page.viewed",
  "share_page.cta_clicked",
  "share_page.booking_started",
  "share_page.booking_completed",
  "media.viewed",
  "media.play_started",
  "media.completed",
  "media.cta_clicked",
  "booking_handoff.ready",
  "high_intent.detected",
  "email.replied",
  "manual.enrollment",
] as const

export type GrowthAutomationCompilerSupportedTrigger =
  (typeof GROWTH_AUTOMATION_COMPILER_SUPPORTED_TRIGGERS)[number]

export const GROWTH_AUTOMATION_COMPILER_SUPPORTED_ACTIONS = [
  "send_email",
  "send_sms",
  "send_voice_drop",
  "assign_operator",
  "create_share_page",
  "instantiate_template",
  "notify_operator",
  "mark_lead_status",
  "create_task",
] as const

export type GrowthAutomationCompilerSupportedAction =
  (typeof GROWTH_AUTOMATION_COMPILER_SUPPORTED_ACTIONS)[number]

export type GrowthAutomationCompileIssue = {
  severity: "error" | "warning" | "info"
  ruleCode: string
  message: string
  nodeId?: string | null
}

export type GrowthAutomationCompiledPatternDraft = {
  flowId: string
  versionId: string
  organizationId: string
  flowName: string
  previewOnly: true
  writeEnabled: false
  entryTrigger: {
    triggerKey: string
    conditionSource: string | null
    conditionEvent: string | null
    enrollmentMode?: "manual"
  }
}

export type GrowthAutomationCompiledStepDraft = {
  draftStepId: string
  automationNodeId: string
  nodeType: string
  label: string
  stepOrder: number
  channel: string | null
  actionType: string | null
  requiresHumanApproval: true
  executionEnabled: false
  safeExecutionGate: boolean
  terminal: boolean
  metadata: Record<string, unknown>
}

export type GrowthAutomationCompiledConditionDraft = {
  draftConditionId: string
  automationNodeId: string
  conditionKey: string
  spec: SequenceConditionSpec
}

export type GrowthAutomationCompiledEdgeDraft = {
  draftEdgeId: string
  automationEdgeId: string
  fromDraftStepId: string
  toDraftStepId: string
  edgeType: SequenceBranchEdgeType
  conditionDraftId: string | null
  priority: number
  label: string | null
}

export type GrowthAutomationCompiledWaitDraft = {
  draftWaitId: string
  automationNodeId: string
  waitKind: SequenceEnrollmentWaitKind
  durationSeconds: number | null
  waitedForSource: SequenceConditionSpec["source"] | null
  waitedForEvent: SequenceConditionSpec["event"] | null
  conditionDraftId: string | null
  timeoutEdgeDraftId: string | null
}

export type GrowthAutomationCompileResult = {
  compileId: string
  flowId: string
  versionId: string
  status: GrowthAutomationCompileStatus
  compiledPatternDraft: GrowthAutomationCompiledPatternDraft | null
  compiledSteps: GrowthAutomationCompiledStepDraft[]
  compiledConditions: GrowthAutomationCompiledConditionDraft[]
  compiledEdges: GrowthAutomationCompiledEdgeDraft[]
  compiledWaits: GrowthAutomationCompiledWaitDraft[]
  warnings: GrowthAutomationCompileIssue[]
  errors: GrowthAutomationCompileIssue[]
  safety: typeof GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS
  createdAt: string
  stats: {
    stepCount: number
    conditionCount: number
    edgeCount: number
    waitCount: number
    safeExecutionGateCount: number
  }
}

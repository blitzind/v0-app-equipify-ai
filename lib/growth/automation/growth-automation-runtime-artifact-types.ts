/** Growth Engine S5-G — SR-3 runtime artifact preview types (client-safe). */

import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationRuntimeReconciliationDiff } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

export const GROWTH_AUTOMATION_RUNTIME_ARTIFACT_QA_MARKER =
  "growth-automation-runtime-artifact-s5g-v1" as const

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS = {
  runtime_publish_enabled: false,
  sr3_artifact_writes_enabled: false,
  reconciliation_preview_only: true,
  automation_execution_enabled: false,
  no_sequence_execution: true,
  no_notifications: true,
  no_provider_execution: true,
} as const

export type GrowthAutomationRuntimeArtifactPlanItem = {
  artifactKind: string
  previewId: string
  sourceNodeId: string | null
  summary: string
  writeEnabled: false
}

export type GrowthAutomationRuntimeArtifactCleanupItem = {
  artifactKind: string
  previewId: string
  reason: string
  action: "archive_preview" | "detach_preview"
}

export type GrowthAutomationRuntimeArtifactRollbackItem = {
  step: number
  action: string
  targetVersionId: string | null
  detail: string
}

export type GrowthAutomationRuntimeArtifactPreview = {
  qaMarker: typeof GROWTH_AUTOMATION_RUNTIME_ARTIFACT_QA_MARKER
  compileId: string
  previewOnly: true
  writeEnabled: false
  pattern: GrowthAutomationCompileResult["compiledPatternDraft"]
  steps: GrowthAutomationCompileResult["compiledSteps"]
  conditions: GrowthAutomationCompileResult["compiledConditions"]
  edges: GrowthAutomationCompileResult["compiledEdges"]
  waits: GrowthAutomationCompileResult["compiledWaits"]
  approvalGates: GrowthAutomationRuntimeArtifactPlanItem[]
  actionGuards: GrowthAutomationRuntimeArtifactPlanItem[]
  triggerBindings: Array<{
    triggerKey: string
    conditionSource: string | null
    conditionEvent: string | null
  }>
  publishDiff: GrowthAutomationRuntimeReconciliationDiff
  cleanupPlan: GrowthAutomationRuntimeArtifactCleanupItem[]
  rollbackPlan: GrowthAutomationRuntimeArtifactRollbackItem[]
  safety: typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS
}

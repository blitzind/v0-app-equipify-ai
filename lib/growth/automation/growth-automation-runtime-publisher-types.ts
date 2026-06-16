/** Growth Engine S5-H — SR-3 runtime artifact publisher types (client-safe). */

import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationRuntimeReconciliationResult } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"
import type {
  GrowthAutomationFlow,
  GrowthAutomationFlowStatus,
  GrowthAutomationFlowVersion,
} from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER =
  "growth-automation-runtime-publisher-s5h-v1" as const

export const GROWTH_AUTOMATION_RUNTIME_METADATA_KEY = "_runtimeMetadata" as const

export const GROWTH_AUTOMATION_RUNTIME_ACTIVATION_STATUSES = [
  "draft",
  "compiled",
  "published",
  "active",
  "paused",
  "archived",
  "failed",
] as const
export type GrowthAutomationRuntimeActivationStatus =
  (typeof GROWTH_AUTOMATION_RUNTIME_ACTIVATION_STATUSES)[number]

export const GROWTH_AUTOMATION_RUNTIME_FLOW_STATUSES = [
  "draft",
  "published",
  "runtime_active",
  "runtime_paused",
  "archived",
] as const
export type GrowthAutomationRuntimeFlowStatus =
  (typeof GROWTH_AUTOMATION_RUNTIME_FLOW_STATUSES)[number]

export const GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS = {
  runtime_publish_enabled: true,
  runtime_activation_enabled: false,
  sequence_execution_enabled: false,
  notifications_enabled: false,
  provider_execution_enabled: false,
  requires_human_review: true,
  sr3_artifact_writes_enabled: true,
  automation_execution_enabled: false,
  no_sequence_execution: true,
  no_notifications: true,
  no_provider_execution: true,
  no_background_jobs: true,
  no_autonomous_enrollment: true,
} as const

export type GrowthAutomationRuntimeStats = {
  stepCount: number
  conditionCount: number
  edgeCount: number
  waitCount: number
  patternStepCount: number
}

export type GrowthAutomationRuntimeMetadata = {
  qaMarker: typeof GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER
  activationStatus: GrowthAutomationRuntimeActivationStatus
  compiledPatternId: string | null
  compiledVersionId: string | null
  publishedArtifactVersion: number | null
  lastPublishedAt: string | null
  lastActivatedAt: string | null
  lastPausedAt: string | null
  reconciliationId: string | null
  compileId: string | null
  requiresHumanReview: boolean
  executionEnabled: false
  runtimeStats: GrowthAutomationRuntimeStats | null
  publishHistory: Array<{
    publishedAt: string
    patternId: string
    versionId: string
    artifactVersion: number
  }>
}

export type GrowthAutomationRuntimePublishResult = {
  ok: boolean
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  patternId: string | null
  reconciliation: GrowthAutomationRuntimeReconciliationResult
  compile: GrowthAutomationCompileResult
  metadata: GrowthAutomationRuntimeMetadata
  effectiveFlowStatus: GrowthAutomationRuntimeFlowStatus
  errors: string[]
}

export type GrowthAutomationRuntimeActivationResult = {
  ok: boolean
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  patternId: string | null
  metadata: GrowthAutomationRuntimeMetadata | null
  effectiveFlowStatus: GrowthAutomationRuntimeFlowStatus
}

export type GrowthAutomationRuntimeStatusResult = {
  flow: GrowthAutomationFlow
  publishedVersion: GrowthAutomationFlowVersion | null
  metadata: GrowthAutomationRuntimeMetadata | null
  effectiveFlowStatus: GrowthAutomationRuntimeFlowStatus
  patternActive: boolean | null
  artifactCounts: GrowthAutomationRuntimeStats | null
  activationReadiness: {
    canPublish: boolean
    canActivate: boolean
    canPause: boolean
    blockedReasons: string[]
  }
}

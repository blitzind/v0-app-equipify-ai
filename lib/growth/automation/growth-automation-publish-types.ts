/** Growth Engine S5-F — automation publish + versioning types (client-safe). */

import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationSimulationResult } from "@/lib/growth/automation/growth-automation-simulation-types"
import type {
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationValidationIssue,
} from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_PUBLISH_QA_MARKER = "growth-automation-publish-s5f-v1" as const

export const GROWTH_AUTOMATION_PUBLISH_METADATA_KEY = "_publishMetadata" as const

export const GROWTH_AUTOMATION_PUBLISH_READINESS_STATUSES = ["ready", "blocked"] as const
export type GrowthAutomationPublishReadinessStatus =
  (typeof GROWTH_AUTOMATION_PUBLISH_READINESS_STATUSES)[number]

export const GROWTH_AUTOMATION_PUBLISH_STATUSES = ["draft", "published", "archived"] as const
export type GrowthAutomationPublishStatus = (typeof GROWTH_AUTOMATION_PUBLISH_STATUSES)[number]

export const GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS = {
  runtime_publish_enabled: false,
  sr3_artifact_writes_enabled: false,
  automation_execution_enabled: false,
  publish_metadata_only: true,
  no_sequence_execution: true,
  no_notifications: true,
  no_provider_execution: true,
} as const

export type GrowthAutomationCompileSummary = {
  compileId: string
  status: GrowthAutomationCompileResult["status"]
  stepCount: number
  conditionCount: number
  edgeCount: number
  waitCount: number
  safeExecutionGateCount: number
}

export type GrowthAutomationPublishMetadata = {
  qaMarker: typeof GROWTH_AUTOMATION_PUBLISH_QA_MARKER
  publishReadiness: GrowthAutomationPublishReadinessStatus
  lastCompiledAt: string
  lastSimulatedAt: string | null
  compileSummary: GrowthAutomationCompileSummary | null
  compileId: string | null
  simulationId: string | null
  simulationStatus: GrowthAutomationSimulationResult["status"] | null
  publishWarnings: GrowthAutomationValidationIssue[]
  publishErrors: GrowthAutomationValidationIssue[]
  requiresHumanReview: boolean
  publishedMetadataOnly: true
  runtimeActivationEnabled: false
}

export type GrowthAutomationPublishReadinessResult = {
  ok: boolean
  publishReadiness: GrowthAutomationPublishReadinessStatus
  publishStatus: GrowthAutomationPublishStatus
  requiresHumanReview: boolean
  validationOk: boolean
  compileOk: boolean
  simulationOk: boolean
  publishWarnings: GrowthAutomationValidationIssue[]
  publishErrors: GrowthAutomationValidationIssue[]
  compileSummary: GrowthAutomationCompileSummary | null
  compileId: string | null
  simulationId: string | null
  simulationStatus: GrowthAutomationSimulationResult["status"] | null
  lastCompiledAt: string | null
  lastSimulatedAt: string | null
}

export type GrowthAutomationPublishStatusResult = {
  flow: GrowthAutomationFlow
  currentVersion: GrowthAutomationFlowVersion | null
  publishedVersion: GrowthAutomationFlowVersion | null
  versions: GrowthAutomationFlowVersion[]
  publishStatus: GrowthAutomationPublishStatus
  publishReadiness: GrowthAutomationPublishReadinessStatus
  requiresHumanReview: boolean
  lastCompiledAt: string | null
  compileSummary: GrowthAutomationCompileSummary | null
  publishWarnings: GrowthAutomationValidationIssue[]
  publishErrors: GrowthAutomationValidationIssue[]
  metadata: GrowthAutomationPublishMetadata | null
}

export type GrowthAutomationPublishResult = {
  ok: boolean
  flow: GrowthAutomationFlow
  publishedVersion: GrowthAutomationFlowVersion
  draftVersion: GrowthAutomationFlowVersion
  readiness: GrowthAutomationPublishReadinessResult
  metadata: GrowthAutomationPublishMetadata
}

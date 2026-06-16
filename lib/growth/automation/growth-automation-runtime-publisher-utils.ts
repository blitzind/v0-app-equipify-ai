/** Growth Engine S5-H — runtime publisher helpers (client-safe). */

import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationCompiledStepDraft } from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationRuntimeReconciliationResult } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"
import {
  GROWTH_AUTOMATION_RUNTIME_METADATA_KEY,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
  type GrowthAutomationRuntimeActivationStatus,
  type GrowthAutomationRuntimeFlowStatus,
  type GrowthAutomationRuntimeMetadata,
  type GrowthAutomationRuntimeStats,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-types"
import type {
  GrowthAutomationFlow,
  GrowthAutomationFlowStatus,
  GrowthAutomationFlowVersion,
} from "@/lib/growth/automation/growth-automation-types"

export function buildAutomationPatternKey(input: {
  flowId: string
  versionNumber: number
}): string {
  return `automation:${input.flowId}:v${input.versionNumber}`
}

export function resolveCompiledStepChannel(step: GrowthAutomationCompiledStepDraft): string {
  if (step.channel) return step.channel
  switch (step.nodeType) {
    case "action":
      return "manual_task"
    case "approval":
      return "manual_task"
    case "wait":
      return "manual_task"
    default:
      return "manual_task"
  }
}

export function extractRuntimeMetadata(
  canvasLayoutJson: Record<string, unknown>,
): GrowthAutomationRuntimeMetadata | null {
  const raw = canvasLayoutJson[GROWTH_AUTOMATION_RUNTIME_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as GrowthAutomationRuntimeMetadata
}

export function mergeRuntimeMetadataIntoCanvasLayout(input: {
  canvasLayoutJson: Record<string, unknown>
  metadata: GrowthAutomationRuntimeMetadata
}): Record<string, unknown> {
  return {
    ...input.canvasLayoutJson,
    [GROWTH_AUTOMATION_RUNTIME_METADATA_KEY]: input.metadata,
  }
}

export function buildInitialRuntimeMetadata(input: {
  compile: GrowthAutomationCompileResult
  reconciliation: GrowthAutomationRuntimeReconciliationResult
  requiresHumanReview: boolean
}): GrowthAutomationRuntimeMetadata {
  return {
    qaMarker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
    activationStatus: "published",
    compiledPatternId: null,
    compiledVersionId: input.compile.versionId,
    publishedArtifactVersion: null,
    lastPublishedAt: null,
    lastActivatedAt: null,
    lastPausedAt: null,
    reconciliationId: input.reconciliation.reconciliationId,
    compileId: input.compile.compileId,
    requiresHumanReview: input.requiresHumanReview,
    executionEnabled: false,
    runtimeStats: {
      stepCount: input.compile.stats.stepCount,
      conditionCount: input.compile.stats.conditionCount,
      edgeCount: input.compile.stats.edgeCount,
      waitCount: input.compile.stats.waitCount,
      patternStepCount: input.compile.stats.stepCount,
    },
    publishHistory: [],
  }
}

export function buildRuntimeStatsFromCompile(compile: GrowthAutomationCompileResult): GrowthAutomationRuntimeStats {
  return {
    stepCount: compile.stats.stepCount,
    conditionCount: compile.stats.conditionCount,
    edgeCount: compile.stats.edgeCount,
    waitCount: compile.stats.waitCount,
    patternStepCount: compile.stats.stepCount,
  }
}

export function resolveEffectiveFlowStatus(input: {
  flowStatus: GrowthAutomationFlowStatus
  activationStatus: GrowthAutomationRuntimeActivationStatus | null
}): GrowthAutomationRuntimeFlowStatus {
  if (input.flowStatus === "archived") return "archived"
  if (input.flowStatus === "draft") return "draft"
  if (input.activationStatus === "active") return "runtime_active"
  if (input.activationStatus === "paused") return "runtime_paused"
  return "published"
}

export function validateRuntimePublishGates(input: {
  reconciliation: GrowthAutomationRuntimeReconciliationResult
  compile: GrowthAutomationCompileResult
  version: GrowthAutomationFlowVersion
}): string[] {
  const blocked: string[] = []

  if (input.version.lifecycle !== "published") {
    blocked.push("version_not_published")
  }
  if (input.reconciliation.status !== "previewed") {
    blocked.push(`reconciliation_${input.reconciliation.status}`)
  }
  if (input.reconciliation.diff.riskLevel === "blocked") {
    blocked.push("reconciliation_blocked_risk")
  }
  if (input.compile.status !== "compiled") {
    blocked.push("compiler_failed")
  }
  if (input.reconciliation.errors.length > 0) {
    blocked.push("reconciliation_errors")
  }
  if (input.reconciliation.errors.some((issue) => issue.ruleCode === "send_action_missing_approval")) {
    blocked.push("send_action_missing_approval")
  }
  if (input.reconciliation.errors.some((issue) => issue.ruleCode === "trigger_source_changed")) {
    blocked.push("trigger_source_changed")
  }
  if (input.reconciliation.errors.some((issue) => issue.ruleCode === "validation_blocked")) {
    blocked.push("validation_blocked")
  }
  if (input.reconciliation.errors.some((issue) => issue.ruleCode === "compiler_blocked")) {
    blocked.push("compiler_blocked")
  }
  if (input.reconciliation.errors.some((issue) => issue.ruleCode === "simulation_blocked")) {
    blocked.push("simulation_blocked")
  }

  return blocked
}

export function validateRuntimeActivationGates(input: {
  metadata: GrowthAutomationRuntimeMetadata | null
  patternId: string | null
}): string[] {
  const blocked: string[] = []
  if (!input.patternId) blocked.push("missing_compiled_pattern")
  if (!input.metadata?.compiledPatternId) blocked.push("missing_runtime_metadata")
  if (input.metadata?.activationStatus !== "published" && input.metadata?.activationStatus !== "paused") {
    blocked.push(`activation_status_${input.metadata?.activationStatus ?? "missing"}`)
  }
  return blocked
}

export function canActivateRuntimeMetadata(metadata: GrowthAutomationRuntimeMetadata | null): boolean {
  return validateRuntimeActivationGates({ metadata, patternId: metadata?.compiledPatternId ?? null }).length === 0
}

export function canPauseRuntimeMetadata(metadata: GrowthAutomationRuntimeMetadata | null): boolean {
  return metadata?.activationStatus === "active" || metadata?.activationStatus === "published"
}

export function appendRuntimePublishHistory(
  metadata: GrowthAutomationRuntimeMetadata,
  entry: GrowthAutomationRuntimeMetadata["publishHistory"][number],
): GrowthAutomationRuntimeMetadata {
  return {
    ...metadata,
    publishHistory: [...metadata.publishHistory, entry].slice(-20),
  }
}

export function overlayFlowStatusForRuntime(
  flow: GrowthAutomationFlow,
  effectiveStatus: GrowthAutomationRuntimeFlowStatus,
): GrowthAutomationFlow {
  if (
    effectiveStatus === "runtime_active" ||
    effectiveStatus === "runtime_paused" ||
    effectiveStatus === flow.status
  ) {
    return { ...flow, status: effectiveStatus as GrowthAutomationFlowStatus }
  }
  return flow
}

/** Growth Engine S5-F — automation publish helpers (client-safe). */

import { compileAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-compiler-service"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import {
  GROWTH_AUTOMATION_PUBLISH_METADATA_KEY,
  GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
  type GrowthAutomationCompileSummary,
  type GrowthAutomationPublishMetadata,
  type GrowthAutomationPublishReadinessResult,
  type GrowthAutomationPublishStatus,
} from "@/lib/growth/automation/growth-automation-publish-types"
import { simulateAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-simulation-service"
import type {
  GrowthAutomationEdge,
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationNode,
  GrowthAutomationValidationIssue,
  GrowthAutomationValidationResult,
} from "@/lib/growth/automation/growth-automation-types"
import { validateAutomationGraph } from "@/lib/growth/automation/growth-automation-validation-service"

export function publishIssue(
  severity: GrowthAutomationValidationIssue["severity"],
  ruleCode: string,
  message: string,
  nodeId?: string | null,
): GrowthAutomationValidationIssue {
  return { severity, ruleCode, message, nodeId: nodeId ?? null }
}

export function extractPublishMetadata(
  canvasLayoutJson: Record<string, unknown>,
): GrowthAutomationPublishMetadata | null {
  const raw = canvasLayoutJson[GROWTH_AUTOMATION_PUBLISH_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as GrowthAutomationPublishMetadata
}

export function mergePublishMetadataIntoCanvasLayout(input: {
  canvasLayoutJson: Record<string, unknown>
  metadata: GrowthAutomationPublishMetadata
}): Record<string, unknown> {
  return {
    ...input.canvasLayoutJson,
    [GROWTH_AUTOMATION_PUBLISH_METADATA_KEY]: input.metadata,
  }
}

export function buildCompileSummary(compile: GrowthAutomationCompileResult): GrowthAutomationCompileSummary {
  return {
    compileId: compile.compileId,
    status: compile.status,
    stepCount: compile.stats.stepCount,
    conditionCount: compile.stats.conditionCount,
    edgeCount: compile.stats.edgeCount,
    waitCount: compile.stats.waitCount,
    safeExecutionGateCount: compile.stats.safeExecutionGateCount,
  }
}

export function graphHasActionNodes(nodes: GrowthAutomationNode[]): boolean {
  return nodes.some((node) => node.nodeType === "action")
}

export function mapFlowPublishStatus(flow: GrowthAutomationFlow): GrowthAutomationPublishStatus {
  if (flow.status === "runtime_active" || flow.status === "runtime_paused") {
    return "published"
  }
  return flow.status
}

export function evaluatePublishReadiness(input: {
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
  reconciliationPreview?: boolean
}): GrowthAutomationPublishReadinessResult {
  const publishWarnings: GrowthAutomationValidationIssue[] = []
  const publishErrors: GrowthAutomationValidationIssue[] = []
  const requiresHumanReview = graphHasActionNodes(input.nodes)
  const now = new Date().toISOString()

  const validation: GrowthAutomationValidationResult = validateAutomationGraph({
    nodes: input.nodes,
    edges: input.edges,
  })
  for (const issue of validation.warnings) publishWarnings.push(issue)
  for (const issue of validation.errors) publishErrors.push(issue)

  const compile = compileAutomationFlowGraph({
    flow: input.flow,
    version: input.version,
    nodes: input.nodes,
    edges: input.edges,
  })
  for (const issue of compile.warnings) publishWarnings.push(issue)
  for (const issue of compile.errors) publishErrors.push(issue)

  const simulation = simulateAutomationFlowGraph({
    flow: input.flow,
    version: input.version,
    nodes: input.nodes,
    edges: input.edges,
    simulationInput: { scenario: "immediate" },
  })
  for (const issue of simulation.warnings) {
    publishWarnings.push(publishIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }
  for (const issue of simulation.errors) {
    publishErrors.push(publishIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }

  if (requiresHumanReview) {
    publishWarnings.push(
      publishIssue(
        "warning",
        "human_review_required",
        "Action nodes present — human review required before future runtime activation.",
      ),
    )
  }

  const validationOk = validation.ok && validation.errors.length === 0
  const compileOk = compile.status === "compiled" && compile.errors.length === 0
  const simulationOk = simulation.status === "simulated" && simulation.errors.length === 0
  const ok = validationOk && compileOk && simulationOk && publishErrors.length === 0

  if (!validationOk) {
    publishErrors.push(
      publishIssue("error", "validation_blocked", "Publish blocked until validation errors are resolved."),
    )
  }
  if (!compileOk) {
    publishErrors.push(
      publishIssue("error", "compiler_blocked", "Publish blocked until compile preview succeeds."),
    )
  }
  if (!simulationOk) {
    publishErrors.push(
      publishIssue("error", "simulation_blocked", "Publish blocked until simulation preview succeeds."),
    )
  }
  if (!input.reconciliationPreview && input.version.lifecycle !== "draft") {
    publishErrors.push(
      publishIssue("error", "version_not_draft", "Only draft versions can be published."),
    )
  }
  if (!input.reconciliationPreview && input.flow.status === "archived") {
    publishErrors.push(publishIssue("error", "flow_archived", "Archived flows cannot be published."))
  }

  return {
    ok,
    publishReadiness: ok ? "ready" : "blocked",
    publishStatus: mapFlowPublishStatus(input.flow),
    requiresHumanReview,
    validationOk,
    compileOk,
    simulationOk,
    publishWarnings,
    publishErrors,
    compileSummary: compileOk ? buildCompileSummary(compile) : buildCompileSummary(compile),
    compileId: compile.compileId,
    simulationId: simulation.simulationId,
    simulationStatus: simulation.status,
    lastCompiledAt: compile.createdAt ?? now,
    lastSimulatedAt: simulation.createdAt ?? now,
  }
}

export function buildPublishMetadata(
  readiness: GrowthAutomationPublishReadinessResult,
): GrowthAutomationPublishMetadata {
  return {
    qaMarker: GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
    publishReadiness: readiness.publishReadiness,
    lastCompiledAt: readiness.lastCompiledAt ?? new Date().toISOString(),
    lastSimulatedAt: readiness.lastSimulatedAt,
    compileSummary: readiness.compileSummary,
    compileId: readiness.compileId,
    simulationId: readiness.simulationId,
    simulationStatus: readiness.simulationStatus,
    publishWarnings: readiness.publishWarnings,
    publishErrors: readiness.publishErrors,
    requiresHumanReview: readiness.requiresHumanReview,
    publishedMetadataOnly: true,
    runtimeActivationEnabled: false,
  }
}

/** Growth Engine S5-G — runtime reconciliation helpers (client-safe). */

import { randomUUID } from "node:crypto"
import { compileAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-compiler-service"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import {
  GROWTH_AUTOMATION_RUNTIME_ARTIFACT_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
  type GrowthAutomationRuntimeArtifactPreview,
} from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import {
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
  type GrowthAutomationRuntimeReconciliationCleanupPlanItem,
  type GrowthAutomationRuntimeReconciliationDiff,
  type GrowthAutomationRuntimeReconciliationPlanItem,
  type GrowthAutomationRuntimeReconciliationResult,
  type GrowthAutomationRuntimeReconciliationRiskLevel,
  type GrowthAutomationRuntimeReconciliationRollbackPlanItem,
  type GrowthAutomationRuntimeReconciliationStatus,
} from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"
import { evaluatePublishReadiness, extractPublishMetadata } from "@/lib/growth/automation/growth-automation-publish-utils"
import { simulateAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-simulation-service"
import type {
  GrowthAutomationEdge,
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationNode,
  GrowthAutomationValidationIssue,
} from "@/lib/growth/automation/growth-automation-types"
import { isSendAutomationActionConfig } from "@/lib/growth/automation/growth-automation-types"
import { hasUpstreamApprovalNode } from "@/lib/growth/automation/growth-automation-compiler-utils"

export function reconciliationIssue(
  severity: GrowthAutomationValidationIssue["severity"],
  ruleCode: string,
  message: string,
  nodeId?: string | null,
): GrowthAutomationValidationIssue {
  return { severity, ruleCode, message, nodeId: nodeId ?? null }
}

export function buildSemanticNodeKey(node: GrowthAutomationNode): string {
  const config = node.configJson
  switch (node.nodeType) {
    case "trigger":
      return `trigger:${String(config.triggerSource ?? node.label).trim()}`
    case "action":
      return `action:${String(config.actionType ?? "unknown").trim()}:${node.label.trim()}`
    case "condition":
    case "branch":
      return `condition:${String(config.source ?? "")}.${String(config.event ?? "")}:${node.label.trim()}`
    case "wait":
      return `wait:${String(config.waitKind ?? "duration")}:${String(config.durationSeconds ?? "")}:${String(config.waitedForEvent ?? "")}`
    case "approval":
      return `approval:${node.label.trim()}`
    case "exit":
      return `exit:${String(config.canvasNodeType ?? "exit")}:${node.label.trim()}`
    default:
      return `${node.nodeType}:${node.label.trim()}`
  }
}

export function buildSemanticEdgeKey(
  edge: GrowthAutomationEdge,
  nodesById: Map<string, GrowthAutomationNode>,
): string {
  const from = nodesById.get(edge.fromNodeId)
  const to = nodesById.get(edge.toNodeId)
  const fromKey = from ? buildSemanticNodeKey(from) : edge.fromNodeId
  const toKey = to ? buildSemanticNodeKey(to) : edge.toNodeId
  return `${fromKey}->${toKey}:${edge.edgeType}`
}

function stableConfigSignature(config: Record<string, unknown>): string {
  return JSON.stringify(config, Object.keys(config).sort())
}

export function computeRuntimeReconciliationDiff(input: {
  baselineNodes: GrowthAutomationNode[]
  baselineEdges: GrowthAutomationEdge[]
  candidateNodes: GrowthAutomationNode[]
  candidateEdges: GrowthAutomationEdge[]
}): GrowthAutomationRuntimeReconciliationDiff {
  const baselineNodeMap = new Map(input.baselineNodes.map((node) => [buildSemanticNodeKey(node), node]))
  const candidateNodeMap = new Map(input.candidateNodes.map((node) => [buildSemanticNodeKey(node), node]))
  const baselineNodesById = new Map(input.baselineNodes.map((node) => [node.id, node]))
  const candidateNodesById = new Map(input.candidateNodes.map((node) => [node.id, node]))

  const nodesAdded = [...candidateNodeMap.keys()].filter((key) => !baselineNodeMap.has(key))
  const nodesRemoved = [...baselineNodeMap.keys()].filter((key) => !candidateNodeMap.has(key))
  const nodesChanged = [...candidateNodeMap.entries()]
    .filter(([key, node]) => {
      const baseline = baselineNodeMap.get(key)
      return baseline ? stableConfigSignature(baseline.configJson) !== stableConfigSignature(node.configJson) : false
    })
    .map(([key]) => key)

  const baselineEdgeMap = new Map(
    input.baselineEdges.map((edge) => [buildSemanticEdgeKey(edge, baselineNodesById), edge]),
  )
  const candidateEdgeMap = new Map(
    input.candidateEdges.map((edge) => [buildSemanticEdgeKey(edge, candidateNodesById), edge]),
  )

  const edgesAdded = [...candidateEdgeMap.keys()].filter((key) => !baselineEdgeMap.has(key))
  const edgesRemoved = [...baselineEdgeMap.keys()].filter((key) => !candidateEdgeMap.has(key))
  const edgesChanged: string[] = []

  const baselineTrigger = input.baselineNodes.find((node) => node.nodeType === "trigger")
  const candidateTrigger = input.candidateNodes.find((node) => node.nodeType === "trigger")
  const baselineTriggerSource =
    typeof baselineTrigger?.configJson.triggerSource === "string" ? baselineTrigger.configJson.triggerSource : null
  const candidateTriggerSource =
    typeof candidateTrigger?.configJson.triggerSource === "string" ? candidateTrigger.configJson.triggerSource : null
  const triggersChanged =
    baselineTriggerSource && candidateTriggerSource && baselineTriggerSource !== candidateTriggerSource
      ? [`${baselineTriggerSource} -> ${candidateTriggerSource}`]
      : baselineTriggerSource !== candidateTriggerSource && (baselineTriggerSource || candidateTriggerSource)
        ? [`${baselineTriggerSource ?? "none"} -> ${candidateTriggerSource ?? "none"}`]
        : []

  const actionsChanged = [...candidateNodeMap.entries()]
    .filter(([key, node]) => node.nodeType === "action")
    .filter(([key]) => !baselineNodeMap.has(key) || nodesChanged.includes(key))
    .map(([key]) => key)

  const conditionsChanged = [...candidateNodeMap.entries()]
    .filter(([, node]) => node.nodeType === "condition" || node.nodeType === "branch")
    .filter(([key]) => nodesAdded.includes(key) || nodesRemoved.includes(key) || nodesChanged.includes(key))
    .map(([key]) => key)

  const waitsChanged = [...candidateNodeMap.entries()]
    .filter(([, node]) => node.nodeType === "wait")
    .filter(([key]) => nodesAdded.includes(key) || nodesRemoved.includes(key) || nodesChanged.includes(key))
    .map(([key]) => key)

  const approvalGatesChanged = [...candidateNodeMap.entries()]
    .filter(([, node]) => node.nodeType === "approval")
    .filter(([key]) => nodesAdded.includes(key) || nodesRemoved.includes(key) || nodesChanged.includes(key))
    .map(([key]) => key)

  const requiresHumanReview = input.candidateNodes.some((node) => node.nodeType === "action")
  let riskLevel: GrowthAutomationRuntimeReconciliationRiskLevel = "low"

  if (nodesAdded.length + nodesRemoved.length + nodesChanged.length + edgesAdded.length + edgesRemoved.length === 0) {
    riskLevel = "low"
  } else if (triggersChanged.length > 0) {
    riskLevel = "high"
  } else if (actionsChanged.length > 0 || approvalGatesChanged.length > 0) {
    riskLevel = "medium"
  } else if (conditionsChanged.length > 0 || waitsChanged.length > 0 || edgesAdded.length + edgesRemoved.length > 0) {
    riskLevel = "medium"
  }

  return {
    nodesAdded,
    nodesRemoved,
    nodesChanged,
    edgesAdded,
    edgesRemoved,
    edgesChanged,
    triggersChanged,
    actionsChanged,
    conditionsChanged,
    waitsChanged,
    approvalGatesChanged,
    riskLevel,
    requiresHumanReview,
  }
}

export function buildRuntimeArtifactPreview(input: {
  compile: GrowthAutomationCompileResult
  diff: GrowthAutomationRuntimeReconciliationDiff
  previousPublishedVersionId: string | null
}): GrowthAutomationRuntimeArtifactPreview | null {
  if (input.compile.status !== "compiled" || !input.compile.compiledPatternDraft) return null

  const approvalGates = input.compile.compiledSteps
    .filter((step) => step.safeExecutionGate)
    .map((step) => ({
      artifactKind: "approval_gate",
      previewId: step.draftStepId,
      sourceNodeId: step.automationNodeId,
      summary: `Approval gate for ${step.label}`,
      writeEnabled: false as const,
    }))

  const actionGuards = input.compile.compiledSteps
    .filter((step) => step.actionType)
    .map((step) => ({
      artifactKind: "action_guard",
      previewId: step.draftStepId,
      sourceNodeId: step.automationNodeId,
      summary: `${step.actionType} requiresHumanApproval=${step.requiresHumanApproval}`,
      writeEnabled: false as const,
    }))

  const cleanupPlan = input.diff.nodesRemoved.map((semanticKey) => ({
    artifactKind: "pattern_step",
    previewId: `cleanup:${semanticKey}`,
    reason: `Removed node ${semanticKey} would archive preview artifact`,
    action: "archive_preview" as const,
  }))

  const rollbackPlan: GrowthAutomationRuntimeReconciliationRollbackPlanItem[] = input.previousPublishedVersionId
    ? [
        {
          step: 1,
          action: "retain_published_version_metadata",
          targetVersionId: input.previousPublishedVersionId,
          detail: "Keep published version metadata as rollback anchor.",
        },
        {
          step: 2,
          action: "discard_candidate_runtime_preview",
          targetVersionId: input.compile.versionId,
          detail: "Discard candidate runtime preview without SR-3 writes.",
        },
      ]
    : [
        {
          step: 1,
          action: "discard_first_publish_preview",
          targetVersionId: null,
          detail: "No published version exists; rollback clears preview only.",
        },
      ]

  return {
    qaMarker: GROWTH_AUTOMATION_RUNTIME_ARTIFACT_QA_MARKER,
    compileId: input.compile.compileId,
    previewOnly: true,
    writeEnabled: false,
    pattern: input.compile.compiledPatternDraft,
    steps: input.compile.compiledSteps,
    conditions: input.compile.compiledConditions,
    edges: input.compile.compiledEdges,
    waits: input.compile.compiledWaits,
    approvalGates,
    actionGuards,
    triggerBindings: [
      {
        triggerKey: input.compile.compiledPatternDraft.entryTrigger.triggerKey,
        conditionSource: input.compile.compiledPatternDraft.entryTrigger.conditionSource,
        conditionEvent: input.compile.compiledPatternDraft.entryTrigger.conditionEvent,
      },
    ],
    publishDiff: input.diff,
    cleanupPlan,
    rollbackPlan,
    safety: GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
  }
}

export function buildReconciliationPlans(input: {
  compile: GrowthAutomationCompileResult
  diff: GrowthAutomationRuntimeReconciliationDiff
  candidateNodes: GrowthAutomationNode[]
  baselineNodeCount: number
}): {
  createPlan: GrowthAutomationRuntimeReconciliationPlanItem[]
  updatePlan: GrowthAutomationRuntimeReconciliationPlanItem[]
  archivePlan: GrowthAutomationRuntimeReconciliationPlanItem[]
  cleanupPlan: GrowthAutomationRuntimeReconciliationCleanupPlanItem[]
} {
  const createPlan: GrowthAutomationRuntimeReconciliationPlanItem[] = []
  const updatePlan: GrowthAutomationRuntimeReconciliationPlanItem[] = []
  const archivePlan: GrowthAutomationRuntimeReconciliationPlanItem[] = []

  if (input.compile.compiledPatternDraft) {
    createPlan.push({
      artifactKind: "sequence_pattern",
      previewId: `pattern:${input.compile.compileId}`,
      semanticKey: input.compile.compiledPatternDraft.entryTrigger.triggerKey,
      summary: `Preview create pattern for ${input.compile.compiledPatternDraft.flowName}`,
      writeEnabled: false,
    })
  }

  const nodesById = new Map(input.candidateNodes.map((node) => [node.id, node]))
  const isFirstPublish = input.baselineNodeCount === 0

  for (const step of input.compile.compiledSteps) {
    const node = nodesById.get(step.automationNodeId)
    const semanticKey = node ? buildSemanticNodeKey(node) : step.draftStepId
    const item = {
      artifactKind: "pattern_step",
      previewId: step.draftStepId,
      semanticKey,
      summary: step.label,
      writeEnabled: false as const,
    }
    if (isFirstPublish || input.diff.nodesAdded.includes(semanticKey)) {
      createPlan.push(item)
    } else if (
      input.diff.nodesChanged.includes(semanticKey) ||
      input.diff.actionsChanged.includes(semanticKey) ||
      input.diff.nodesRemoved.includes(semanticKey)
    ) {
      updatePlan.push(item)
    } else if (input.diff.nodesRemoved.length === 0 && input.diff.nodesAdded.length === 0) {
      updatePlan.push(item)
    } else {
      createPlan.push(item)
    }
  }

  for (const removed of input.diff.nodesRemoved) {
    archivePlan.push({
      artifactKind: "pattern_step",
      previewId: `archive:${removed}`,
      semanticKey: removed,
      summary: `Preview archive removed node ${removed}`,
      writeEnabled: false,
    })
  }

  const cleanupPlan = input.diff.nodesRemoved.map((semanticKey) => ({
    artifactKind: "pattern_step",
    previewId: `cleanup:${semanticKey}`,
    semanticKey,
    reason: `Cleanup preview artifact for removed node ${semanticKey}`,
    action: "archive_preview" as const,
  }))

  return { createPlan, updatePlan, archivePlan, cleanupPlan }
}

export function buildRuntimeRollbackPlan(input: {
  previousPublishedVersionId: string | null
  candidateVersionId: string
}): GrowthAutomationRuntimeReconciliationRollbackPlanItem[] {
  if (input.previousPublishedVersionId) {
    return [
      {
        step: 1,
        action: "retain_published_version_metadata",
        targetVersionId: input.previousPublishedVersionId,
        detail: "Keep published version metadata as rollback anchor.",
      },
      {
        step: 2,
        action: "discard_candidate_runtime_preview",
        targetVersionId: input.candidateVersionId,
        detail: "Discard candidate runtime preview without SR-3 writes.",
      },
    ]
  }

  return [
    {
      step: 1,
      action: "discard_first_publish_preview",
      targetVersionId: null,
      detail: "No published version exists; rollback clears preview only.",
    },
  ]
}

function detectBlockedSendActions(
  nodes: GrowthAutomationNode[],
  edges: GrowthAutomationEdge[],
): GrowthAutomationValidationIssue[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const issues: GrowthAutomationValidationIssue[] = []
  for (const node of nodes) {
    if (node.nodeType !== "action" || !isSendAutomationActionConfig(node.configJson)) continue
    if (!hasUpstreamApprovalNode(node.id, nodesById, edges)) {
      issues.push(
        reconciliationIssue(
          "error",
          "send_action_missing_approval",
          "Send action requires upstream approval before runtime publish preview.",
          node.id,
        ),
      )
    }
  }
  return issues
}

export function reconcileAutomationRuntimePreview(input: {
  reconciliationId?: string
  flow: GrowthAutomationFlow
  candidateVersion: GrowthAutomationFlowVersion
  candidateNodes: GrowthAutomationNode[]
  candidateEdges: GrowthAutomationEdge[]
  previousPublishedVersion?: GrowthAutomationFlowVersion | null
  previousNodes?: GrowthAutomationNode[]
  previousEdges?: GrowthAutomationEdge[]
}): GrowthAutomationRuntimeReconciliationResult {
  const reconciliationId = input.reconciliationId ?? randomUUID()
  const createdAt = new Date().toISOString()
  const warnings: GrowthAutomationValidationIssue[] = []
  const errors: GrowthAutomationValidationIssue[] = []

  const readiness = evaluatePublishReadiness({
    flow: input.flow,
    version: input.candidateVersion,
    nodes: input.candidateNodes,
    edges: input.candidateEdges,
    reconciliationPreview: true,
  })
  for (const issue of readiness.publishWarnings) warnings.push(issue)
  for (const issue of readiness.publishErrors) errors.push(issue)

  const candidateCompile = compileAutomationFlowGraph({
    flow: input.flow,
    version: input.candidateVersion,
    nodes: input.candidateNodes,
    edges: input.candidateEdges,
  })
  for (const issue of candidateCompile.warnings) {
    warnings.push(reconciliationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }
  for (const issue of candidateCompile.errors) {
    errors.push(reconciliationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }

  const simulation = simulateAutomationFlowGraph({
    flow: input.flow,
    version: input.candidateVersion,
    nodes: input.candidateNodes,
    edges: input.candidateEdges,
    simulationInput: { scenario: "immediate" },
  })
  for (const issue of simulation.warnings) {
    warnings.push(reconciliationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }
  for (const issue of simulation.errors) {
    errors.push(reconciliationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }

  errors.push(...detectBlockedSendActions(input.candidateNodes, input.candidateEdges))

  const baselineNodes = input.previousNodes ?? []
  const baselineEdges = input.previousEdges ?? []
  const diff = computeRuntimeReconciliationDiff({
    baselineNodes,
    baselineEdges,
    candidateNodes: input.candidateNodes,
    candidateEdges: input.candidateEdges,
  })

  if (input.previousPublishedVersion && diff.triggersChanged.length > 0) {
    errors.push(
      reconciliationIssue(
        "error",
        "trigger_source_changed",
        "Trigger source changed on a published flow — runtime preview blocked.",
      ),
    )
    diff.riskLevel = "blocked"
  }

  if (!readiness.validationOk) {
    errors.push(reconciliationIssue("error", "validation_blocked", "Validation errors block runtime preview."))
    diff.riskLevel = "blocked"
  }
  if (!readiness.compileOk || candidateCompile.status !== "compiled") {
    errors.push(reconciliationIssue("error", "compiler_blocked", "Compiler errors block runtime preview."))
    diff.riskLevel = "blocked"
  }
  if (!readiness.simulationOk || simulation.status !== "simulated") {
    errors.push(reconciliationIssue("error", "simulation_blocked", "Simulation errors block runtime preview."))
    diff.riskLevel = "blocked"
  }

  if (errors.some((issue) => issue.ruleCode === "send_action_missing_approval")) {
    diff.riskLevel = "blocked"
  }

  const plans = buildReconciliationPlans({
    compile: candidateCompile,
    diff,
    candidateNodes: input.candidateNodes,
    baselineNodeCount: baselineNodes.length,
  })
  const rollbackPlan = buildRuntimeRollbackPlan({
    previousPublishedVersionId: input.previousPublishedVersion?.id ?? null,
    candidateVersionId: input.candidateVersion.id,
  })

  const artifactPreview = buildRuntimeArtifactPreview({
    compile: candidateCompile,
    diff,
    previousPublishedVersionId: input.previousPublishedVersion?.id ?? null,
  })

  if (input.previousPublishedVersion) {
    const previousMetadata = extractPublishMetadata(input.previousPublishedVersion.canvasLayoutJson)
    if (!previousMetadata?.compileSummary) {
      warnings.push(
        reconciliationIssue(
          "warning",
          "missing_prior_compile_metadata",
          "Published version is missing S5-F compile metadata; diff confidence reduced.",
        ),
      )
    }
  }

  let status: GrowthAutomationRuntimeReconciliationStatus = "previewed"
  if (errors.length > 0 && diff.riskLevel === "blocked") status = "blocked"
  else if (errors.length > 0) status = "failed"
  else if (!artifactPreview) status = "failed"

  return {
    reconciliationId,
    flowId: input.flow.id,
    versionId: input.candidateVersion.id,
    previousPublishedVersionId: input.previousPublishedVersion?.id ?? null,
    candidateVersionId: input.candidateVersion.id,
    status,
    diff,
    createPlan: plans.createPlan,
    updatePlan: plans.updatePlan,
    archivePlan: plans.archivePlan,
    cleanupPlan: plans.cleanupPlan,
    rollbackPlan,
    warnings,
    errors,
    artifactPreview,
    safety: GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
    createdAt,
  }
}

export { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER }

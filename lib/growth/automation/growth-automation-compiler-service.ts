/** Growth Engine S5-D — automation flow → SR-3 compile preview engine (client-safe). */

import { randomUUID } from "node:crypto"
import {
  GROWTH_AUTOMATION_COMPILER_QA_MARKER,
  GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS,
  type GrowthAutomationCompileResult,
} from "@/lib/growth/automation/growth-automation-compiler-types"
import {
  actionTypeToChannel,
  buildConditionSpecFromNode,
  compileIssue,
  draftId,
  hasUpstreamApprovalNode,
  isSendCompilerAction,
  isSupportedCompilerAction,
  mapTriggerSourceToEntryTrigger,
  topologicalStepOrder,
} from "@/lib/growth/automation/growth-automation-compiler-utils"
import { parseSequenceConditionSpec } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import type {
  GrowthAutomationEdge,
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationNode,
} from "@/lib/growth/automation/growth-automation-types"
import { validateAutomationGraph } from "@/lib/growth/automation/growth-automation-validation-service"

export function compileAutomationFlowGraph(input: {
  compileId?: string
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
}): GrowthAutomationCompileResult {
  const compileId = input.compileId ?? randomUUID()
  const createdAt = new Date().toISOString()
  const warnings: GrowthAutomationCompileResult["warnings"] = []
  const errors: GrowthAutomationCompileResult["errors"] = []
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]))

  const validation = validateAutomationGraph({ nodes: input.nodes, edges: input.edges })
  for (const issue of validation.warnings) {
    warnings.push(
      compileIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId),
    )
  }
  for (const issue of validation.errors) {
    errors.push(
      compileIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId),
    )
  }

  if (!validation.ok) {
    return {
      compileId,
      flowId: input.flow.id,
      versionId: input.version.id,
      status: "failed",
      compiledPatternDraft: null,
      compiledSteps: [],
      compiledConditions: [],
      compiledEdges: [],
      compiledWaits: [],
      warnings,
      errors,
      safety: GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS,
      createdAt,
      stats: {
        stepCount: 0,
        conditionCount: 0,
        edgeCount: 0,
        waitCount: 0,
        safeExecutionGateCount: 0,
      },
    }
  }

  const triggerNode = input.nodes.find((node) => node.nodeType === "trigger")
  if (!triggerNode) {
    errors.push(compileIssue("error", "missing_trigger", "Compile requires exactly one trigger node."))
    return failedCompileResult(compileId, input, warnings, errors, createdAt)
  }

  const triggerSource =
    typeof triggerNode.configJson.triggerSource === "string"
      ? triggerNode.configJson.triggerSource.trim()
      : ""
  const entry = mapTriggerSourceToEntryTrigger(triggerSource)
  if (entry.error) {
    errors.push(
      compileIssue("error", "unsupported_trigger", entry.error, triggerNode.id),
    )
  } else if (entry.conditionSource && entry.conditionEvent) {
    const parsed = parseSequenceConditionSpec({
      dslVersion: 1,
      source: entry.conditionSource,
      event: entry.conditionEvent,
    })
    if (!parsed.ok) {
      errors.push(
        compileIssue("error", "invalid_trigger_spec", parsed.message, triggerNode.id),
      )
    }
  }

  const stepOrderIds = topologicalStepOrder(triggerNode.id, input.edges, nodesById)
  const nodeToDraftStepId = new Map<string, string>()
  const nodeToDraftConditionId = new Map<string, string>()
  const compiledSteps: GrowthAutomationCompileResult["compiledSteps"] = []
  const compiledConditions: GrowthAutomationCompileResult["compiledConditions"] = []
  const compiledWaits: GrowthAutomationCompileResult["compiledWaits"] = []

  stepOrderIds.forEach((nodeId, index) => {
    const node = nodesById.get(nodeId)
    if (!node) return
    const draftStepId = draftId("step", node.id)
    nodeToDraftStepId.set(node.id, draftStepId)

    if (node.nodeType === "condition" || node.nodeType === "branch") {
      const built = buildConditionSpecFromNode(node)
      if (!built.spec) {
        errors.push(
          compileIssue(
            "error",
            "invalid_condition_config",
            built.error ?? "Invalid condition node config.",
            node.id,
          ),
        )
      } else {
        const draftConditionId = draftId("cond", node.id)
        nodeToDraftConditionId.set(node.id, draftConditionId)
        compiledConditions.push({
          draftConditionId,
          automationNodeId: node.id,
          conditionKey: `${built.spec.source}.${built.spec.event}`,
          spec: built.spec,
        })
      }
    }

    if (node.nodeType === "wait") {
      const waitKind =
        typeof node.configJson.waitKind === "string" ? node.configJson.waitKind : "duration"
      const durationSeconds =
        typeof node.configJson.durationSeconds === "number" ? node.configJson.durationSeconds : null
      const waitedForSource =
        typeof node.configJson.waitedForSource === "string" ? node.configJson.waitedForSource : null
      const waitedForEvent =
        typeof node.configJson.waitedForEvent === "string" ? node.configJson.waitedForEvent : null
      const timeoutEdge = input.edges.find(
        (edge) => edge.fromNodeId === node.id && edge.edgeType === "timeout",
      )
      compiledWaits.push({
        draftWaitId: draftId("wait", node.id),
        automationNodeId: node.id,
        waitKind:
          waitKind === "until_event" || waitKind === "condition" ? waitKind : "duration",
        durationSeconds,
        waitedForSource: waitedForSource as GrowthAutomationCompileResult["compiledWaits"][number]["waitedForSource"],
        waitedForEvent: waitedForEvent as GrowthAutomationCompileResult["compiledWaits"][number]["waitedForEvent"],
        conditionDraftId: nodeToDraftConditionId.get(node.id) ?? null,
        timeoutEdgeDraftId: timeoutEdge ? draftId("edge", timeoutEdge.id) : null,
      })
    }

    const actionType =
      node.nodeType === "action" && typeof node.configJson.actionType === "string"
        ? node.configJson.actionType.trim()
        : null

    if (node.nodeType === "action" && actionType) {
      if (!isSupportedCompilerAction(actionType)) {
        warnings.push(
          compileIssue(
            "warning",
            "unsupported_action",
            `Action type ${actionType} is not in the supported compile palette.`,
            node.id,
          ),
        )
      }
      if (isSendCompilerAction(actionType) && !hasUpstreamApprovalNode(node.id, nodesById, input.edges)) {
        errors.push(
          compileIssue(
            "error",
            "send_action_missing_approval",
            "Send actions require an approval node upstream before compile.",
            node.id,
          ),
        )
      }
    }

    const isTerminal = node.nodeType === "exit" || node.configJson.canvasNodeType === "goal"
    const isApproval = node.nodeType === "approval"

    compiledSteps.push({
      draftStepId,
      automationNodeId: node.id,
      nodeType: node.nodeType,
      label: node.label,
      stepOrder: index + 1,
      channel: actionType ? actionTypeToChannel(actionType) : null,
      actionType,
      requiresHumanApproval: true,
      executionEnabled: false,
      safeExecutionGate: isApproval,
      terminal: isTerminal,
      metadata: {
        qa_marker: GROWTH_AUTOMATION_COMPILER_QA_MARKER,
        config: node.configJson,
        compilePreviewOnly: true,
      },
    })
  })

  const compiledEdges: GrowthAutomationCompileResult["compiledEdges"] = []
  for (const edge of input.edges) {
    const fromDraftStepId = nodeToDraftStepId.get(edge.fromNodeId)
    const toDraftStepId = nodeToDraftStepId.get(edge.toNodeId)
    if (!fromDraftStepId || !toDraftStepId) {
      errors.push(
        compileIssue("error", "missing_edge_step", "Edge references a node without a compiled step.", edge.fromNodeId),
      )
      continue
    }
    const fromNode = nodesById.get(edge.fromNodeId)
    compiledEdges.push({
      draftEdgeId: draftId("edge", edge.id),
      automationEdgeId: edge.id,
      fromDraftStepId,
      toDraftStepId,
      edgeType: edge.edgeType,
      conditionDraftId:
        fromNode && (fromNode.nodeType === "condition" || fromNode.nodeType === "branch")
          ? nodeToDraftConditionId.get(fromNode.id) ?? null
          : null,
      priority: edge.priority,
      label: null,
    })
  }

  const compiledPatternDraft =
    errors.length === 0
      ? {
          flowId: input.flow.id,
          versionId: input.version.id,
          organizationId: input.flow.organizationId,
          flowName: input.flow.name,
          previewOnly: true as const,
          writeEnabled: false as const,
          entryTrigger: {
            triggerKey: entry.triggerKey,
            conditionSource: entry.conditionSource,
            conditionEvent: entry.conditionEvent,
            ...(entry.enrollmentMode ? { enrollmentMode: entry.enrollmentMode } : {}),
          },
        }
      : null

  const safeExecutionGateCount = compiledSteps.filter((step) => step.safeExecutionGate).length

  return {
    compileId,
    flowId: input.flow.id,
    versionId: input.version.id,
    status: errors.length === 0 ? "compiled" : "failed",
    compiledPatternDraft,
    compiledSteps,
    compiledConditions,
    compiledEdges,
    compiledWaits,
    warnings,
    errors,
    safety: GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS,
    createdAt,
    stats: {
      stepCount: compiledSteps.length,
      conditionCount: compiledConditions.length,
      edgeCount: compiledEdges.length,
      waitCount: compiledWaits.length,
      safeExecutionGateCount,
    },
  }
}

function failedCompileResult(
  compileId: string,
  input: {
    flow: GrowthAutomationFlow
    version: GrowthAutomationFlowVersion
  },
  warnings: GrowthAutomationCompileResult["warnings"],
  errors: GrowthAutomationCompileResult["errors"],
  createdAt: string,
): GrowthAutomationCompileResult {
  return {
    compileId,
    flowId: input.flow.id,
    versionId: input.version.id,
    status: "failed",
    compiledPatternDraft: null,
    compiledSteps: [],
    compiledConditions: [],
    compiledEdges: [],
    compiledWaits: [],
    warnings,
    errors,
    safety: GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS,
    createdAt,
    stats: {
      stepCount: 0,
      conditionCount: 0,
      edgeCount: 0,
      waitCount: 0,
      safeExecutionGateCount: 0,
    },
  }
}

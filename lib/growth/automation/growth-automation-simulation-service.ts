/** Growth Engine S5-E — automation flow simulation engine (client-safe). */

import { randomUUID } from "node:crypto"
import { compileAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-compiler-service"
import {
  GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
  GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
  type GrowthAutomationSimulationInput,
  type GrowthAutomationSimulationResult,
} from "@/lib/growth/automation/growth-automation-simulation-types"
import {
  appendTimelineEntry,
  buildDraftConditionIdMap,
  buildDraftStepIdMap,
  evaluateSimulationConditionOutcome,
  isSupportedSimulationAction,
  isTerminalAutomationNode,
  normalizeSimulationInput,
  pickDefaultOutgoingEdge,
  resolveSimulationBranchDecision,
  resolveSimulationWaitTransition,
  simulationIssue,
} from "@/lib/growth/automation/growth-automation-simulation-utils"
import type {
  GrowthAutomationEdge,
  GrowthAutomationFlow,
  GrowthAutomationFlowVersion,
  GrowthAutomationNode,
} from "@/lib/growth/automation/growth-automation-types"
import { validateAutomationGraph } from "@/lib/growth/automation/growth-automation-validation-service"

export function simulateAutomationFlowGraph(input: {
  simulationId?: string
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
  simulationInput?: GrowthAutomationSimulationInput
}): GrowthAutomationSimulationResult {
  const simulationId = input.simulationId ?? randomUUID()
  const createdAt = new Date().toISOString()
  const startMs = Date.now()
  const simulationInput = normalizeSimulationInput(input.simulationInput)
  const warnings: GrowthAutomationSimulationResult["warnings"] = []
  const errors: GrowthAutomationSimulationResult["errors"] = []
  const timeline: GrowthAutomationSimulationResult["timeline"] = []
  const executedNodes: GrowthAutomationSimulationResult["executedNodes"] = []
  const executedEdges: GrowthAutomationSimulationResult["executedEdges"] = []
  const waitStates: GrowthAutomationSimulationResult["waitStates"] = []
  const branchDecisions: GrowthAutomationSimulationResult["branchDecisions"] = []
  const approvalGates: GrowthAutomationSimulationResult["approvalGates"] = []

  const validation = validateAutomationGraph({ nodes: input.nodes, edges: input.edges })
  for (const issue of validation.warnings) {
    warnings.push(simulationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }
  for (const issue of validation.errors) {
    errors.push(simulationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }

  const compile = compileAutomationFlowGraph({
    compileId: randomUUID(),
    flow: input.flow,
    version: input.version,
    nodes: input.nodes,
    edges: input.edges,
  })
  for (const issue of compile.warnings) {
    warnings.push(simulationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }
  for (const issue of compile.errors) {
    errors.push(simulationIssue(issue.severity, issue.ruleCode, issue.message, issue.nodeId))
  }

  if (!validation.ok || compile.status !== "compiled") {
    return failedSimulation({
      simulationId,
      flowId: input.flow.id,
      versionId: input.version.id,
      entryNodeId: null,
      warnings,
      errors,
      timeline,
      createdAt,
      compileId: compile.compileId,
    })
  }

  const nodesById = new Map(input.nodes.map((node) => [node.id, node]))
  const edgesByFrom = new Map<string, GrowthAutomationEdge[]>()
  for (const edge of input.edges) {
    const bucket = edgesByFrom.get(edge.fromNodeId) ?? []
    bucket.push(edge)
    edgesByFrom.set(edge.fromNodeId, bucket)
  }

  const triggerNode = input.nodes.find((node) => node.nodeType === "trigger")
  if (!triggerNode) {
    errors.push(simulationIssue("error", "missing_trigger", "Simulation requires exactly one trigger node."))
    return failedSimulation({
      simulationId,
      flowId: input.flow.id,
      versionId: input.version.id,
      entryNodeId: null,
      warnings,
      errors,
      timeline,
      createdAt,
      compileId: compile.compileId,
    })
  }

  const draftStepIdMap = buildDraftStepIdMap(compile)
  const draftConditionIdMap = buildDraftConditionIdMap(compile)
  let currentNodeId: string | null = triggerNode.id
  let timelineOffset = 0
  let executionOrder = 0
  const visitedGuard = new Set<string>()
  const maxSteps = Math.max(input.nodes.length * 3, 1)

  while (currentNodeId && executionOrder < maxSteps) {
    const guardKey = `${currentNodeId}:${executionOrder}`
    if (visitedGuard.has(guardKey)) {
      errors.push(
        simulationIssue("error", "simulation_cycle", "Simulation stopped due to repeated node traversal.", currentNodeId),
      )
      break
    }
    visitedGuard.add(guardKey)

    const node = nodesById.get(currentNodeId)
    if (!node) {
      errors.push(simulationIssue("error", "missing_node", "Simulation referenced a missing node.", currentNodeId))
      break
    }

    executionOrder += 1
    executedNodes.push({
      nodeId: node.id,
      nodeType: node.nodeType,
      label: node.label,
      order: executionOrder,
    })

    const outgoingEdges = edgesByFrom.get(node.id) ?? []
    let nextEdge: GrowthAutomationEdge | null = null

    switch (node.nodeType) {
      case "trigger": {
        appendTimelineEntry({
          timeline,
          startMs,
          offsetMs: timelineOffset,
          node,
          action: "trigger_entered",
          details: {
            qa_marker: GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
            triggerEvent: simulationInput.triggerEvent ?? compile.compiledPatternDraft?.entryTrigger.triggerKey ?? null,
            compileId: compile.compileId,
          },
        })
        timelineOffset += 1
        nextEdge = pickDefaultOutgoingEdge(outgoingEdges)
        break
      }
      case "condition":
      case "branch": {
        const compiledCondition = compile.compiledConditions.find(
          (condition) => condition.automationNodeId === node.id,
        )
        const outcome = evaluateSimulationConditionOutcome({
          simulationInput,
          node,
          draftConditionId: compiledCondition?.draftConditionId ?? draftConditionIdMap.get(node.id) ?? null,
          conditionKey: compiledCondition?.conditionKey ?? null,
        })
        appendTimelineEntry({
          timeline,
          startMs,
          offsetMs: timelineOffset,
          node,
          action:
            outcome === "matched"
              ? "condition_matched"
              : outcome === "not_matched"
                ? "condition_not_matched"
                : "condition_unknown",
          details: { outcome, conditionKey: compiledCondition?.conditionKey ?? null },
        })
        timelineOffset += 1

        const branch = resolveSimulationBranchDecision({
          node,
          outgoingEdges,
          compile,
          draftStepIdMap,
          draftConditionIdMap,
          matched: outcome === "matched",
          scenario: simulationInput.scenario ?? "immediate",
        })
        if (branch.decision) {
          branchDecisions.push(branch.decision)
          appendTimelineEntry({
            timeline,
            startMs,
            offsetMs: timelineOffset,
            node,
            action:
              branch.decision.decision === "conditional_true"
                ? "branch_true"
                : branch.decision.decision === "conditional_false"
                  ? "branch_false"
                  : branch.decision.decision === "timeout"
                    ? "wait_timeout"
                    : "branch_selected",
            details: { decision: branch.decision.decision, reason: branch.decision.reason },
          })
          timelineOffset += 1
        }
        if (!branch.edge) {
          errors.push(
            simulationIssue(
              "error",
              "branch_unresolved",
              branch.error ?? "Condition branch could not be resolved.",
              node.id,
            ),
          )
          currentNodeId = null
          continue
        }
        nextEdge = branch.edge
        break
      }
      case "wait": {
        const waitTransition = resolveSimulationWaitTransition({
          node,
          outgoingEdges,
          compile,
          draftStepIdMap,
          draftConditionIdMap,
          simulationInput,
        })
        waitStates.push(waitTransition.waitState)
        appendTimelineEntry({
          timeline,
          startMs,
          offsetMs: timelineOffset,
          node,
          action: waitTransition.waitState.resolution === "timeout" ? "wait_timeout" : "wait_resolved",
          details: {
            waitKind: waitTransition.waitState.waitKind,
            resolution: waitTransition.waitState.resolution,
          },
        })
        timelineOffset += 1
        if (waitTransition.branchDecision) {
          branchDecisions.push(waitTransition.branchDecision)
        }
        if (!waitTransition.edge) {
          errors.push(
            simulationIssue(
              "error",
              "wait_unresolved",
              waitTransition.error ?? "Wait node could not be resolved.",
              node.id,
            ),
          )
          currentNodeId = null
          continue
        }
        nextEdge = waitTransition.edge
        break
      }
      case "approval": {
        approvalGates.push({
          nodeId: node.id,
          requiresApproval: true,
          approved: false,
        })
        appendTimelineEntry({
          timeline,
          startMs,
          offsetMs: timelineOffset,
          node,
          action: "approval_required",
          details: { requiresApproval: true, approved: false },
        })
        timelineOffset += 1
        nextEdge = pickDefaultOutgoingEdge(outgoingEdges)
        break
      }
      case "action": {
        const actionType =
          typeof node.configJson.actionType === "string" ? node.configJson.actionType.trim() : ""
        if (!isSupportedSimulationAction(actionType)) {
          errors.push(
            simulationIssue(
              "error",
              "unsupported_action",
              `Unsupported action type: ${actionType || "missing"}`,
              node.id,
            ),
          )
          appendTimelineEntry({
            timeline,
            startMs,
            offsetMs: timelineOffset,
            node,
            action: "action_blocked",
            status: "failed",
            details: { actionType, wouldExecute: false },
          })
          timelineOffset += 1
          currentNodeId = null
          continue
        }
        appendTimelineEntry({
          timeline,
          startMs,
          offsetMs: timelineOffset,
          node,
          action: "action_would_execute",
          details: {
            actionType,
            wouldExecute: true,
            executionEnabled: false,
            requiresHumanApproval: true,
          },
        })
        timelineOffset += 1
        nextEdge = pickDefaultOutgoingEdge(outgoingEdges)
        break
      }
      case "exit": {
        appendTimelineEntry({
          timeline,
          startMs,
          offsetMs: timelineOffset,
          node,
          action: isTerminalAutomationNode(node) ? "goal_reached" : "exit_reached",
          details: { terminal: true },
        })
        currentNodeId = null
        continue
      }
      default: {
        warnings.push(
          simulationIssue("warning", "unsupported_node", `Node type ${node.nodeType} skipped in simulation.`, node.id),
        )
        nextEdge = pickDefaultOutgoingEdge(outgoingEdges)
      }
    }

    if (!nextEdge) {
      if (!isTerminalAutomationNode(node)) {
        errors.push(
          simulationIssue("error", "missing_outgoing_edge", "Node has no outgoing edge to continue simulation.", node.id),
        )
      }
      break
    }

    executedEdges.push({
      edgeId: nextEdge.id,
      fromNodeId: nextEdge.fromNodeId,
      toNodeId: nextEdge.toNodeId,
      edgeType: nextEdge.edgeType,
      order: executedEdges.length + 1,
    })
    currentNodeId = nextEdge.toNodeId

    const nextNode = nodesById.get(currentNodeId)
    if (nextNode && isTerminalAutomationNode(nextNode)) {
      executionOrder += 1
      executedNodes.push({
        nodeId: nextNode.id,
        nodeType: nextNode.nodeType,
        label: nextNode.label,
        order: executionOrder,
      })
      appendTimelineEntry({
        timeline,
        startMs,
        offsetMs: timelineOffset,
        node: nextNode,
        action: nextNode.configJson.canvasNodeType === "goal" ? "goal_reached" : "exit_reached",
        details: { terminal: true },
      })
      currentNodeId = null
    }
  }

  const status = errors.length > 0 ? "failed" : "simulated"

  return {
    simulationId,
    flowId: input.flow.id,
    versionId: input.version.id,
    status,
    entryNodeId: triggerNode.id,
    executedNodes,
    executedEdges,
    waitStates,
    branchDecisions,
    approvalGates,
    warnings,
    errors,
    timeline,
    safety: GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
    createdAt,
    compileId: compile.compileId,
    stats: {
      nodeCount: executedNodes.length,
      edgeCount: executedEdges.length,
      timelineCount: timeline.length,
      branchDecisionCount: branchDecisions.length,
      waitCount: waitStates.length,
      approvalGateCount: approvalGates.length,
    },
  }
}

function failedSimulation(input: {
  simulationId: string
  flowId: string
  versionId: string
  entryNodeId: string | null
  warnings: GrowthAutomationSimulationResult["warnings"]
  errors: GrowthAutomationSimulationResult["errors"]
  timeline: GrowthAutomationSimulationResult["timeline"]
  createdAt: string
  compileId: string | null
}): GrowthAutomationSimulationResult {
  return {
    simulationId: input.simulationId,
    flowId: input.flowId,
    versionId: input.versionId,
    status: "failed",
    entryNodeId: input.entryNodeId,
    executedNodes: [],
    executedEdges: [],
    waitStates: [],
    branchDecisions: [],
    approvalGates: [],
    warnings: input.warnings,
    errors: input.errors,
    timeline: input.timeline,
    safety: GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
    createdAt: input.createdAt,
    compileId: input.compileId,
    stats: {
      nodeCount: 0,
      edgeCount: 0,
      timelineCount: input.timeline.length,
      branchDecisionCount: 0,
      waitCount: 0,
      approvalGateCount: 0,
    },
  }
}

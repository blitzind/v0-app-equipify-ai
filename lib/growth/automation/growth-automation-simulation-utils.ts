/** Growth Engine S5-E — automation simulation helpers (client-safe). */

import { draftId, isSupportedCompilerAction } from "@/lib/growth/automation/growth-automation-compiler-utils"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import {
  GROWTH_AUTOMATION_COMPILER_SUPPORTED_ACTIONS,
} from "@/lib/growth/automation/growth-automation-compiler-types"
import type {
  GrowthAutomationSimulationBranchDecision,
  GrowthAutomationSimulationConditionOutcome,
  GrowthAutomationSimulationInput,
  GrowthAutomationSimulationIssue,
  GrowthAutomationSimulationTimelineEntry,
  GrowthAutomationSimulationWaitState,
} from "@/lib/growth/automation/growth-automation-simulation-types"
import type {
  GrowthAutomationEdge,
  GrowthAutomationNode,
} from "@/lib/growth/automation/growth-automation-types"
import { resolveSequenceBranchEdges } from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import type { SequenceBranchEdge } from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type { SequenceBranchSimulationScenario } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"
import { resolveSequenceTriggerSimulationConditionOverrides } from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-utils"

export function simulationIssue(
  severity: GrowthAutomationSimulationIssue["severity"],
  ruleCode: string,
  message: string,
  nodeId?: string | null,
): GrowthAutomationSimulationIssue {
  return { severity, ruleCode, message, nodeId: nodeId ?? null }
}

export function normalizeSimulationInput(
  input?: GrowthAutomationSimulationInput,
): GrowthAutomationSimulationInput {
  return {
    triggerEvent: input?.triggerEvent?.trim() || undefined,
    leadAttributes: input?.leadAttributes ?? {},
    companyAttributes: input?.companyAttributes ?? {},
    sharePageAttributes: input?.sharePageAttributes ?? {},
    mediaAttributes: input?.mediaAttributes ?? {},
    bookingAttributes: input?.bookingAttributes ?? {},
    highIntentAttributes: input?.highIntentAttributes ?? {},
    conditionOverrides: input?.conditionOverrides ?? {},
    triggerFixtures: input?.triggerFixtures ?? [],
    scenario: input?.scenario ?? "immediate",
  }
}

export function isTerminalAutomationNode(node: GrowthAutomationNode): boolean {
  return node.nodeType === "exit" || node.configJson.canvasNodeType === "goal"
}

export function buildDraftStepIdMap(
  compile: GrowthAutomationCompileResult,
): Map<string, string> {
  return new Map(compile.compiledSteps.map((step) => [step.automationNodeId, step.draftStepId]))
}

export function buildDraftConditionIdMap(
  compile: GrowthAutomationCompileResult,
): Map<string, string> {
  return new Map(
    compile.compiledConditions.map((condition) => [
      condition.automationNodeId,
      condition.draftConditionId,
    ]),
  )
}

export function resolveMergedConditionOverrides(input: {
  simulationInput: GrowthAutomationSimulationInput
  draftConditionId?: string | null
  nodeId?: string | null
}): Record<string, boolean> {
  const merged = resolveSequenceTriggerSimulationConditionOverrides({
    fixtures: input.simulationInput.triggerFixtures,
    scenario: input.simulationInput.scenario,
    conditionOverrides: input.simulationInput.conditionOverrides,
  })

  if (input.draftConditionId && input.simulationInput.conditionOverrides?.[input.draftConditionId] !== undefined) {
    merged[input.draftConditionId] = input.simulationInput.conditionOverrides[input.draftConditionId]!
  }
  if (input.nodeId && input.simulationInput.conditionOverrides?.[input.nodeId] !== undefined) {
    merged[input.nodeId] = input.simulationInput.conditionOverrides[input.nodeId]!
  }

  return merged
}

export function evaluateSimulationConditionOutcome(input: {
  simulationInput: GrowthAutomationSimulationInput
  node: GrowthAutomationNode
  draftConditionId?: string | null
  conditionKey?: string | null
}): GrowthAutomationSimulationConditionOutcome {
  const overrides = resolveMergedConditionOverrides({
    simulationInput: input.simulationInput,
    draftConditionId: input.draftConditionId,
    nodeId: input.node.id,
  })

  if (input.draftConditionId && overrides[input.draftConditionId] !== undefined) {
    return overrides[input.draftConditionId] ? "matched" : "not_matched"
  }
  if (overrides[input.node.id] !== undefined) {
    return overrides[input.node.id] ? "matched" : "not_matched"
  }

  if (input.simulationInput.triggerEvent && input.conditionKey === input.simulationInput.triggerEvent) {
    return "matched"
  }

  if (input.simulationInput.scenario === "wait_matched") {
    return "matched"
  }
  if (input.simulationInput.scenario === "wait_timeout") {
    return "not_matched"
  }

  return "unknown"
}

export function mapOutgoingEdgesToBranchEdges(input: {
  compile: GrowthAutomationCompileResult
  fromNodeId: string
  outgoingEdges: GrowthAutomationEdge[]
  draftStepIdMap: Map<string, string>
  draftConditionIdMap: Map<string, string>
}): SequenceBranchEdge[] {
  const patternId = input.compile.flowId
  const now = new Date().toISOString()
  const fromDraftStepId = input.draftStepIdMap.get(input.fromNodeId)
  if (!fromDraftStepId) return []

  return input.outgoingEdges.map((edge) => ({
    id: draftId("edge", edge.id),
    patternId,
    fromPatternStepId: fromDraftStepId,
    toPatternStepId: input.draftStepIdMap.get(edge.toNodeId) ?? edge.toNodeId,
    conditionId: input.draftConditionIdMap.get(input.fromNodeId) ?? null,
    edgeType: edge.edgeType,
    priority: edge.priority,
    label: null,
    createdAt: now,
    updatedAt: now,
  }))
}

export function resolveSimulationBranchDecision(input: {
  node: GrowthAutomationNode
  outgoingEdges: GrowthAutomationEdge[]
  compile: GrowthAutomationCompileResult
  draftStepIdMap: Map<string, string>
  draftConditionIdMap: Map<string, string>
  matched: boolean
  scenario: SequenceBranchSimulationScenario
}): {
  edge: GrowthAutomationEdge | null
  decision: GrowthAutomationSimulationBranchDecision | null
  error?: string
} {
  if (input.scenario === "wait_timeout") {
    const timeoutEdge = input.outgoingEdges.find((edge) => edge.edgeType === "timeout")
    if (timeoutEdge) {
      return {
        edge: timeoutEdge,
        decision: {
          edgeId: timeoutEdge.id,
          sourceNodeId: input.node.id,
          targetNodeId: timeoutEdge.toNodeId,
          decision: "timeout",
          reason: "Simulated wait timeout — timeout edge selected.",
        },
      }
    }
  }

  const branchEdges = mapOutgoingEdgesToBranchEdges({
    compile: input.compile,
    fromNodeId: input.node.id,
    outgoingEdges: input.outgoingEdges,
    draftStepIdMap: input.draftStepIdMap,
    draftConditionIdMap: input.draftConditionIdMap,
  })
  const draftConditionId = input.draftConditionIdMap.get(input.node.id) ?? null
  const resolver = resolveSequenceBranchEdges({
    fromPatternStepId: input.draftStepIdMap.get(input.node.id)!,
    edges: branchEdges,
    evaluations: draftConditionId ? [{ conditionId: draftConditionId, matched: input.matched }] : [],
  })

  if (!resolver.selectedEdge || !resolver.targetPatternStepId) {
    return { edge: null, decision: null, error: resolver.reason }
  }

  const selectedAutomationEdge = input.outgoingEdges.find(
    (edge) => draftId("edge", edge.id) === resolver.selectedEdge?.id,
  )
  if (!selectedAutomationEdge) {
    return { edge: null, decision: null, error: "Branch edge could not be mapped back to automation graph." }
  }

  return {
    edge: selectedAutomationEdge,
    decision: {
      edgeId: selectedAutomationEdge.id,
      sourceNodeId: input.node.id,
      targetNodeId: selectedAutomationEdge.toNodeId,
      decision: selectedAutomationEdge.edgeType,
      reason: resolver.reason,
    },
  }
}

export function resolveSimulationWaitTransition(input: {
  node: GrowthAutomationNode
  outgoingEdges: GrowthAutomationEdge[]
  compile: GrowthAutomationCompileResult
  draftStepIdMap: Map<string, string>
  draftConditionIdMap: Map<string, string>
  simulationInput: GrowthAutomationSimulationInput
}): {
  waitState: GrowthAutomationSimulationWaitState
  edge: GrowthAutomationEdge | null
  branchDecision: GrowthAutomationSimulationBranchDecision | null
  error?: string
} {
  const waitDraft = input.compile.compiledWaits.find((wait) => wait.automationNodeId === input.node.id)
  const waitKind = waitDraft?.waitKind ?? "duration"
  const scenario = input.simulationInput.scenario ?? "immediate"

  if (waitKind === "duration") {
    const branch = resolveSimulationBranchDecision({
      node: input.node,
      outgoingEdges: input.outgoingEdges,
      compile: input.compile,
      draftStepIdMap: input.draftStepIdMap,
      draftConditionIdMap: input.draftConditionIdMap,
      matched: scenario !== "wait_timeout",
      scenario,
    })
    return {
      waitState: {
        nodeId: input.node.id,
        waitKind: "duration",
        resolved: true,
        resolution: branch.decision?.decision === "timeout" ? "timeout" : "continued",
        durationSeconds: waitDraft?.durationSeconds ?? null,
        detail:
          branch.decision?.decision === "timeout"
            ? "Duration wait resolved via timeout fixture."
            : "Duration wait resolved immediately in simulation.",
      },
      edge: branch.edge,
      branchDecision: branch.decision,
      error: branch.error,
    }
  }

  const matched = evaluateSimulationConditionOutcome({
    simulationInput: input.simulationInput,
    node: input.node,
    draftConditionId: waitDraft?.conditionDraftId ?? input.draftConditionIdMap.get(input.node.id) ?? null,
    conditionKey: waitDraft?.waitedForEvent ? String(waitDraft.waitedForEvent) : null,
  })
  const branch = resolveSimulationBranchDecision({
    node: input.node,
    outgoingEdges: input.outgoingEdges,
    compile: input.compile,
    draftStepIdMap: input.draftStepIdMap,
    draftConditionIdMap: input.draftConditionIdMap,
    matched: matched === "matched",
    scenario,
  })

  return {
    waitState: {
      nodeId: input.node.id,
      waitKind: waitKind === "condition" ? "condition" : "until_event",
      resolved: true,
      resolution:
        branch.decision?.decision === "timeout"
          ? "timeout"
          : matched === "matched"
            ? "matched"
            : "unmatched",
      durationSeconds: waitDraft?.durationSeconds ?? null,
      detail: `Wait resolved immediately using ${scenario} fixtures.`,
    },
    edge: branch.edge,
    branchDecision: branch.decision,
    error: branch.error,
  }
}

export function pickDefaultOutgoingEdge(edges: GrowthAutomationEdge[]): GrowthAutomationEdge | null {
  const sorted = [...edges].sort((left, right) => right.priority - left.priority)
  return (
    sorted.find((edge) => edge.edgeType === "default") ??
    sorted.find((edge) => edge.edgeType === "fallback") ??
    sorted[0] ??
    null
  )
}

export function appendTimelineEntry(input: {
  timeline: GrowthAutomationSimulationTimelineEntry[]
  startMs: number
  offsetMs: number
  node: GrowthAutomationNode
  action: string
  status?: GrowthAutomationSimulationTimelineEntry["status"]
  details?: Record<string, unknown>
}): void {
  input.timeline.push({
    timestamp: new Date(input.startMs + input.offsetMs).toISOString(),
    nodeId: input.node.id,
    nodeType: input.node.nodeType,
    action: input.action,
    status: input.status ?? "completed",
    details: input.details ?? {},
  })
}

export function isSupportedSimulationAction(actionType: string | null | undefined): boolean {
  if (!actionType) return false
  return isSupportedCompilerAction(actionType)
}

export function listUnsupportedSimulationActions(): readonly string[] {
  return GROWTH_AUTOMATION_COMPILER_SUPPORTED_ACTIONS
}

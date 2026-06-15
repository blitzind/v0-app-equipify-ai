/** SR-3 Phase 6 — branch preview + simulation types (client-safe). */

import type { SequenceBranchDecisionOutcome } from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type { SequenceBranchEdge } from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type {
  SequenceBranchResolutionKind,
  SequenceBranchResolverEvaluation,
  SequenceBranchResolverResult,
} from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import {
  identifySkippedBranchTargetPatternStepIds,
  resolveSequenceBranchEdges,
} from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import type { SequencePatternStepCondition } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import type { SequenceConditionEvaluationResult } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"
import type { GrowthSequencePatternStep } from "@/lib/growth/sequence-types"

export const GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER =
  "growth-sequence-branch-simulation-sr3-phase6-v1" as const

export const GROWTH_SEQUENCE_BRANCH_GRAPH_QA_MARKER =
  "growth-sequence-branch-graph-read-model-sr3-phase6-v1" as const

export const SEQUENCE_BRANCH_SIMULATION_SCENARIOS = [
  "immediate",
  "wait_timeout",
  "wait_matched",
] as const

export type SequenceBranchSimulationScenario = (typeof SEQUENCE_BRANCH_SIMULATION_SCENARIOS)[number]

export type SequenceBranchGraphStepNode = {
  patternStepId: string
  stepOrder: number
  channel: string
  conditionIds: string[]
  outgoingEdgeIds: string[]
}

export type SequenceBranchGraphReadModel = {
  qa_marker: typeof GROWTH_SEQUENCE_BRANCH_GRAPH_QA_MARKER
  patternId: string
  steps: SequenceBranchGraphStepNode[]
  edges: SequenceBranchEdge[]
  conditions: SequencePatternStepCondition[]
}

export type SequenceBranchSimulationPathKind =
  | "linear"
  | "branched"
  | "waiting"
  | "blocked"
  | "timeout"

export type SequenceBranchSimulationBranchDecision = {
  decision: SequenceBranchDecisionOutcome
  conditionId: string | null
  edgeId: string | null
  source: string
  event: string
  outcomeDetail: string
}

export type SequenceBranchSimulationWaitPreview = {
  conditionId: string
  waitedForSource: string
  waitedForEvent: string
  waitKind: "until_event"
  detail: string
}

export type SequenceBranchSimulationTimeoutPreview = {
  edgeId: string
  targetPatternStepId: string
  reason: string
}

export type SequenceBranchSimulationSkippedStep = {
  patternStepId: string
  stepOrder: number | null
  channel: string | null
  reason: string
}

export type SequenceBranchSimulationStepResult = {
  pathKind: SequenceBranchSimulationPathKind
  resolution: SequenceBranchResolutionKind
  reason: string
  selectedEdge: SequenceBranchEdge | null
  targetPatternStepId: string | null
  skippedPatternStepIds: string[]
  skippedSteps: SequenceBranchSimulationSkippedStep[]
  branchDecision: SequenceBranchSimulationBranchDecision | null
  wait: SequenceBranchSimulationWaitPreview | null
  timeout: SequenceBranchSimulationTimeoutPreview | null
  warnings: string[]
}

export type SequenceBranchSimulationConditionEvaluation = {
  conditionId: string
  matched: boolean
  overridden: boolean
  result: SequenceConditionEvaluationResult
}

export type SequenceBranchSimulationResult = {
  qa_marker: typeof GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER
  read_only: true
  scenario: SequenceBranchSimulationScenario
  evaluatedAt: string
  fromPatternStepId: string
  path: {
    kind: SequenceBranchSimulationPathKind
    resolution: SequenceBranchResolutionKind
    reason: string
    selectedEdgeId: string | null
    targetPatternStepId: string | null
  }
  graph: SequenceBranchGraphReadModel
  conditionEvaluations: SequenceBranchSimulationConditionEvaluation[]
  branchDecisions: SequenceBranchSimulationBranchDecision[]
  waits: SequenceBranchSimulationWaitPreview[]
  timeouts: SequenceBranchSimulationTimeoutPreview[]
  skippedSteps: SequenceBranchSimulationSkippedStep[]
  evidenceRefs: string[]
  warnings: string[]
  resolver: SequenceBranchResolverResult
}

export type SequenceBranchSimulationPureInput = {
  fromPatternStepId: string
  patternSteps: GrowthSequencePatternStep[]
  edges: SequenceBranchEdge[]
  conditions: SequencePatternStepCondition[]
  evaluations: SequenceBranchResolverEvaluation[]
  conditionResults: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }>
  scenario?: SequenceBranchSimulationScenario
  now: string
}

function findDeferredWaitCondition(input: {
  edges: SequenceBranchEdge[]
  evaluations: SequenceBranchResolverEvaluation[]
  conditionResults: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }>
}): { conditionId: string; event: string; source: string } | null {
  const INSTANT_PREFIXES = ["lead.", "engagement."] as const
  for (const edge of input.edges) {
    if (edge.edgeType !== "conditional_true" || !edge.conditionId) continue
    const evaluation = input.evaluations.find((entry) => entry.conditionId === edge.conditionId)
    if (evaluation?.matched) continue
    const result = input.conditionResults.find((entry) => entry.conditionId === edge.conditionId)?.result
    if (!result) continue
    if (INSTANT_PREFIXES.some((prefix) => result.event.startsWith(prefix))) continue
    return { conditionId: edge.conditionId, event: result.event, source: result.source }
  }
  return null
}

function skippedStepsFromIds(
  patternSteps: GrowthSequencePatternStep[],
  skippedPatternStepIds: string[],
  reason: string,
): SequenceBranchSimulationSkippedStep[] {
  return skippedPatternStepIds.map((patternStepId) => {
    const step = patternSteps.find((entry) => entry.id === patternStepId)
    return {
      patternStepId,
      stepOrder: step?.stepOrder ?? null,
      channel: step?.channel ?? null,
      reason,
    }
  })
}

function branchDecisionFromResolver(input: {
  resolver: SequenceBranchResolverResult
  conditionResults: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }>
  decision: SequenceBranchDecisionOutcome
}): SequenceBranchSimulationBranchDecision {
  const primaryResult =
    input.conditionResults.find((entry) => entry.conditionId === input.resolver.selectedEdge?.conditionId)
      ?.result ?? input.conditionResults[0]?.result

  return {
    decision: input.decision,
    conditionId: input.resolver.selectedEdge?.conditionId ?? null,
    edgeId: input.resolver.selectedEdge?.id ?? null,
    source: primaryResult?.source ?? "email",
    event: primaryResult?.event ?? "email.opened",
    outcomeDetail: input.resolver.reason,
  }
}

export function simulateSequenceBranchStepPure(
  input: SequenceBranchSimulationPureInput,
): SequenceBranchSimulationStepResult {
  const scenario = input.scenario ?? "immediate"
  const warnings: string[] = []
  const fromEdges = input.edges.filter((edge) => edge.fromPatternStepId === input.fromPatternStepId)

  if (fromEdges.length === 0) {
    return {
      pathKind: "linear",
      resolution: "none",
      reason: "No branch edges configured — linear advancement would apply.",
      selectedEdge: null,
      targetPatternStepId: null,
      skippedPatternStepIds: [],
      skippedSteps: [],
      branchDecision: null,
      wait: null,
      timeout: null,
      warnings,
    }
  }

  let evaluations = input.evaluations
  let conditionResults = input.conditionResults

  if (scenario === "wait_matched") {
    const deferred = findDeferredWaitCondition({ edges: fromEdges, evaluations, conditionResults })
    if (deferred) {
      evaluations = evaluations.map((entry) =>
        entry.conditionId === deferred.conditionId ? { ...entry, matched: true } : entry,
      )
      conditionResults = conditionResults.map((entry) =>
        entry.conditionId === deferred.conditionId
          ? {
              ...entry,
              result: {
                ...entry.result,
                matched: true,
                reason: "Simulation override — wait condition matched.",
              },
            }
          : entry,
      )
    } else {
      warnings.push("wait_matched scenario requested but no deferrable event wait condition found.")
    }
  }

  let resolver = resolveSequenceBranchEdges({
    fromPatternStepId: input.fromPatternStepId,
    edges: input.edges,
    evaluations,
  })

  if (scenario === "wait_timeout") {
    const timeoutEdge = fromEdges.find((edge) => edge.edgeType === "timeout")
    if (timeoutEdge) {
      resolver = {
        selectedEdge: timeoutEdge,
        targetPatternStepId: timeoutEdge.toPatternStepId,
        skippedEdges: fromEdges.filter((edge) => edge.id !== timeoutEdge.id),
        reason: "Simulated wait timeout — timeout edge selected.",
        resolution: "conditional_false",
      }
    } else {
      warnings.push("wait_timeout scenario requested but no timeout edge configured.")
    }
  }

  const skippedPatternStepIds = identifySkippedBranchTargetPatternStepIds({
    edges: fromEdges,
    selectedEdge: resolver.selectedEdge,
  })
  const skipReason =
    scenario === "wait_timeout"
      ? "Non-selected branch path skipped after simulated timeout."
      : "Non-selected branch path skipped after branch resolution."

  if (scenario === "wait_timeout" && resolver.selectedEdge?.edgeType === "timeout") {
    const branchDecision = branchDecisionFromResolver({
      resolver,
      conditionResults,
      decision: "timeout",
    })
    return {
      pathKind: "timeout",
      resolution: resolver.resolution,
      reason: resolver.reason,
      selectedEdge: resolver.selectedEdge,
      targetPatternStepId: resolver.targetPatternStepId,
      skippedPatternStepIds,
      skippedSteps: skippedStepsFromIds(input.patternSteps, skippedPatternStepIds, skipReason),
      branchDecision,
      wait: null,
      timeout: {
        edgeId: resolver.selectedEdge.id,
        targetPatternStepId: resolver.targetPatternStepId!,
        reason: resolver.reason,
      },
      warnings,
    }
  }

  if (resolver.resolution === "conditional_true" && resolver.targetPatternStepId) {
    const branchDecision = branchDecisionFromResolver({
      resolver,
      conditionResults,
      decision: "true",
    })
    return {
      pathKind: "branched",
      resolution: resolver.resolution,
      reason: resolver.reason,
      selectedEdge: resolver.selectedEdge,
      targetPatternStepId: resolver.targetPatternStepId,
      skippedPatternStepIds,
      skippedSteps: skippedStepsFromIds(input.patternSteps, skippedPatternStepIds, skipReason),
      branchDecision,
      wait: null,
      timeout: null,
      warnings,
    }
  }

  const deferredWait =
    scenario === "immediate"
      ? findDeferredWaitCondition({ edges: fromEdges, evaluations, conditionResults })
      : null

  if (deferredWait && scenario === "immediate") {
    return {
      pathKind: "waiting",
      resolution: resolver.resolution,
      reason: "Event condition not yet matched — enrollment would enter wait state.",
      selectedEdge: null,
      targetPatternStepId: null,
      skippedPatternStepIds: [],
      skippedSteps: [],
      branchDecision: null,
      wait: {
        conditionId: deferredWait.conditionId,
        waitedForSource: deferredWait.source,
        waitedForEvent: deferredWait.event,
        waitKind: "until_event",
        detail: `Would wait for ${deferredWait.event}.`,
      },
      timeout: fromEdges.find((edge) => edge.edgeType === "timeout")
        ? {
            edgeId: fromEdges.find((edge) => edge.edgeType === "timeout")!.id,
            targetPatternStepId: fromEdges.find((edge) => edge.edgeType === "timeout")!.toPatternStepId,
            reason: "Timeout edge available if wait expires.",
          }
        : null,
      warnings,
    }
  }

  if (!resolver.targetPatternStepId) {
    return {
      pathKind: "blocked",
      resolution: resolver.resolution,
      reason: resolver.reason,
      selectedEdge: resolver.selectedEdge,
      targetPatternStepId: null,
      skippedPatternStepIds,
      skippedSteps: skippedStepsFromIds(input.patternSteps, skippedPatternStepIds, skipReason),
      branchDecision: null,
      wait: null,
      timeout: null,
      warnings,
    }
  }

  const decision: SequenceBranchDecisionOutcome =
    resolver.resolution === "conditional_false" ? "false" : resolver.resolution === "default" ? "skipped" : "true"

  const branchDecision = branchDecisionFromResolver({
    resolver,
    conditionResults,
    decision,
  })

  return {
    pathKind: "branched",
    resolution: resolver.resolution,
    reason: resolver.reason,
    selectedEdge: resolver.selectedEdge,
    targetPatternStepId: resolver.targetPatternStepId,
    skippedPatternStepIds,
    skippedSteps: skippedStepsFromIds(input.patternSteps, skippedPatternStepIds, skipReason),
    branchDecision,
    wait: null,
    timeout: null,
    warnings,
  }
}

export { identifySkippedBranchTargetPatternStepIds, resolveSequenceBranchEdges }

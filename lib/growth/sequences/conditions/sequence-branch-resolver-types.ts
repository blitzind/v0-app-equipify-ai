/** SR-3 Phase 3 — deterministic branch resolver types (client-safe). */

import type { SequenceBranchEdge } from "@/lib/growth/sequences/conditions/sequence-branch-types"

export const GROWTH_SEQUENCE_BRANCH_RESOLVER_QA_MARKER =
  "growth-sequence-branch-resolver-sr3-phase3-v1" as const

export type SequenceBranchResolverEvaluation = {
  conditionId: string
  matched: boolean
}

export type SequenceBranchResolutionKind =
  | "conditional_true"
  | "conditional_false"
  | "default"
  | "fallback"
  | "none"

export type SequenceBranchResolverResult = {
  selectedEdge: SequenceBranchEdge | null
  targetPatternStepId: string | null
  skippedEdges: SequenceBranchEdge[]
  reason: string
  resolution: SequenceBranchResolutionKind
}

function sortEdges(edges: SequenceBranchEdge[]): SequenceBranchEdge[] {
  return [...edges].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority
    return left.createdAt.localeCompare(right.createdAt)
  })
}

function evaluationMap(
  evaluations: SequenceBranchResolverEvaluation[],
): Map<string, boolean> {
  return new Map(evaluations.map((entry) => [entry.conditionId, entry.matched]))
}

export function resolveSequenceBranchEdges(input: {
  fromPatternStepId: string
  edges: SequenceBranchEdge[]
  evaluations: SequenceBranchResolverEvaluation[]
}): SequenceBranchResolverResult {
  const fromEdges = sortEdges(
    input.edges.filter((edge) => edge.fromPatternStepId === input.fromPatternStepId),
  )
  if (fromEdges.length === 0) {
    return {
      selectedEdge: null,
      targetPatternStepId: null,
      skippedEdges: [],
      reason: "No branch edges configured for pattern step.",
      resolution: "none",
    }
  }

  const matches = evaluationMap(input.evaluations)

  const conditionalTrue = fromEdges.find(
    (edge) =>
      edge.edgeType === "conditional_true" &&
      edge.conditionId &&
      matches.get(edge.conditionId) === true,
  )
  if (conditionalTrue) {
    return finalizeSelection(fromEdges, conditionalTrue, "conditional_true", "Condition matched — conditional_true edge selected.")
  }

  const conditionalFalse = fromEdges.find(
    (edge) =>
      edge.edgeType === "conditional_false" &&
      edge.conditionId &&
      matches.get(edge.conditionId) === false,
  )
  if (conditionalFalse) {
    return finalizeSelection(fromEdges, conditionalFalse, "conditional_false", "Condition not matched — conditional_false edge selected.")
  }

  const defaultEdge = fromEdges.find((edge) => edge.edgeType === "default")
  if (defaultEdge) {
    return finalizeSelection(fromEdges, defaultEdge, "default", "No conditional edge selected — default edge used.")
  }

  const fallbackEdge = fromEdges.find((edge) => edge.edgeType === "fallback")
  if (fallbackEdge) {
    return finalizeSelection(fromEdges, fallbackEdge, "fallback", "No conditional/default edge — fallback edge used.")
  }

  return {
    selectedEdge: null,
    targetPatternStepId: null,
    skippedEdges: fromEdges,
    reason: "No matching branch edge and no default/fallback edge configured.",
    resolution: "none",
  }
}

function finalizeSelection(
  fromEdges: SequenceBranchEdge[],
  selectedEdge: SequenceBranchEdge,
  resolution: SequenceBranchResolutionKind,
  reason: string,
): SequenceBranchResolverResult {
  const skippedEdges = fromEdges.filter((edge) => edge.id !== selectedEdge.id)
  return {
    selectedEdge,
    targetPatternStepId: selectedEdge.toPatternStepId,
    skippedEdges,
    reason,
    resolution,
  }
}

export function identifySkippedBranchTargetPatternStepIds(input: {
  edges: SequenceBranchEdge[]
  selectedEdge: SequenceBranchEdge | null
}): string[] {
  if (!input.selectedEdge) {
    return [...new Set(input.edges.map((edge) => edge.toPatternStepId))]
  }
  return [
    ...new Set(
      input.edges
        .filter((edge) => edge.id !== input.selectedEdge!.id)
        .map((edge) => edge.toPatternStepId),
    ),
  ]
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  listConditionsForStep,
  listEdgesForPattern,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import {
  GROWTH_SEQUENCE_BRANCH_GRAPH_QA_MARKER,
  type SequenceBranchGraphReadModel,
  type SequenceBranchGraphStepNode,
} from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"

export { GROWTH_SEQUENCE_BRANCH_GRAPH_QA_MARKER }

export async function buildSequenceBranchGraphReadModel(
  admin: SupabaseClient,
  input: { patternId: string },
): Promise<SequenceBranchGraphReadModel> {
  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === input.patternId)
  if (!pattern) throw new Error("pattern_not_found")

  const edges = await listEdgesForPattern(admin, pattern.id)
  const conditions = (
    await Promise.all(pattern.steps.map((step) => listConditionsForStep(admin, step.id)))
  ).flat()

  const steps: SequenceBranchGraphStepNode[] = pattern.steps.map((step) => ({
    patternStepId: step.id,
    stepOrder: step.stepOrder,
    channel: step.channel,
    conditionIds: conditions.filter((entry) => entry.patternStepId === step.id).map((entry) => entry.id),
    outgoingEdgeIds: edges
      .filter((edge) => edge.fromPatternStepId === step.id)
      .map((edge) => edge.id),
  }))

  return {
    qa_marker: GROWTH_SEQUENCE_BRANCH_GRAPH_QA_MARKER,
    patternId: pattern.id,
    steps,
    edges,
    conditions,
  }
}

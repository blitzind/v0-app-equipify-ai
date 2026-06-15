import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthSequenceEnrollmentById, fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { listConditionsForStep, listEdgesFromPatternStep } from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import { evaluateSequenceConditionSpecReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import type { SequenceConditionEvaluationResult } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"
import type { SequenceBranchResolverEvaluation } from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import { buildSequenceBranchGraphReadModel } from "@/lib/growth/sequences/conditions/sequence-branch-graph-read-model"
import {
  GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER,
  simulateSequenceBranchStepPure,
  type SequenceBranchSimulationConditionEvaluation,
  type SequenceBranchSimulationResult,
  type SequenceBranchSimulationScenario,
} from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"

export { GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER }

export type SimulateSequenceBranchPreviewInput = {
  enrollmentId: string
  enrollmentStepId: string
  now?: string
  scenario?: SequenceBranchSimulationScenario
  conditionOverrides?: Record<string, boolean>
}

async function evaluateStepConditionsForSimulation(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    patternStepId: string
    now: string
    conditionOverrides?: Record<string, boolean>
  },
): Promise<{
  evaluations: SequenceBranchResolverEvaluation[]
  conditionEvaluations: SequenceBranchSimulationConditionEvaluation[]
}> {
  const conditions = await listConditionsForStep(admin, input.patternStepId)
  const evaluations: SequenceBranchResolverEvaluation[] = []
  const conditionEvaluations: SequenceBranchSimulationConditionEvaluation[] = []

  for (const condition of conditions) {
    const override = input.conditionOverrides?.[condition.id]
    let result: SequenceConditionEvaluationResult

    if (override !== undefined) {
      result = {
        matched: override,
        reason: "Simulation condition override applied.",
        evidence: [],
        evaluatedAt: input.now,
        readOnly: true,
        event: condition.spec.event,
        source: condition.spec.source,
      }
    } else {
      result = await evaluateSequenceConditionSpecReadOnly(admin, {
        enrollmentId: input.enrollmentId,
        enrollmentStepId: input.enrollmentStepId,
        conditionSpec: condition.spec,
        now: input.now,
      })
    }

    evaluations.push({ conditionId: condition.id, matched: result.matched })
    conditionEvaluations.push({
      conditionId: condition.id,
      matched: result.matched,
      overridden: override !== undefined,
      result,
    })
  }

  return { evaluations, conditionEvaluations }
}

export async function simulateSequenceBranchPreview(
  admin: SupabaseClient,
  input: SimulateSequenceBranchPreviewInput,
): Promise<SequenceBranchSimulationResult> {
  const now = input.now ?? new Date().toISOString()
  const scenario = input.scenario ?? "immediate"

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("enrollment_not_found")

  const enrollmentStep = await fetchGrowthSequenceEnrollmentStepById(admin, input.enrollmentStepId)
  if (!enrollmentStep || enrollmentStep.enrollmentId !== enrollment.id) {
    throw new Error("enrollment_step_not_found")
  }

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === enrollment.sequencePatternId)
  if (!pattern) throw new Error("pattern_not_found")

  const fromPatternStepId = enrollmentStep.sequencePatternStepId
  const edges = await listEdgesFromPatternStep(admin, pattern.id, fromPatternStepId)
  const graph = await buildSequenceBranchGraphReadModel(admin, { patternId: pattern.id })

  const { evaluations, conditionEvaluations } = await evaluateStepConditionsForSimulation(admin, {
    enrollmentId: enrollment.id,
    enrollmentStepId: enrollmentStep.id,
    patternStepId: fromPatternStepId,
    now,
    conditionOverrides: input.conditionOverrides,
  })

  const conditionResults = conditionEvaluations.map((entry) => ({
    conditionId: entry.conditionId,
    result: entry.result,
  }))

  const stepResult = simulateSequenceBranchStepPure({
    fromPatternStepId,
    patternSteps: pattern.steps,
    edges,
    conditions: graph.conditions.filter((entry) => entry.patternStepId === fromPatternStepId),
    evaluations,
    conditionResults,
    scenario,
    now,
  })

  const branchDecisions = stepResult.branchDecision ? [stepResult.branchDecision] : []
  const waits = stepResult.wait ? [stepResult.wait] : []
  const timeouts = stepResult.timeout ? [stepResult.timeout] : []
  const evidenceRefs = [
    ...new Set(
      conditionEvaluations.flatMap((entry) => entry.result.evidence.map((evidence) => evidence.ref)),
    ),
  ]

  const warnings = [...stepResult.warnings]
  if (conditionEvaluations.some((entry) => entry.overridden)) {
    warnings.push("One or more condition outcomes were overridden for simulation.")
  }

  return {
    qa_marker: GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER,
    read_only: true,
    scenario,
    evaluatedAt: now,
    fromPatternStepId,
    path: {
      kind: stepResult.pathKind,
      resolution: stepResult.resolution,
      reason: stepResult.reason,
      selectedEdgeId: stepResult.selectedEdge?.id ?? null,
      targetPatternStepId: stepResult.targetPatternStepId,
    },
    graph,
    conditionEvaluations,
    branchDecisions,
    waits,
    timeouts,
    skippedSteps: stepResult.skippedSteps,
    evidenceRefs,
    warnings,
    resolver: {
      selectedEdge: stepResult.selectedEdge,
      targetPatternStepId: stepResult.targetPatternStepId,
      skippedEdges: stepResult.selectedEdge
        ? edges.filter((edge) => edge.id !== stepResult.selectedEdge!.id)
        : edges,
      reason: stepResult.reason,
      resolution: stepResult.resolution,
    },
  }
}

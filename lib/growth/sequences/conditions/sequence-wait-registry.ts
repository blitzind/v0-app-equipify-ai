import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthSequenceEnrollment, GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import {
  listGrowthSequenceEnrollmentSteps,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"
import {
  appendBranchDecision,
  createWait,
  listConditionsForStep,
  listEdgesFromPatternStep,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import {
  recordSequenceBranchEvaluatedAudit,
  recordSequenceWaitStartedAudit,
} from "@/lib/growth/sequences/conditions/sequence-branch-audit"
import {
  identifySkippedBranchTargetPatternStepIds,
  resolveSequenceBranchEdges,
  type SequenceBranchResolverEvaluation,
} from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import { evaluateSequenceConditionSpecReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import type { SequenceConditionEvaluationResult } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"
import {
  isWaitUntilEventConditionEvent,
  mapWaitResolutionToBranchDecision,
  type SequenceBranchAdvancementResult,
} from "@/lib/growth/sequences/conditions/sequence-wait-registry-types"

export type { SequenceBranchAdvancementResult } from "@/lib/growth/sequences/conditions/sequence-wait-registry-types"

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
}

async function evaluateStepConditions(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    patternStepId: string
    now: string
  },
): Promise<{
  evaluations: SequenceBranchResolverEvaluation[]
  results: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }>
}> {
  const conditions = await listConditionsForStep(admin, input.patternStepId)
  const evaluations: SequenceBranchResolverEvaluation[] = []
  const results: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }> = []

  for (const condition of conditions) {
    const result = await evaluateSequenceConditionSpecReadOnly(admin, {
      enrollmentId: input.enrollmentId,
      enrollmentStepId: input.enrollmentStepId,
      conditionSpec: condition.spec,
      now: input.now,
    })
    evaluations.push({ conditionId: condition.id, matched: result.matched })
    results.push({ conditionId: condition.id, result })
  }

  return { evaluations, results }
}

function findDeferredWaitCondition(input: {
  edges: Awaited<ReturnType<typeof listEdgesFromPatternStep>>
  evaluations: SequenceBranchResolverEvaluation[]
  conditionResults: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }>
}): { conditionId: string; event: string; source: string } | null {
  for (const edge of input.edges) {
    if (edge.edgeType !== "conditional_true" || !edge.conditionId) continue
    const evaluation = input.evaluations.find((entry) => entry.conditionId === edge.conditionId)
    if (evaluation?.matched) continue
    const result = input.conditionResults.find((entry) => entry.conditionId === edge.conditionId)?.result
    if (!result || !isWaitUntilEventConditionEvent(result.event)) continue
    return { conditionId: edge.conditionId, event: result.event, source: result.source }
  }
  return null
}

export async function scheduleBranchTargetEnrollmentStep(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    pattern: GrowthSequencePattern
    targetPatternStepId: string
    skippedPatternStepIds: string[]
    scheduledAt: string
    skipReason: string
  },
): Promise<GrowthSequenceEnrollmentStep | null> {
  const steps = await listGrowthSequenceEnrollmentSteps(admin, input.enrollmentId)
  const targetPatternStep = input.pattern.steps.find((step) => step.id === input.targetPatternStepId)
  if (!targetPatternStep) return null

  for (const skippedPatternStepId of input.skippedPatternStepIds) {
    const skippedStep = steps.find(
      (step) => step.sequencePatternStepId === skippedPatternStepId && step.status === "pending",
    )
    if (!skippedStep) continue
    await updateGrowthSequenceEnrollmentStep(admin, skippedStep.id, {
      status: "branch_skipped",
      skipReason: input.skipReason,
      completedAt: input.scheduledAt,
    })
  }

  const targetStep = steps.find((step) => step.sequencePatternStepId === input.targetPatternStepId)
  if (!targetStep) return null

  if (targetStep.status === "branch_skipped" || targetStep.status === "pending") {
    return updateGrowthSequenceEnrollmentStep(admin, targetStep.id, {
      status: "pending",
      scheduledFor: input.scheduledAt,
      skipReason: null,
    })
  }

  return targetStep
}

async function appendBranchDecisionAudit(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    patternStepId: string
    conditionId: string | null
    edgeId: string | null
    decision: "true" | "false" | "timeout" | "skipped"
    source: string
    event: string
    outcomeDetail: string
    evaluatedAt: string
  },
): Promise<void> {
  await appendBranchDecision(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    patternStepId: input.patternStepId,
    conditionId: input.conditionId,
    edgeId: input.edgeId,
    decision: input.decision,
    dslVersion: 1,
    source: input.source as never,
    event: input.event as never,
    outcomeDetail: input.outcomeDetail,
    evaluatedAt: input.evaluatedAt,
  })
}

export async function applySequenceBranchResolution(
  admin: SupabaseClient,
  input: {
    enrollment: GrowthSequenceEnrollment
    completedStep: GrowthSequenceEnrollmentStep
    pattern: GrowthSequencePattern
    now: string
    deferMaterializeTransport: true
  },
): Promise<SequenceBranchAdvancementResult> {
  const edges = await listEdgesFromPatternStep(
    admin,
    input.pattern.id,
    input.completedStep.sequencePatternStepId,
  )
  if (edges.length === 0) return { kind: "linear" }

  const { evaluations, results: conditionResults } = await evaluateStepConditions(admin, {
    enrollmentId: input.enrollment.id,
    enrollmentStepId: input.completedStep.id,
    patternStepId: input.completedStep.sequencePatternStepId,
    now: input.now,
  })

  const resolver = resolveSequenceBranchEdges({
    fromPatternStepId: input.completedStep.sequencePatternStepId,
    edges,
    evaluations,
  })

  if (resolver.resolution === "conditional_true" && resolver.targetPatternStepId) {
    return materializeBranchResolution(admin, {
      enrollment: input.enrollment,
      completedStep: input.completedStep,
      pattern: input.pattern,
      now: input.now,
      edges,
      resolver,
      conditionResults,
    })
  }

  const deferredWait = findDeferredWaitCondition({ edges, evaluations, conditionResults })
  if (deferredWait) {
    await updateGrowthSequenceEnrollmentStep(admin, input.completedStep.id, {
      status: "waiting",
      completedAt: null,
    })

    const wait = await createWait(admin, {
      enrollmentId: input.enrollment.id,
      enrollmentStepId: input.completedStep.id,
      patternStepId: input.completedStep.sequencePatternStepId,
      conditionId: deferredWait.conditionId,
      waitKind: "until_event",
      status: "active",
      waitedForSource: deferredWait.source as never,
      waitedForEvent: deferredWait.event as never,
      startedAt: input.now,
    })

    await recordSequenceWaitStartedAudit(admin, {
      enrollmentId: input.enrollment.id,
      enrollmentStepId: input.completedStep.id,
      leadId: input.completedStep.leadId,
      waitId: wait.id,
      conditionId: deferredWait.conditionId,
      waitedForEvent: deferredWait.event,
      occurredAt: input.now,
    })

    return { kind: "waiting", waitId: wait.id }
  }

  if (!resolver.targetPatternStepId) {
    return { kind: "blocked", reason: resolver.reason }
  }

  return materializeBranchResolution(admin, {
    enrollment: input.enrollment,
    completedStep: input.completedStep,
    pattern: input.pattern,
    now: input.now,
    edges,
    resolver,
    conditionResults,
  })
}

async function materializeBranchResolution(
  admin: SupabaseClient,
  input: {
    enrollment: GrowthSequenceEnrollment
    completedStep: GrowthSequenceEnrollmentStep
    pattern: GrowthSequencePattern
    now: string
    edges: Awaited<ReturnType<typeof listEdgesFromPatternStep>>
    resolver: ReturnType<typeof resolveSequenceBranchEdges>
    conditionResults: Array<{ conditionId: string; result: SequenceConditionEvaluationResult }>
  },
): Promise<SequenceBranchAdvancementResult> {
  const skippedPatternStepIds = identifySkippedBranchTargetPatternStepIds({
    edges: input.edges,
    selectedEdge: input.resolver.selectedEdge,
  })
  const evidence =
    input.conditionResults.find((entry) => entry.conditionId === input.resolver.selectedEdge?.conditionId)
      ?.result.evidence ??
    input.conditionResults[0]?.result.evidence ??
    []

  await recordSequenceBranchEvaluatedAudit(admin, {
    enrollmentId: input.enrollment.id,
    enrollmentStepId: input.completedStep.id,
    leadId: input.completedStep.leadId,
    fromPatternStepId: input.completedStep.sequencePatternStepId,
    resolver: input.resolver,
    evidence,
    skippedPatternStepIds,
    occurredAt: input.now,
  })

  const primaryResult =
    input.conditionResults.find((entry) => entry.conditionId === input.resolver.selectedEdge?.conditionId)
      ?.result ?? input.conditionResults[0]?.result

  await appendBranchDecisionAudit(admin, {
    enrollmentId: input.enrollment.id,
    enrollmentStepId: input.completedStep.id,
    patternStepId: input.completedStep.sequencePatternStepId,
    conditionId: input.resolver.selectedEdge?.conditionId ?? null,
    edgeId: input.resolver.selectedEdge?.id ?? null,
    decision: mapWaitResolutionToBranchDecision("matched"),
    source: primaryResult?.source ?? "email",
    event: primaryResult?.event ?? "email.opened",
    outcomeDetail: input.resolver.reason,
    evaluatedAt: input.now,
  })

  const targetPatternStep = input.pattern.steps.find((step) => step.id === input.resolver.targetPatternStepId)
  const scheduledAt = targetPatternStep
    ? addDays(input.now, targetPatternStep.delayDaysMin)
    : input.now

  const targetStep = await scheduleBranchTargetEnrollmentStep(admin, {
    enrollmentId: input.enrollment.id,
    pattern: input.pattern,
    targetPatternStepId: input.resolver.targetPatternStepId!,
    skippedPatternStepIds,
    scheduledAt,
    skipReason: "Non-selected branch path skipped.",
  })

  if (targetStep) {
    await updateGrowthSequenceEnrollment(admin, input.enrollment.id, {
      currentStepOrder: targetStep.stepOrder,
    })
  }

  return targetStep
    ? { kind: "branched", targetEnrollmentStepId: targetStep.id }
    : { kind: "blocked", reason: input.resolver.reason }
}

export { resolveSequenceEnrollmentWaitRegistry } from "@/lib/growth/sequences/conditions/sequence-wait-resolver"

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthSequenceEnrollmentStepById,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"
import {
  appendBranchDecision,
  listEdgesFromPatternStep,
  updateWait,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import {
  evaluateSequenceBranchAdvanceGate,
  recordSequenceAdvancementBlockedAudit,
} from "@/lib/growth/sequences/conditions/sequence-branch-advance-gate"
import {
  recordSequenceBranchEvaluatedAudit,
  recordSequenceConditionTimeoutAudit,
  recordSequenceWaitResolvedAudit,
} from "@/lib/growth/sequences/conditions/sequence-branch-audit"
import {
  identifySkippedBranchTargetPatternStepIds,
  resolveSequenceBranchEdges,
  type SequenceBranchResolverEvaluation,
} from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import { evaluateSequenceConditionSpecReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import type { SequenceConditionEvaluationResult } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"
import {
  mapWaitResolutionToBranchDecision,
  type SequenceWaitResolutionReason,
} from "@/lib/growth/sequences/conditions/sequence-wait-registry-types"
import type { SequenceBranchAdvancementResult } from "@/lib/growth/sequences/conditions/sequence-wait-registry-types"

export { GROWTH_SEQUENCE_WAIT_RESOLVER_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-wait-registry-types"

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
}

async function loadPatternForWait(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<GrowthSequencePattern | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("sequence_pattern_id")
    .eq("id", enrollmentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const patternId = data?.sequence_pattern_id ? String(data.sequence_pattern_id) : null
  if (!patternId) return null
  const patterns = await listGrowthSequencePatterns(admin)
  return patterns.find((entry) => entry.id === patternId) ?? null
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
  const { listConditionsForStep } = await import(
    "@/lib/growth/sequences/conditions/sequence-condition-repository"
  )
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

async function executeWaitResolution(
  admin: SupabaseClient,
  input: {
    waitId: string
    resolutionReason: SequenceWaitResolutionReason
    pattern: GrowthSequencePattern
    now?: string
    forceTargetPatternStepId?: string | null
    wakeContext?: boolean
  },
): Promise<SequenceBranchAdvancementResult> {
  const now = input.now ?? new Date().toISOString()
  const { data: waitRow, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("*")
    .eq("id", input.waitId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!waitRow) throw new Error("wait_not_found")

  const enrollmentId = String(waitRow.enrollment_id)
  const enrollmentStepId = String(waitRow.enrollment_step_id)
  const patternStepId = waitRow.pattern_step_id ? String(waitRow.pattern_step_id) : null
  if (!patternStepId) throw new Error("wait_missing_pattern_step")

  const gate = await evaluateSequenceBranchAdvanceGate(admin, { sequenceEnrollmentId: enrollmentId })
  const completedStep = await fetchGrowthSequenceEnrollmentStepById(admin, enrollmentStepId)
  if (!completedStep) throw new Error("enrollment_step_not_found")

  if (gate.blocked) {
    await recordSequenceAdvancementBlockedAudit(admin, {
      enrollmentId,
      enrollmentStepId,
      leadId: completedStep.leadId,
      stepOrder: completedStep.stepOrder,
      gate,
      occurredAt: now,
    })
    return { kind: "blocked", reason: gate.reason ?? gate.code ?? "pause_gate_blocked" }
  }

  const edges = await listEdgesFromPatternStep(admin, input.pattern.id, patternStepId)
  const { evaluations, results: conditionResults } = await evaluateStepConditions(admin, {
    enrollmentId,
    enrollmentStepId,
    patternStepId,
    now,
  })

  let resolver = resolveSequenceBranchEdges({
    fromPatternStepId: patternStepId,
    edges,
    evaluations,
  })

  if (input.resolutionReason === "timeout") {
    await recordSequenceConditionTimeoutAudit(admin, {
      enrollmentId,
      enrollmentStepId,
      leadId: completedStep.leadId,
      waitId: input.waitId,
      conditionId: String(waitRow.condition_id ?? ""),
      occurredAt: now,
    })

    const timeoutEdge = edges.find((edge) => edge.edgeType === "timeout")
    if (timeoutEdge) {
      resolver = {
        selectedEdge: timeoutEdge,
        targetPatternStepId: timeoutEdge.toPatternStepId,
        skippedEdges: edges.filter((edge) => edge.id !== timeoutEdge.id),
        reason: "Wait timed out — timeout edge selected.",
        resolution: "conditional_false",
      }
    }
  }

  if (input.forceTargetPatternStepId) {
    const forcedEdge =
      edges.find((edge) => edge.toPatternStepId === input.forceTargetPatternStepId) ?? resolver.selectedEdge
    resolver = {
      selectedEdge: forcedEdge,
      targetPatternStepId: input.forceTargetPatternStepId,
      skippedEdges: edges.filter((edge) => edge.id !== forcedEdge?.id),
      reason: "Operator override — forced branch target selected.",
      resolution: forcedEdge?.edgeType === "default" ? "default" : "conditional_true",
    }
  }

  if (!resolver.targetPatternStepId) {
    await updateWait(admin, input.waitId, {
      status: input.resolutionReason === "cancelled" ? "cancelled" : "timed_out",
      resolvedAt: now,
      resolutionReason: input.resolutionReason,
    })
    return { kind: "blocked", reason: resolver.reason }
  }

  await updateWait(admin, input.waitId, {
    status: input.resolutionReason === "timeout" ? "timed_out" : "resolved",
    resolvedAt: now,
    resolutionReason: input.resolutionReason,
  })

  await updateGrowthSequenceEnrollmentStep(admin, completedStep.id, {
    status: "executed",
    completedAt: now,
  })

  const skippedPatternStepIds = identifySkippedBranchTargetPatternStepIds({
    edges,
    selectedEdge: resolver.selectedEdge,
  })

  await recordSequenceWaitResolvedAudit(admin, {
    enrollmentId,
    enrollmentStepId,
    leadId: completedStep.leadId,
    waitId: input.waitId,
    resolutionReason: input.resolutionReason,
    selectedEdge: resolver.selectedEdge,
    occurredAt: now,
  })

  const evidence =
    conditionResults.find((entry) => entry.conditionId === resolver.selectedEdge?.conditionId)?.result
      .evidence ??
    conditionResults[0]?.result.evidence ??
    []

  await recordSequenceBranchEvaluatedAudit(admin, {
    enrollmentId,
    enrollmentStepId,
    leadId: completedStep.leadId,
    fromPatternStepId: patternStepId,
    resolver,
    evidence,
    skippedPatternStepIds,
    occurredAt: now,
  })

  const primaryResult =
    conditionResults.find((entry) => entry.conditionId === resolver.selectedEdge?.conditionId)?.result ??
    conditionResults[0]?.result

  await appendBranchDecisionAudit(admin, {
    enrollmentId,
    enrollmentStepId,
    patternStepId,
    conditionId: resolver.selectedEdge?.conditionId ?? null,
    edgeId: resolver.selectedEdge?.id ?? null,
    decision: mapWaitResolutionToBranchDecision(input.resolutionReason),
    source: primaryResult?.source ?? "email",
    event: primaryResult?.event ?? "email.opened",
    outcomeDetail: resolver.reason,
    evaluatedAt: now,
  })

  const { scheduleBranchTargetEnrollmentStep } = await import(
    "@/lib/growth/sequences/conditions/sequence-wait-registry"
  )
  const targetPatternStep = input.pattern.steps.find((step) => step.id === resolver.targetPatternStepId)
  const scheduledAt = targetPatternStep ? addDays(now, targetPatternStep.delayDaysMin) : now
  const targetStep = await scheduleBranchTargetEnrollmentStep(admin, {
    enrollmentId,
    pattern: input.pattern,
    targetPatternStepId: resolver.targetPatternStepId,
    skippedPatternStepIds,
    scheduledAt,
    skipReason: input.wakeContext
      ? "Non-selected branch path skipped after event wake."
      : "Non-selected branch path skipped after wait resolution.",
  })

  if (targetStep) {
    await updateGrowthSequenceEnrollment(admin, enrollmentId, { currentStepOrder: targetStep.stepOrder })
  }

  return targetStep
    ? { kind: "branched", targetEnrollmentStepId: targetStep.id }
    : { kind: "blocked", reason: resolver.reason }
}

async function resolveWaitWithPatternLoad(
  admin: SupabaseClient,
  input: {
    waitId: string
    resolutionReason: SequenceWaitResolutionReason
    pattern?: GrowthSequencePattern
    now?: string
    forceTargetPatternStepId?: string | null
    wakeContext?: boolean
  },
): Promise<SequenceBranchAdvancementResult> {
  const { data: waitRow, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("enrollment_id")
    .eq("id", input.waitId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!waitRow) throw new Error("wait_not_found")

  const pattern =
    input.pattern ?? (await loadPatternForWait(admin, String(waitRow.enrollment_id)))
  if (!pattern) throw new Error("pattern_not_found")

  return executeWaitResolution(admin, {
    waitId: input.waitId,
    resolutionReason: input.resolutionReason,
    pattern,
    now: input.now,
    forceTargetPatternStepId: input.forceTargetPatternStepId,
    wakeContext: input.wakeContext,
  })
}

export async function resolveWaitMatched(
  admin: SupabaseClient,
  input: { waitId: string; pattern?: GrowthSequencePattern; now?: string },
): Promise<SequenceBranchAdvancementResult> {
  return resolveWaitWithPatternLoad(admin, {
    waitId: input.waitId,
    resolutionReason: "matched",
    pattern: input.pattern,
    now: input.now,
    wakeContext: true,
  })
}

export async function resolveWaitTimeout(
  admin: SupabaseClient,
  input: { waitId: string; pattern?: GrowthSequencePattern; now?: string },
): Promise<SequenceBranchAdvancementResult> {
  return resolveWaitWithPatternLoad(admin, {
    waitId: input.waitId,
    resolutionReason: "timeout",
    pattern: input.pattern,
    now: input.now,
  })
}

export async function resolveWaitCancelled(
  admin: SupabaseClient,
  input: { waitId: string; pattern?: GrowthSequencePattern; now?: string },
): Promise<SequenceBranchAdvancementResult> {
  return resolveWaitWithPatternLoad(admin, {
    waitId: input.waitId,
    resolutionReason: "cancelled",
    pattern: input.pattern,
    now: input.now,
  })
}

export async function resolveWaitOperatorOverride(
  admin: SupabaseClient,
  input: {
    waitId: string
    forceTargetPatternStepId: string
    pattern?: GrowthSequencePattern
    now?: string
  },
): Promise<SequenceBranchAdvancementResult> {
  return resolveWaitWithPatternLoad(admin, {
    waitId: input.waitId,
    resolutionReason: "operator_override",
    pattern: input.pattern,
    now: input.now,
    forceTargetPatternStepId: input.forceTargetPatternStepId,
  })
}

export async function resolveSequenceEnrollmentWaitRegistry(
  admin: SupabaseClient,
  input: {
    waitId: string
    resolutionReason: SequenceWaitResolutionReason
    pattern: GrowthSequencePattern
    now?: string
    forceTargetPatternStepId?: string | null
  },
): Promise<SequenceBranchAdvancementResult> {
  switch (input.resolutionReason) {
    case "matched":
      return resolveWaitMatched(admin, {
        waitId: input.waitId,
        pattern: input.pattern,
        now: input.now,
      })
    case "timeout":
      return resolveWaitTimeout(admin, {
        waitId: input.waitId,
        pattern: input.pattern,
        now: input.now,
      })
    case "cancelled":
      return resolveWaitCancelled(admin, {
        waitId: input.waitId,
        pattern: input.pattern,
        now: input.now,
      })
    case "operator_override":
      if (!input.forceTargetPatternStepId) {
        throw new Error("operator_override_requires_target")
      }
      return resolveWaitOperatorOverride(admin, {
        waitId: input.waitId,
        forceTargetPatternStepId: input.forceTargetPatternStepId,
        pattern: input.pattern,
        now: input.now,
      })
    default:
      throw new Error("unsupported_resolution_reason")
  }
}

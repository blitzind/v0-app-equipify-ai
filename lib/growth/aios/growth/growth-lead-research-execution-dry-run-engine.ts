/** GE-AIOS-GROWTH-3B — Deterministic internal workflow dry-run engine (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  assertExecutionTransition,
  buildInitialStepProgress,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES,
  isInternalMutationRuntimeWorkflow,
  validateExecutionRuntimeGates,
  type GrowthLeadResearchExecutionContext,
  type GrowthLeadResearchExecutionRuntimeValidationResult,
  type GrowthLeadResearchExecutionState,
  type GrowthLeadResearchInternalMutationRuntimeWorkflow,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { runDeterministicExecutionStep } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-step-runner"
import {
  buildDryRunExecutionId,
  buildDryRunId,
  buildDryRunMutationId,
  DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS,
  type GrowthLeadResearchExecutionDryRunPredictedAuditEvent,
  type GrowthLeadResearchExecutionDryRunReport,
  type GrowthLeadResearchExecutionDryRunSimulatedStep,
  type GrowthLeadResearchExecutionDryRunSimulatedTransition,
  type GrowthLeadResearchExecutionDryRunStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"

function nowIso(now?: string): string {
  return now ?? new Date().toISOString()
}

/** Dry-run validates gates as if runtime were enabled — operators test before enabling real execution. */
export function validateDryRunExecutionGates(input: Parameters<typeof validateExecutionRuntimeGates>[0]): GrowthLeadResearchExecutionRuntimeValidationResult {
  return validateExecutionRuntimeGates({
    ...input,
    runtimeEnabled: true,
  })
}

function resolveDryRunFinalStatus(input: {
  workflowType: string
  validation: GrowthLeadResearchExecutionRuntimeValidationResult
  simulationFailed: boolean
  simulationError: string | null
}): GrowthLeadResearchExecutionDryRunStatus {
  if (!isInternalMutationRuntimeWorkflow(input.workflowType as never)) {
    return "dry_run_not_allowed"
  }
  if (!input.validation.allowed) {
    return "dry_run_failed_gate_validation"
  }
  if (input.simulationFailed) {
    return "dry_run_blocked"
  }
  return "dry_run_passed"
}

function pushPredictedAudit(
  events: GrowthLeadResearchExecutionDryRunPredictedAuditEvent[],
  input: GrowthLeadResearchExecutionDryRunPredictedAuditEvent,
): void {
  events.push(input)
}

function pushTransition(
  transitions: GrowthLeadResearchExecutionDryRunSimulatedTransition[],
  input: GrowthLeadResearchExecutionDryRunSimulatedTransition,
): GrowthLeadResearchExecutionDryRunStatus | null {
  const check = assertExecutionTransition(
    input.previousState ?? "queued",
    input.nextState,
  )
  if (!check.ok && input.previousState != null) {
    return "dry_run_blocked"
  }
  transitions.push(input)
  return null
}

export function runInternalWorkflowDryRun(input: {
  organizationId: string
  planId: string
  leadId: string
  executionPlan: GrowthLeadResearchExecutionPlan
  validation: GrowthLeadResearchExecutionRuntimeValidationResult
  now?: string
  dryRunId?: string
}): GrowthLeadResearchExecutionDryRunReport {
  const now = nowIso(input.now)
  const dryRunId = input.dryRunId ?? buildDryRunId(input.planId, now)
  const workflowType = input.executionPlan.workflowType
  const simulatedStateTransitions: GrowthLeadResearchExecutionDryRunSimulatedTransition[] = []
  const simulatedSteps: GrowthLeadResearchExecutionDryRunSimulatedStep[] = []
  const predictedAuditEvents: GrowthLeadResearchExecutionDryRunPredictedAuditEvent[] = []
  const blockedReasons: string[] = []

  if (!isInternalMutationRuntimeWorkflow(workflowType)) {
    return {
      dryRunId,
      planId: input.planId,
      leadId: input.leadId,
      organizationId: input.organizationId,
      workflowType,
      gateResults: input.validation,
      simulatedStateTransitions,
      simulatedSteps,
      simulatedInternalMutations: [],
      blockedReasons: [`Workflow ${workflowType} is not allowed for internal dry-run.`],
      predictedAuditEvents,
      sideEffectCounters: { ...DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS },
      finalStatus: "dry_run_not_allowed",
      generatedAt: now,
      nonPersistent: true,
    }
  }

  if (!input.validation.allowed) {
    if (input.validation.blockReason) blockedReasons.push(input.validation.blockReason)
    return {
      dryRunId,
      planId: input.planId,
      leadId: input.leadId,
      organizationId: input.organizationId,
      workflowType,
      gateResults: input.validation,
      simulatedStateTransitions,
      simulatedSteps,
      simulatedInternalMutations: [],
      blockedReasons,
      predictedAuditEvents,
      sideEffectCounters: { ...DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS },
      finalStatus: "dry_run_failed_gate_validation",
      generatedAt: now,
      nonPersistent: true,
    }
  }

  const internalWorkflow = workflowType as GrowthLeadResearchInternalMutationRuntimeWorkflow
  const executionId = buildDryRunExecutionId(input.planId)
  let currentState: GrowthLeadResearchExecutionState = "queued"
  let auditSequence = 0

  const recordTransition = (
    nextState: GrowthLeadResearchExecutionState,
    summary: string,
    eventType: string,
    stepId: string | null = null,
  ): GrowthLeadResearchExecutionDryRunStatus | null => {
    const blocked = pushTransition(simulatedStateTransitions, {
      previousState: currentState,
      nextState,
      occurredAt: now,
      summary,
    })
    if (blocked) return blocked
    pushPredictedAudit(predictedAuditEvents, {
      eventType,
      occurredAt: now,
      previousState: currentState,
      nextState,
      stepId,
      summary,
    })
    currentState = nextState
    auditSequence += 1
    return null
  }

  let blockedStatus = recordTransition(
    "validating",
    "Validating execution gates (dry-run).",
    GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
  )
  if (blockedStatus) {
    blockedReasons.push("Invalid state transition during dry-run simulation.")
    return finalizeReport()
  }

  blockedStatus = recordTransition(
    "ready",
    "Execution gates passed — ready to execute (dry-run).",
    GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
  )
  if (blockedStatus) {
    blockedReasons.push("Invalid state transition during dry-run simulation.")
    return finalizeReport()
  }

  const context: GrowthLeadResearchExecutionContext = {
    executionId,
    planId: input.planId,
    leadId: input.leadId,
    organizationId: input.organizationId,
    workflowType: internalWorkflow,
    executionPlan: input.executionPlan,
    startedAt: now,
    gateSnapshot: input.validation.gateSnapshot,
    internalMutations: [],
    outboundActionsAttempted: 0,
    providerCallsAttempted: 0,
    coreMutationsAttempted: 0,
  }

  blockedStatus = recordTransition(
    "executing",
    "Executing workflow steps sequentially (dry-run).",
    GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
  )
  if (blockedStatus) {
    blockedReasons.push("Invalid state transition during dry-run simulation.")
    return finalizeReport()
  }

  let currentContext = context
  const initialSteps = buildInitialStepProgress(input.executionPlan)
  let simulationFailed = false
  let simulationError: string | null = null

  for (let stepIndex = 0; stepIndex < input.executionPlan.estimatedSteps.length; stepIndex += 1) {
    const stepDef = input.executionPlan.estimatedSteps[stepIndex]
    const runningStep: GrowthLeadResearchExecutionDryRunSimulatedStep = {
      stepId: stepDef.stepId,
      label: stepDef.label,
      status: "running",
      startedAt: now,
      completedAt: null,
      mutationId: null,
      error: null,
    }
    simulatedSteps.push(runningStep)

    const result = runDeterministicExecutionStep({
      context: currentContext,
      step: stepDef,
      now,
    })

    if (!result.ok) {
      runningStep.status = "failed"
      runningStep.completedAt = now
      runningStep.error = result.error
      simulationFailed = true
      simulationError = result.error
      blockedReasons.push(result.error)
      break
    }

    const mutation = {
      ...result.mutation,
      mutationId: buildDryRunMutationId(dryRunId, stepDef.stepId),
    }
    currentContext = {
      ...result.context,
      internalMutations: [...currentContext.internalMutations, mutation],
    }

    runningStep.status = "completed"
    runningStep.completedAt = now
    runningStep.mutationId = mutation.mutationId

    pushPredictedAudit(predictedAuditEvents, {
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.stepCompleted,
      occurredAt: now,
      previousState: "executing",
      nextState: "executing",
      stepId: stepDef.stepId,
      summary: mutation.summary,
    })
    auditSequence += 1
  }

  if (!simulationFailed) {
    blockedStatus = recordTransition(
      "completed",
      "Dry-run completed — all internal steps simulated.",
      GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    )
    if (blockedStatus) {
      simulationFailed = true
      simulationError = "Invalid transition to completed."
      blockedReasons.push(simulationError)
    }
  } else {
    recordTransition(
      "failed",
      simulationError ?? "Dry-run step simulation failed.",
      GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    )
  }

  return finalizeReport()

  function finalizeReport(): GrowthLeadResearchExecutionDryRunReport {
    return {
      dryRunId,
      planId: input.planId,
      leadId: input.leadId,
      organizationId: input.organizationId,
      workflowType: internalWorkflow,
      gateResults: input.validation,
      simulatedStateTransitions,
      simulatedSteps: simulatedSteps.length > 0 ? simulatedSteps : initialSteps.map((step) => ({
        stepId: step.stepId,
        label: step.label,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        mutationId: step.mutationId,
        error: step.error,
      })),
      simulatedInternalMutations: currentContext.internalMutations,
      blockedReasons,
      predictedAuditEvents,
      sideEffectCounters: { ...DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS },
      finalStatus: resolveDryRunFinalStatus({
        workflowType,
        validation: input.validation,
        simulationFailed,
        simulationError,
      }),
      generatedAt: now,
      nonPersistent: true,
    }
  }
}

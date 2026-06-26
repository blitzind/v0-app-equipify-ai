/** GE-AIOS-GROWTH-3A — Execution runtime lifecycle service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { auditWorkflowBoundary } from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { resolveApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import {
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import { createEventBackedExecutionRuntimeStore } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-repository"
import { runDeterministicExecutionStep } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-step-runner"
import type { GrowthLeadResearchExecutionRuntimeStore } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-store"
import {
  assertExecutionTransition,
  buildExecutionAuditId,
  buildExecutionId,
  buildInitialStepProgress,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  isInternalMutationRuntimeWorkflow,
  isTerminalExecutionState,
  validateExecutionRuntimeGates,
  type GrowthLeadResearchExecutionAuditEntry,
  type GrowthLeadResearchExecutionContext,
  type GrowthLeadResearchExecutionRecord,
  type GrowthLeadResearchExecutionRuntimeValidationResult,
  type GrowthLeadResearchInternalMutationRuntimeWorkflow,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { buildFutureExecutionHandoffContract } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { resolveFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_DEFAULT_ENABLED,
  resolveExecutionRuntimePilotEnabledFromEnv,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"

export type GrowthLeadResearchExecutionEnqueueInput = {
  organizationId: string
  planId: string
  leadId: string
  companyName: string | null
  missionId?: string | null
  executionPlan: GrowthLeadResearchExecutionPlan
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  confidence: number | null
  operatorUserId?: string | null
  runtimeEnabled?: boolean
  now?: string
}

export type GrowthLeadResearchExecutionLifecycleResult = {
  record: GrowthLeadResearchExecutionRecord
  validation: GrowthLeadResearchExecutionRuntimeValidationResult | null
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString()
}

async function appendAudit(
  store: GrowthLeadResearchExecutionRuntimeStore,
  input: {
    executionId: string
    sequence: number
    eventType: string
    previousState: GrowthLeadResearchExecutionRecord["state"] | null
    nextState: GrowthLeadResearchExecutionRecord["state"] | null
    stepId?: string | null
    summary: string
    detail?: string | null
    metadata?: Record<string, unknown>
    now?: string
  },
): Promise<GrowthLeadResearchExecutionAuditEntry> {
  const entry: GrowthLeadResearchExecutionAuditEntry = {
    auditId: buildExecutionAuditId(input.executionId, input.sequence),
    executionId: input.executionId,
    eventType: input.eventType,
    occurredAt: nowIso(input.now),
    previousState: input.previousState,
    nextState: input.nextState,
    stepId: input.stepId ?? null,
    summary: input.summary,
    detail: input.detail ?? null,
    metadata: input.metadata ?? {},
  }
  await store.appendAudit(entry)
  return entry
}

async function persistRecord(
  store: GrowthLeadResearchExecutionRuntimeStore,
  record: GrowthLeadResearchExecutionRecord,
): Promise<GrowthLeadResearchExecutionRecord> {
  await store.save(record)
  return record
}

async function transitionRecord(
  store: GrowthLeadResearchExecutionRuntimeStore,
  record: GrowthLeadResearchExecutionRecord,
  nextState: GrowthLeadResearchExecutionRecord["state"],
  input: {
    auditSequence: number
    eventType: string
    summary: string
    detail?: string | null
    patch?: Partial<GrowthLeadResearchExecutionRecord>
    now?: string
  },
): Promise<GrowthLeadResearchExecutionRecord> {
  const transition = assertExecutionTransition(record.state, nextState)
  if (!transition.ok) {
    throw new Error(transition.message)
  }
  const updated: GrowthLeadResearchExecutionRecord = {
    ...record,
    ...input.patch,
    state: nextState,
    updatedAt: nowIso(input.now),
    completedAt: isTerminalExecutionState(nextState) ? nowIso(input.now) : record.completedAt,
  }
  await appendAudit(store, {
    executionId: record.executionId,
    sequence: input.auditSequence,
    eventType: input.eventType,
    previousState: record.state,
    nextState,
    summary: input.summary,
    detail: input.detail ?? null,
    now: input.now,
  })
  return persistRecord(store, updated)
}

export async function resolveExecutionRuntimePilotEnabled(
  admin: SupabaseClient,
  input: { organizationId: string; override?: boolean },
): Promise<boolean> {
  void admin
  void input.organizationId
  if (input.override != null) return input.override
  if (GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_DEFAULT_ENABLED) return true
  return resolveExecutionRuntimePilotEnabledFromEnv()
}

export async function resolveExecutionRuntimeEnabled(
  admin: SupabaseClient,
  input: { organizationId: string; override?: boolean },
): Promise<boolean> {
  if (input.override != null) return input.override
  if (!GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED) return false
  const infrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })
  return infrastructure.workflowFeatureEnabled
}

export async function buildExecutionRuntimeValidation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    executionPlan: GrowthLeadResearchExecutionPlan
    approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
    runtimeEnabled?: boolean
  },
): Promise<GrowthLeadResearchExecutionRuntimeValidationResult> {
  const runtimeEnabled = await resolveExecutionRuntimeEnabled(admin, {
    organizationId: input.organizationId,
    override: input.runtimeEnabled,
  })
  const infrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })
  const workflowType = input.executionPlan.workflowType as GrowthLeadResearchCanonicalWorkflowType
  const boundary = auditWorkflowBoundary(workflowType, infrastructure)
  const workflowPreflight = buildWorkflowPreflightChecklist({ boundary, infrastructure })
  const readinessState = resolveApprovedPlanReadinessState({
    plan: input.executionPlan,
    approvalStatus: input.approvalState,
    confidence: input.confidence,
  })
  const handoff = buildFutureExecutionHandoffContract({
    planId: "validation-only",
    leadId: "validation-only",
    companyName: null,
    plan: input.executionPlan,
    approvalState: input.approvalState,
    readinessState,
    readinessReason: readinessState,
    futureExecutionEligible: readinessState === "ready_for_future_execution",
    evidenceSummary: null,
    auditTrail: { leadId: "validation-only", planId: "validation-only", entries: [] },
    infrastructure,
    generatedAt: new Date().toISOString(),
    observationHref: "/growth/os",
  })
  const planPreflight = buildPlanPreflightChecklist({ handoff, workflowChecklist: workflowPreflight })

  return validateExecutionRuntimeGates({
    runtimeEnabled,
    workflowType,
    approvalState: input.approvalState,
    readinessState,
    handoffState: handoff.handoffState,
    preflightStatus: planPreflight.preflightStatus,
    boundaryClassification: boundary.classification,
    runtimeImplementationAllowed: planPreflight.runtimeImplementationAllowed,
    futureExecutionAllowed: boundary.futureExecutionAllowed,
  })
}

export async function enqueueGrowthLeadResearchExecution(
  store: GrowthLeadResearchExecutionRuntimeStore,
  input: GrowthLeadResearchExecutionEnqueueInput,
): Promise<GrowthLeadResearchExecutionRecord> {
  if (!isInternalMutationRuntimeWorkflow(input.executionPlan.workflowType)) {
    throw new Error(`Unsupported workflow ${input.executionPlan.workflowType}`)
  }

  const now = nowIso(input.now)
  const executionId = buildExecutionId(input.planId)
  const existing = await store.get(executionId)
  if (existing && !isTerminalExecutionState(existing.state)) {
    return existing
  }

  const record: GrowthLeadResearchExecutionRecord = {
    executionId,
    organizationId: input.organizationId,
    planId: input.planId,
    leadId: input.leadId,
    companyName: input.companyName,
    missionId: input.missionId ?? null,
    workflowType: input.executionPlan.workflowType,
    state: "queued",
    executionPlan: input.executionPlan,
    context: null,
    steps: buildInitialStepProgress(input.executionPlan),
    currentStepIndex: 0,
    gateSnapshot: null,
    blockCode: null,
    blockReason: null,
    queuedAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
    operatorUserId: input.operatorUserId ?? null,
  }

  await appendAudit(store, {
    executionId,
    sequence: 1,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    previousState: null,
    nextState: "queued",
    summary: `Execution queued for ${input.executionPlan.workflowType.replaceAll("_", " ")}.`,
    now,
  })
  return persistRecord(store, record)
}

async function executeRemainingSteps(
  store: GrowthLeadResearchExecutionRuntimeStore,
  record: GrowthLeadResearchExecutionRecord,
  auditSequenceStart: number,
  now: string,
  options?: { maxSteps?: number },
): Promise<GrowthLeadResearchExecutionRecord> {
  let current = record
  let auditSequence = auditSequenceStart
  if (!current.context) return current
  let stepsExecutedThisPass = 0

  while (current.currentStepIndex < current.steps.length) {
    if (current.state === "paused") break
    if (options?.maxSteps != null && stepsExecutedThisPass >= options.maxSteps) break

    const stepIndex = current.currentStepIndex
    const stepDef = current.executionPlan.estimatedSteps[stepIndex]
    const steps = [...current.steps]
    steps[stepIndex] = {
      ...steps[stepIndex],
      status: "running",
      startedAt: steps[stepIndex].startedAt ?? now,
    }
    current = await persistRecord(store, { ...current, steps, updatedAt: now })

    const result = runDeterministicExecutionStep({
      context: current.context,
      step: stepDef,
      now,
    })

    if (!result.ok) {
      steps[stepIndex] = {
        ...steps[stepIndex],
        status: "failed",
        completedAt: now,
        error: result.error,
      }
      current = await transitionRecord(store, { ...current, steps }, "failed", {
        auditSequence: auditSequence++,
        eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
        summary: `Step ${stepDef.stepId} failed.`,
        detail: result.error,
        stepId: stepDef.stepId,
        now,
      })
      return current
    }

    steps[stepIndex] = {
      ...steps[stepIndex],
      status: "completed",
      completedAt: now,
      mutationId: result.mutation.mutationId,
      error: null,
    }

    await appendAudit(store, {
      executionId: current.executionId,
      sequence: auditSequence++,
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.stepCompleted,
      previousState: "executing",
      nextState: "executing",
      stepId: stepDef.stepId,
      summary: result.mutation.summary,
      metadata: { mutation_id: result.mutation.mutationId },
      now,
    })

    current = await persistRecord(store, {
      ...current,
      context: result.context,
      steps,
      currentStepIndex: stepIndex + 1,
      updatedAt: now,
    })
    stepsExecutedThisPass += 1
  }

  if (current.state === "executing" && current.currentStepIndex >= current.steps.length) {
    current = await transitionRecord(store, current, "completed", {
      auditSequence: auditSequence++,
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
      summary: "Execution completed — all internal steps finished.",
      now,
    })
  }

  return current
}

export async function runGrowthLeadResearchExecutionLifecycle(
  store: GrowthLeadResearchExecutionRuntimeStore,
  input: {
    executionId: string
    validation: GrowthLeadResearchExecutionRuntimeValidationResult
    now?: string
    maxSteps?: number
  },
): Promise<GrowthLeadResearchExecutionLifecycleResult> {
  const now = nowIso(input.now)
  const record = await store.get(input.executionId)
  if (!record) {
    throw new Error("execution_not_found")
  }
  if (isTerminalExecutionState(record.state)) {
    return { record, validation: input.validation }
  }

  let current = record
  let auditSequence = (await store.listAudit(record.executionId)).length + 1

  if (current.state === "queued") {
    current = await transitionRecord(store, current, "validating", {
      auditSequence: auditSequence++,
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
      summary: "Validating execution gates.",
      patch: { startedAt: current.startedAt ?? now },
      now,
    })
  }

  if (current.state === "validating") {
    if (!input.validation.allowed) {
      current = await transitionRecord(store, current, "failed", {
        auditSequence: auditSequence++,
        eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
        summary: "Execution validation failed.",
        detail: input.validation.blockReason,
        patch: {
          gateSnapshot: input.validation.gateSnapshot,
          blockCode: input.validation.blockCode,
          blockReason: input.validation.blockReason,
        },
        now,
      })
      return { record: current, validation: input.validation }
    }

    current = await transitionRecord(store, current, "ready", {
      auditSequence: auditSequence++,
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
      summary: "Execution gates passed — ready to execute.",
      patch: {
        gateSnapshot: input.validation.gateSnapshot,
        blockCode: null,
        blockReason: null,
      },
      now,
    })
  }

  if (current.state === "ready") {
    const context: GrowthLeadResearchExecutionContext = {
      executionId: current.executionId,
      planId: current.planId,
      leadId: current.leadId,
      organizationId: current.organizationId,
      workflowType: current.workflowType as GrowthLeadResearchInternalMutationRuntimeWorkflow,
      executionPlan: current.executionPlan,
      startedAt: now,
      gateSnapshot: input.validation.gateSnapshot,
      internalMutations: [],
      outboundActionsAttempted: 0,
      providerCallsAttempted: 0,
      coreMutationsAttempted: 0,
    }
    current = await transitionRecord(store, current, "executing", {
      auditSequence: auditSequence++,
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
      summary: "Executing workflow steps sequentially.",
      patch: { context },
      now,
    })
  }

  if (current.state === "executing" && current.context) {
    current = await executeRemainingSteps(store, current, auditSequence, now, {
      maxSteps: input.maxSteps,
    })
  }

  return { record: current, validation: input.validation }
}

export async function pauseGrowthLeadResearchExecution(
  store: GrowthLeadResearchExecutionRuntimeStore,
  executionId: string,
  now?: string,
): Promise<GrowthLeadResearchExecutionRecord> {
  const record = await store.get(executionId)
  if (!record) throw new Error("execution_not_found")
  if (record.state !== "executing") throw new Error("execution_not_pausable")
  const auditSequence = (await store.listAudit(executionId)).length + 1
  return transitionRecord(store, record, "paused", {
    auditSequence,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    summary: "Execution paused by operator.",
    now,
  })
}

export async function resumeGrowthLeadResearchExecution(
  store: GrowthLeadResearchExecutionRuntimeStore,
  input: {
    executionId: string
    validation: GrowthLeadResearchExecutionRuntimeValidationResult
    now?: string
  },
): Promise<GrowthLeadResearchExecutionLifecycleResult> {
  const record = await store.get(input.executionId)
  if (!record) throw new Error("execution_not_found")
  if (record.state !== "paused") throw new Error("execution_not_paused")
  if (!input.validation.allowed) {
    throw new Error(input.validation.blockReason ?? "validation_failed")
  }

  const now = nowIso(input.now)
  const auditSequence = (await store.listAudit(input.executionId)).length + 1
  const resumed = await transitionRecord(store, record, "executing", {
    auditSequence,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    summary: "Execution resumed by operator.",
    now,
  })

  const finished = await executeRemainingSteps(store, resumed, auditSequence + 1, now)
  return { record: finished, validation: input.validation }
}

export async function cancelGrowthLeadResearchExecution(
  store: GrowthLeadResearchExecutionRuntimeStore,
  executionId: string,
  now?: string,
): Promise<GrowthLeadResearchExecutionRecord> {
  const record = await store.get(executionId)
  if (!record) throw new Error("execution_not_found")
  if (isTerminalExecutionState(record.state)) throw new Error("execution_terminal")
  const auditSequence = (await store.listAudit(executionId)).length + 1
  return transitionRecord(store, record, "cancelled", {
    auditSequence,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    summary: "Execution cancelled by operator.",
    now,
  })
}

export function createGrowthLeadResearchExecutionRuntimeStore(
  admin: SupabaseClient,
  organizationId: string,
): GrowthLeadResearchExecutionRuntimeStore {
  return createEventBackedExecutionRuntimeStore(admin, organizationId)
}

export async function publishExecutionRuntimeLifecycleEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    executionId: string
    summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
    entityType: "growth_execution_runtime",
    entityId: input.executionId,
    payload: {
      qa_marker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
      summary: input.summary,
    },
    metadata: {
      qa_marker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
      ...input.metadata,
    },
  })
}

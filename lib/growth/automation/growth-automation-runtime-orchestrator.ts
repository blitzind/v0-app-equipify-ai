import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getFlow } from "@/lib/growth/automation/growth-automation-repository"
import { createAutomationApprovalGate } from "@/lib/growth/automation/growth-automation-runtime-approval-gate"
import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  type GrowthAutomationRuntimeAdvanceInput,
  type GrowthAutomationRuntimeAdvanceUntilBlockedInput,
  type GrowthAutomationRuntimeCancelExecutionInput,
  type GrowthAutomationRuntimeExecutionRun,
  type GrowthAutomationRuntimePendingJob,
} from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import {
  buildAutomationRuntimeExecutionRun,
  classifyAutomationRuntimeStep,
  executionIssue,
  mergeAutomationExecutionMetadata,
  readAutomationExecutionMetadata,
  resolveAutomationRuntimeCurrentStep,
} from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { advanceGrowthSequenceEnrollmentAfterStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
  setLeadActiveSequenceEnrollment,
  updateGrowthSequenceEnrollment,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { evaluateSequenceBranchAdvanceGate } from "@/lib/growth/sequences/conditions/sequence-branch-advance-gate"
import { evaluateSequenceConditionSpecReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import {
  listConditionsForStep,
  listEdgesFromPatternStep,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import { resolveSequenceBranchEdges } from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import {
  createSequenceExecutionJob,
  findActiveSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"

type LoadedAutomationEnrollment = {
  enrollment: NonNullable<Awaited<ReturnType<typeof fetchGrowthSequenceEnrollmentById>>>
  steps: Awaited<ReturnType<typeof listGrowthSequenceEnrollmentSteps>>
  pattern: NonNullable<Awaited<ReturnType<typeof listGrowthSequencePatterns>>[number]>
  flowId: string
  versionId: string
}

async function loadAutomationEnrollmentContext(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; enrollmentId: string },
): Promise<LoadedAutomationEnrollment> {
  const flow = await getFlow(admin, { flowId: input.flowId, organizationId: input.organizationId })
  if (!flow.publishedVersionId) throw new Error("automation_published_version_missing")

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("not_found")

  const metadata = enrollment.metadata ?? {}
  if (String(metadata.automation_flow_id ?? "") !== input.flowId) throw new Error("flow_mismatch")
  if (String(metadata.qa_marker ?? "").startsWith("growth-automation-enrollment") === false) {
    throw new Error("automation_enrollment_metadata_missing")
  }

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === enrollment.sequencePatternId)
  if (!pattern) throw new Error("pattern_not_found")

  const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
  return {
    enrollment,
    steps,
    pattern,
    flowId: input.flowId,
    versionId: String(metadata.automation_version_id ?? flow.publishedVersionId),
  }
}

async function ensureAutomationEnrollmentActive(
  admin: SupabaseClient,
  context: LoadedAutomationEnrollment,
): Promise<LoadedAutomationEnrollment["enrollment"]> {
  if (context.enrollment.status === "active") return context.enrollment
  if (context.enrollment.status === "cancelled" || context.enrollment.status === "completed") {
    throw new Error("invalid_status")
  }
  if (context.enrollment.status !== "draft") throw new Error("invalid_status")

  const { data: conflictingActive } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", context.enrollment.leadId)
    .eq("status", "active")
    .neq("id", context.enrollment.id)
    .limit(1)

  if (conflictingActive && conflictingActive.length > 0) {
    throw new Error("lead_active_enrollment_conflict")
  }

  const now = new Date().toISOString()
  const executionRunId = randomUUID()
  const updated = await updateGrowthSequenceEnrollment(admin, context.enrollment.id, {
    status: "active",
    startedAt: now,
    currentStepOrder: 0,
    metadata: mergeAutomationExecutionMetadata(context.enrollment.metadata ?? {}, {
      execution_run_id: executionRunId,
      last_status: "draft",
      activated_at: now,
    }),
  })
  await setLeadActiveSequenceEnrollment(admin, context.enrollment.leadId, context.enrollment.id)
  return updated
}

function resolvePatternStep(
  pattern: LoadedAutomationEnrollment["pattern"],
  enrollmentStep: LoadedAutomationEnrollment["steps"][number],
) {
  return pattern.steps.find((step) => step.id === enrollmentStep.sequencePatternStepId) ?? null
}

export async function createAutomationPendingActionJob(
  admin: SupabaseClient,
  input: {
    flowId: string
    enrollmentId: string
    enrollmentStepId: string
    stepOrder: number
    leadId: string
    channel: "email" | "sms" | "voice_drop"
    scheduledFor?: string | null
  },
): Promise<GrowthAutomationRuntimePendingJob> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("not_found")
  const metadata = enrollment.metadata ?? {}
  if (String(metadata.automation_flow_id ?? "") !== input.flowId) throw new Error("flow_mismatch")

  const existing = await findActiveSequenceExecutionJob(admin, {
    sequenceEnrollmentId: input.enrollmentId,
    sequenceStepId: input.enrollmentStepId,
  })
  if (existing) {
    return {
      jobId: existing.id,
      enrollmentId: input.enrollmentId,
      enrollmentStepId: input.enrollmentStepId,
      stepOrder: input.stepOrder,
      channel: existing.channel,
      status: "pending_approval",
      executionEnabled: false,
      requiresHumanApproval: true,
      createdAt: existing.createdAt,
    }
  }

  const now = new Date().toISOString()
  const job = await createSequenceExecutionJob(admin, {
    sequenceEnrollmentId: input.enrollmentId,
    sequenceStepId: input.enrollmentStepId,
    leadId: input.leadId,
    scheduledFor: input.scheduledFor ?? now,
    status: "pending_approval",
    channel: input.channel,
  })

  const pendingJob: GrowthAutomationRuntimePendingJob = {
    jobId: job.id,
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    stepOrder: input.stepOrder,
    channel: job.channel,
    status: "pending_approval",
    executionEnabled: false,
    requiresHumanApproval: true,
    createdAt: job.createdAt,
  }

  const executionMeta = readAutomationExecutionMetadata(metadata)
  const pendingJobs = Array.isArray(executionMeta.pending_jobs)
    ? (executionMeta.pending_jobs as GrowthAutomationRuntimePendingJob[])
    : []

  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    enrollmentStalled: true,
    metadata: mergeAutomationExecutionMetadata(metadata, {
      execution_run_id: String(executionMeta.execution_run_id ?? randomUUID()),
      last_status: "approval_required",
      pending_jobs: [...pendingJobs, pendingJob],
    }),
  })

  return pendingJob
}

export async function resolveAutomationWaits(
  admin: SupabaseClient,
  input: { enrollmentId: string },
): Promise<GrowthAutomationRuntimeExecutionRun["waitResults"]> {
  const steps = await listGrowthSequenceEnrollmentSteps(admin, input.enrollmentId)
  const waitingStep = steps.find((step) => step.status === "waiting")
  if (waitingStep) {
    return [
      {
        waitId: null,
        status: "waiting",
        detail: `Step ${waitingStep.stepOrder} is waiting for event or timeout resolution.`,
      },
    ]
  }

  return [{ waitId: null, status: "none", detail: "No active wait steps on enrollment." }]
}

export async function evaluateAutomationBranches(
  admin: SupabaseClient,
  input: { enrollmentId: string; enrollmentStepId: string },
): Promise<GrowthAutomationRuntimeExecutionRun["branchResults"]> {
  const step = (await listGrowthSequenceEnrollmentSteps(admin, input.enrollmentId)).find(
    (entry) => entry.id === input.enrollmentStepId,
  )
  if (!step) {
    return [{ branchDecisionId: null, selectedEdgeType: null, status: "none", detail: "Step not found." }]
  }

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) {
    return [{ branchDecisionId: null, selectedEdgeType: null, status: "blocked", detail: "Enrollment not found." }]
  }

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === enrollment.sequencePatternId)
  const patternStep = pattern?.steps.find((entry) => entry.id === step.sequencePatternStepId)
  if (!pattern || !patternStep) {
    return [{ branchDecisionId: null, selectedEdgeType: null, status: "none", detail: "Pattern step not found." }]
  }

  const now = new Date().toISOString()
  const conditions = await listConditionsForStep(admin, patternStep.id)
  const evaluations = []
  for (const condition of conditions) {
    const result = await evaluateSequenceConditionSpecReadOnly(admin, {
      enrollmentId: input.enrollmentId,
      enrollmentStepId: input.enrollmentStepId,
      conditionSpec: condition.spec,
      now,
    })
    evaluations.push({
      conditionId: condition.id,
      matched: result.matched,
    })
  }

  const edges = await listEdgesFromPatternStep(admin, pattern.id, patternStep.id)
  const resolved = resolveSequenceBranchEdges({
    fromPatternStepId: patternStep.id,
    edges,
    evaluations,
  })

  return [
    {
      branchDecisionId: resolved.selectedEdge?.id ?? null,
      selectedEdgeType: resolved.selectedEdge?.edgeType ?? null,
      status: resolved.selectedEdge ? "evaluated" : "blocked",
      detail: resolved.selectedEdge
        ? `Branch selected ${resolved.selectedEdge.edgeType}.`
        : "No branch edge matched current evaluations.",
    },
  ]
}

export async function completeAutomationEnrollment(
  admin: SupabaseClient,
  input: { enrollmentId: string; leadId: string },
): Promise<void> {
  const now = new Date().toISOString()
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")

  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    status: "completed",
    completedAt: now,
    enrollmentStalled: false,
    metadata: mergeAutomationExecutionMetadata(enrollment.metadata ?? {}, {
      last_status: "completed",
      completed_at: now,
    }),
  })
  await setLeadActiveSequenceEnrollment(admin, input.leadId, null)
}

export async function advanceAutomationEnrollment(
  admin: SupabaseClient,
  input: GrowthAutomationRuntimeAdvanceInput,
): Promise<GrowthAutomationRuntimeExecutionRun> {
  const warnings: GrowthAutomationValidationIssue[] = []
  const errors: GrowthAutomationValidationIssue[] = []
  const now = new Date().toISOString()

  let context = await loadAutomationEnrollmentContext(admin, input)
  const enrollment = await ensureAutomationEnrollmentActive(admin, context)
  context = { ...context, enrollment }

  const gate = await evaluateSequenceBranchAdvanceGate(admin, {
    sequenceEnrollmentId: enrollment.id,
  })
  if (gate.blocked && enrollment.status === "paused") {
    return buildAutomationRuntimeExecutionRun({
      executionRunId: randomUUID(),
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: null,
      status: "blocked",
      errors: [executionIssue("error", gate.code ?? "advance_blocked", gate.reason ?? "Advance blocked.")],
    })
  }

  const currentStep = resolveAutomationRuntimeCurrentStep({
    currentStepOrder: enrollment.currentStepOrder,
    steps: context.steps,
  })

  if (!currentStep) {
    if (enrollment.status === "completed") {
      return buildAutomationRuntimeExecutionRun({
        executionRunId: randomUUID(),
        flowId: input.flowId,
        versionId: context.versionId,
        compiledPatternId: enrollment.sequencePatternId,
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        currentStepId: null,
        status: "completed",
      })
    }

    await completeAutomationEnrollment(admin, {
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
    })

    return buildAutomationRuntimeExecutionRun({
      executionRunId: randomUUID(),
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: null,
      status: "completed",
      stepResults: [
        {
          enrollmentStepId: "",
          stepOrder: enrollment.currentStepOrder,
          stepKind: "exit",
          status: "completed",
          detail: "No remaining steps — enrollment completed.",
        },
      ],
    })
  }

  const patternStep = resolvePatternStep(context.pattern, currentStep)
  let stepKind = classifyAutomationRuntimeStep({
    generationType: patternStep?.generationType ?? currentStep.generationType,
    channel: currentStep.channel,
    stepOrder: currentStep.stepOrder,
  })
  if (patternStep?.generationType === "approval") stepKind = "approval"
  if (patternStep?.generationType === "trigger") stepKind = "trigger"
  if (patternStep?.generationType === "exit") stepKind = "exit"

  const executionMeta = readAutomationExecutionMetadata(enrollment.metadata ?? {})
  const executionRunId = String(executionMeta.execution_run_id ?? randomUUID())

  if (stepKind === "approval") {
    const approvalGate = await createAutomationApprovalGate(admin, {
      flowId: input.flowId,
      enrollmentId: enrollment.id,
      enrollmentStepId: currentStep.id,
      stepOrder: currentStep.stepOrder,
      entryReason: "Automation runtime blocked at approval gate.",
    })

    return buildAutomationRuntimeExecutionRun({
      executionRunId,
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: currentStep.id,
      status: "approval_required",
      approvalGates: [approvalGate],
      stepResults: [
        {
          enrollmentStepId: currentStep.id,
          stepOrder: currentStep.stepOrder,
          stepKind,
          status: "approval_required",
          detail: "Approval gate created — advancement blocked pending human review.",
        },
      ],
    })
  }

  if (stepKind === "action") {
    const channel =
      currentStep.channel === "sms" || currentStep.channel === "voice_drop"
        ? currentStep.channel
        : "email"
    const pendingJob = await createAutomationPendingActionJob(admin, {
      flowId: input.flowId,
      enrollmentId: enrollment.id,
      enrollmentStepId: currentStep.id,
      stepOrder: currentStep.stepOrder,
      leadId: enrollment.leadId,
      channel,
      scheduledFor: currentStep.scheduledFor,
    })

    return buildAutomationRuntimeExecutionRun({
      executionRunId,
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: currentStep.id,
      status: "approval_required",
      pendingJobs: [pendingJob],
      stepResults: [
        {
          enrollmentStepId: currentStep.id,
          stepOrder: currentStep.stepOrder,
          stepKind,
          status: "approval_required",
          detail: "Pending action job created — no send executed.",
        },
      ],
    })
  }

  if (stepKind === "wait") {
    const waitResults = await resolveAutomationWaits(admin, { enrollmentId: enrollment.id })
    const waiting = waitResults.some((entry) => entry.status === "waiting")
    return buildAutomationRuntimeExecutionRun({
      executionRunId,
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: currentStep.id,
      status: waiting ? "waiting" : "blocked",
      waitResults,
      stepResults: [
        {
          enrollmentStepId: currentStep.id,
          stepOrder: currentStep.stepOrder,
          stepKind,
          status: waiting ? "waiting" : "blocked",
          detail: waiting ? "Wait registry active." : "Wait could not advance.",
        },
      ],
    })
  }

  if (stepKind === "condition") {
    const branchResults = await evaluateAutomationBranches(admin, {
      enrollmentId: enrollment.id,
      enrollmentStepId: currentStep.id,
    })

    await advanceGrowthSequenceEnrollmentAfterStep(admin, {
      enrollmentStepId: currentStep.id,
    })

    return buildAutomationRuntimeExecutionRun({
      executionRunId,
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: currentStep.id,
      status: "advanced",
      branchResults,
      stepResults: [
        {
          enrollmentStepId: currentStep.id,
          stepOrder: currentStep.stepOrder,
          stepKind,
          status: "advanced",
          detail: "Branch evaluated via SR-3 resolver.",
        },
      ],
    })
  }

  if (stepKind === "exit") {
    await advanceGrowthSequenceEnrollmentAfterStep(admin, { enrollmentStepId: currentStep.id })
    await completeAutomationEnrollment(admin, {
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
    })

    return buildAutomationRuntimeExecutionRun({
      executionRunId,
      flowId: input.flowId,
      versionId: context.versionId,
      compiledPatternId: enrollment.sequencePatternId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      currentStepId: currentStep.id,
      status: "completed",
      stepResults: [
        {
          enrollmentStepId: currentStep.id,
          stepOrder: currentStep.stepOrder,
          stepKind,
          status: "completed",
          detail: "Exit step reached — enrollment completed.",
        },
      ],
    })
  }

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: currentStep.id,
  })

  await updateGrowthSequenceEnrollment(admin, enrollment.id, {
    metadata: mergeAutomationExecutionMetadata(enrollment.metadata ?? {}, {
      execution_run_id: executionRunId,
      last_status: "advanced",
      entry_recorded_at: stepKind === "trigger" ? now : executionMeta.entry_recorded_at ?? null,
    }),
  })

  const refreshed = await fetchGrowthSequenceEnrollmentById(admin, enrollment.id)
  const nextStep = resolveAutomationRuntimeCurrentStep({
    currentStepOrder: refreshed?.currentStepOrder ?? enrollment.currentStepOrder,
    steps: await listGrowthSequenceEnrollmentSteps(admin, enrollment.id),
  })

  return buildAutomationRuntimeExecutionRun({
    executionRunId,
    flowId: input.flowId,
    versionId: context.versionId,
    compiledPatternId: enrollment.sequencePatternId,
    enrollmentId: enrollment.id,
    leadId: enrollment.leadId,
    currentStepId: nextStep?.id ?? currentStep.id,
    status: "advanced",
    stepResults: [
      {
        enrollmentStepId: currentStep.id,
        stepOrder: currentStep.stepOrder,
        stepKind,
        status: "advanced",
        detail:
          stepKind === "trigger"
            ? "Trigger entry recorded — advanced to next runtime step."
            : "Step advanced via SR-3 orchestrator (no materialize).",
      },
    ],
    warnings,
    errors,
  })
}

export async function advanceAutomationEnrollmentUntilBlocked(
  admin: SupabaseClient,
  input: GrowthAutomationRuntimeAdvanceUntilBlockedInput,
): Promise<GrowthAutomationRuntimeExecutionRun> {
  const maxSteps = input.maxSteps ?? 12
  let last = await advanceAutomationEnrollment(admin, input)

  for (let index = 1; index < maxSteps; index += 1) {
    if (last.status !== "advanced") break
    last = await advanceAutomationEnrollment(admin, input)
  }

  return last
}

export async function cancelAutomationRuntimeExecution(
  admin: SupabaseClient,
  input: GrowthAutomationRuntimeCancelExecutionInput,
): Promise<GrowthAutomationRuntimeExecutionRun> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")

  const metadata = enrollment.metadata ?? {}
  if (String(metadata.automation_flow_id ?? "") !== input.flowId) throw new Error("flow_mismatch")

  const now = new Date().toISOString()
  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    status: "cancelled",
    cancelledAt: now,
    cancelledReason: input.reason ?? `${GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER}: cancelled`,
    enrollmentStalled: false,
    metadata: mergeAutomationExecutionMetadata(metadata, {
      last_status: "cancelled",
      cancelled_at: now,
    }),
  })
  await setLeadActiveSequenceEnrollment(admin, input.leadId, null)

  return buildAutomationRuntimeExecutionRun({
    executionRunId: String(readAutomationExecutionMetadata(metadata).execution_run_id ?? randomUUID()),
    flowId: input.flowId,
    versionId: String(metadata.automation_version_id ?? ""),
    compiledPatternId: enrollment.sequencePatternId,
    enrollmentId: enrollment.id,
    leadId: enrollment.leadId,
    currentStepId: null,
    status: "cancelled",
  })
}

export async function getAutomationRuntimeExecutionStatus(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; enrollmentId: string },
): Promise<GrowthAutomationRuntimeExecutionRun> {
  const context = await loadAutomationEnrollmentContext(admin, input)
  const executionMeta = readAutomationExecutionMetadata(context.enrollment.metadata ?? {})
  const currentStep = resolveAutomationRuntimeCurrentStep({
    currentStepOrder: context.enrollment.currentStepOrder,
    steps: context.steps,
  })

  const approvalGates = Array.isArray(executionMeta.approval_gates)
    ? (executionMeta.approval_gates as GrowthAutomationRuntimeExecutionRun["approvalGates"])
    : []
  const pendingJobs = Array.isArray(executionMeta.pending_jobs)
    ? (executionMeta.pending_jobs as GrowthAutomationRuntimeExecutionRun["pendingJobs"])
    : []

  const lastStatus = String(executionMeta.last_status ?? "draft")
  const status =
    context.enrollment.status === "cancelled"
      ? "cancelled"
      : context.enrollment.status === "completed"
        ? "completed"
        : (lastStatus as GrowthAutomationRuntimeExecutionRun["status"])

  return buildAutomationRuntimeExecutionRun({
    executionRunId: String(executionMeta.execution_run_id ?? randomUUID()),
    flowId: input.flowId,
    versionId: context.versionId,
    compiledPatternId: context.enrollment.sequencePatternId,
    enrollmentId: context.enrollment.id,
    leadId: context.enrollment.leadId,
    currentStepId: currentStep?.id ?? null,
    status,
    approvalGates,
    pendingJobs,
  })
}

/** GE-AIOS-GROWTH-5E — Autonomous Execution Agent Pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  applyExecutionPilotControlTransition,
  buildAutonomousExecutionPilotPlanContext,
  buildAutonomousExecutionPilotReadModel,
  buildAutonomousExecutionRunRecord,
  enforceExecutionAgentBudget,
  evaluateExecutionGateReadiness,
  evaluateExecutionWakeCondition,
  isExecutionAgentSchedulerActive,
  isRevenueOperatorExecutionBlocked,
  selectExecutionWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-engine"
import {
  appendAutonomousExecutionRun,
  getAutonomousExecutionPilotOrgState,
  setAutonomousExecutionPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-store"
import type {
  GrowthAutonomousExecutionPilotControlState,
  GrowthAutonomousExecutionPilotPlanContext,
  GrowthAutonomousExecutionPilotReadModel,
  GrowthAutonomousExecutionWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import {
  GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import { resolveApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import { buildGrowthLeadResearchExecutionPlanId } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { getLatestDryRunReportForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import {
  buildExecutionRuntimePilotPlanQueues,
  validateGrowthLeadResearchExecutionPilotEnqueue,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service"
import {
  buildExecutionRuntimeValidation,
  createGrowthLeadResearchExecutionRuntimeStore,
  enqueueGrowthLeadResearchExecution,
  runGrowthLeadResearchExecutionLifecycle,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"
import { buildGrowthLeadResearchExecutionRuntimeReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import {
  deriveExecutionPilotControlFromPolicy,
  enrichAutonomousExecutionPilotWithAutonomyPolicy,
  evaluateExecutionPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"

export {
  applyExecutionPilotControlTransition,
  buildAutonomousExecutionPilotPlanContext,
  buildAutonomousExecutionPilotReadModel,
  buildAutonomousExecutionRunRecord,
  buildOperationsExecutionAgentStatus,
  enforceExecutionAgentBudget,
  evaluateExecutionGateReadiness,
  evaluateExecutionWakeCondition,
  isExecutionAgentSchedulerActive,
  isOutboundWorkflowBlocked,
  selectExecutionWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-engine"

function nowIso(): string {
  return new Date().toISOString()
}

function resolvePolicyDerivedRuntimeFlags(policy: GrowthAiOsAutonomyPolicyReadModel): {
  runtimeEnabled: boolean
  pilotEnabled: boolean
} {
  return {
    runtimeEnabled: policy.runtimeEnabled,
    pilotEnabled: policy.runtimePilotEnabled && policy.executionAutonomyEnabled,
  }
}

async function publishExecutionAgentWakeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    planId: string
    wakeCondition: GrowthAutonomousExecutionWakeCondition
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    category: "agent",
    producer: "growth_autonomous_execution_pilot",
    source: "growth_autonomous_execution_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.planId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
      scheduler_mode: "controlled_agent_wake",
      wake_condition: input.wakeCondition,
      plan_id: input.planId,
      pilot_phase: "GE-AIOS-GROWTH-5E",
      workflow_type: "research_company",
      read_only_outbound: true,
      provider_calls: false,
      occurred_at: input.generatedAt,
    },
  })
}

async function publishExecutionEnqueuedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    planId: string
    executionId: string
    runtimeState: string
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT,
    category: "agent",
    producer: "growth_autonomous_execution_pilot",
    source: "growth_autonomous_execution_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.planId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
      plan_id: input.planId,
      execution_id: input.executionId,
      runtime_state: input.runtimeState,
      workflow_type: "research_company",
      occurred_at: input.generatedAt,
    },
  })
}

async function executeAutonomousExecutionEnqueue(
  admin: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    leadId: string
    companyName: string | null
    wakeCondition: GrowthAutonomousExecutionWakeCondition
    generatedAt: string
    policyDerivedFlags: { runtimeEnabled: boolean; pilotEnabled: boolean }
  },
) {
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot?.executionPlan) {
    throw new Error("Missing execution plan for autonomous enqueue.")
  }

  const executionPlan = snapshot.executionPlan
  const confidence =
    snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null
  const approvalState = "approved_for_future_execution" as const

  const pilotValidation = await validateGrowthLeadResearchExecutionPilotEnqueue(admin, {
    organizationId: input.organizationId,
    planId: input.planId,
    leadId: input.leadId,
    executionPlan,
    approvalState,
    confidence,
    policyDerivedFlags: input.policyDerivedFlags,
  })

  if (!pilotValidation.allowed) {
    throw new Error(pilotValidation.blockReason ?? "Autonomous execution enqueue blocked.")
  }

  await publishExecutionAgentWakeEvent(admin, input)

  const store = createGrowthLeadResearchExecutionRuntimeStore(admin, input.organizationId)
  const validation = await buildExecutionRuntimeValidation(admin, {
    organizationId: input.organizationId,
    executionPlan,
    approvalState,
    confidence,
    runtimeEnabled: input.policyDerivedFlags.runtimeEnabled && input.policyDerivedFlags.pilotEnabled,
  })

  const queued = await enqueueGrowthLeadResearchExecution(store, {
    organizationId: input.organizationId,
    planId: input.planId,
    leadId: input.leadId,
    companyName: input.companyName,
    missionId: snapshot.missionId,
    executionPlan,
    approvalState,
    confidence,
    operatorUserId: null,
    runtimeEnabled: input.policyDerivedFlags.runtimeEnabled && input.policyDerivedFlags.pilotEnabled,
  })

  const result = await runGrowthLeadResearchExecutionLifecycle(store, {
    executionId: queued.executionId,
    validation,
  })

  await publishExecutionEnqueuedEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    planId: input.planId,
    executionId: result.record.executionId,
    runtimeState: result.record.state,
    generatedAt: input.generatedAt,
  })

  const revenueOperatorHandoff =
    result.record.state === "completed"
      ? "report_outcome_to_revenue_operator"
      : result.record.state === "failed"
        ? "human_review_required"
        : "monitor_runtime_lifecycle"

  return {
    executionId: result.record.executionId,
    runtimeState: result.record.state,
    workflowType: executionPlan.workflowType,
    dryRunStatus: pilotValidation.dryRunPassed ? ("dry_run_passed" as const) : null,
    revenueOperatorHandoff,
  }
}

export async function applyGrowthAutonomousExecutionPilotControl(input: {
  organizationId: string
  action: "pause" | "resume" | "disable"
  generatedAt?: string
}): Promise<GrowthAutonomousExecutionPilotControlState> {
  const generatedAt = input.generatedAt ?? nowIso()
  const state = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt)
  const next = applyExecutionPilotControlTransition({ current: state.controlState, action: input.action })
  setAutonomousExecutionPilotControlState({
    organizationId: input.organizationId,
    controlState: next,
    now: generatedAt,
  })
  return next
}

export async function runAutonomousExecutionPilotCycle(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; maxRuns?: number },
): Promise<GrowthAutonomousExecutionPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const { policy } = evaluationContext
  const policyGate = evaluateExecutionPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = deriveExecutionPilotControlFromPolicy(policy, orgState.controlState)
  const policyDerivedFlags = resolvePolicyDerivedRuntimeFlags(policy)

  let eligiblePlans = 0
  let queuedExecutions = 0
  let activeExecutions = 0

  const runtimeReadModel = await buildGrowthLeadResearchExecutionRuntimeReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  activeExecutions = runtimeReadModel.systemSummary.activeCount
  queuedExecutions = runtimeReadModel.activeExecutions.filter((row) => row.state === "queued").length

  if (policyGate.allowed && isExecutionAgentSchedulerActive(effectiveControlState)) {
    const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    })
    const { pilotEligiblePlans } = await buildExecutionRuntimePilotPlanQueues(admin, {
      organizationId: input.organizationId,
      policyDerivedFlags,
    })
    eligiblePlans = pilotEligiblePlans.length

    const candidates = selectExecutionWakeCandidates({
      pilotEligiblePlans,
      rankedMissions: missionPriority.rankedMissions,
    }).slice(0, input.maxRuns ?? 2)

    for (const candidate of candidates) {
      const ranked = missionPriority.rankedMissions.find((row) => row.leadId === candidate.leadId)
      if (
        ranked &&
        isRevenueOperatorExecutionBlocked({
          allocationStatus: ranked.allocationStatus,
          blockers: ranked.blockers,
        })
      ) {
        appendAutonomousExecutionRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousExecutionRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            planId: candidate.planId,
            wakeCondition: "execution_plan_ready",
            generatedAt,
            outcome: "skipped",
            skipReason: "Revenue Operator blocked execution handoff.",
            dryRunStatus: candidate.latestDryRunStatus,
          }),
        })
        continue
      }

      const gateValidation = await buildExecutionRuntimeValidation(admin, {
        organizationId: input.organizationId,
        executionPlan: candidate.executionPlan,
        approvalState: candidate.approvalState,
        confidence: candidate.confidence,
        runtimeEnabled: policyDerivedFlags.runtimeEnabled && policyDerivedFlags.pilotEnabled,
      })

      const gateReadiness = evaluateExecutionGateReadiness({
        workflowType: candidate.workflowType,
        approvalState: candidate.approvalState,
        readinessState:
          gateValidation.gateSnapshot.readinessState === "not_applicable"
            ? "not_ready"
            : gateValidation.gateSnapshot.readinessState,
        handoffState:
          gateValidation.gateSnapshot.handoffState === "not_evaluated"
            ? "handoff_blocked"
            : gateValidation.gateSnapshot.handoffState,
        preflightStatus:
          gateValidation.gateSnapshot.preflightStatus === "not_evaluated"
            ? "preflight_not_allowed"
            : gateValidation.gateSnapshot.preflightStatus,
        dryRunStatus: candidate.latestDryRunStatus,
        enqueueAllowed: candidate.enqueueAllowed && gateValidation.allowed,
        blockReason: candidate.blockReason ?? gateValidation.blockReason,
      })

      const wakeCondition = evaluateExecutionWakeCondition({
        planId: candidate.planId,
        leadId: candidate.leadId,
        runs: getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        gateReadiness,
      })

      if (!wakeCondition) continue

      const budget = enforceExecutionAgentBudget({
        runs: getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        planId: candidate.planId,
      })
      if (!budget.allowed) {
        appendAutonomousExecutionRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousExecutionRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            planId: candidate.planId,
            wakeCondition,
            generatedAt,
            outcome: "skipped",
            skipReason: budget.skipReason,
            dryRunStatus: candidate.latestDryRunStatus,
          }),
        })
        continue
      }

      try {
        const decision = await executeAutonomousExecutionEnqueue(admin, {
          organizationId: input.organizationId,
          planId: candidate.planId,
          leadId: candidate.leadId,
          companyName: candidate.companyName,
          wakeCondition,
          generatedAt,
          policyDerivedFlags,
        })
        appendAutonomousExecutionRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousExecutionRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            planId: candidate.planId,
            wakeCondition,
            generatedAt,
            outcome: decision.runtimeState === "failed" ? "failed" : "completed",
            executionId: decision.executionId,
            workflowType: decision.workflowType,
            runtimeState: decision.runtimeState,
            dryRunStatus: decision.dryRunStatus,
            revenueOperatorHandoff: decision.revenueOperatorHandoff,
          }),
        })
      } catch (error) {
        appendAutonomousExecutionRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousExecutionRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            planId: candidate.planId,
            wakeCondition,
            generatedAt,
            outcome: "failed",
            blockReason: error instanceof Error ? error.message : String(error),
            dryRunStatus: candidate.latestDryRunStatus,
          }),
        })
      }
    }
  }

  const finalState = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt)
  const refreshedRuntime = await buildGrowthLeadResearchExecutionRuntimeReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  return enrichAutonomousExecutionPilotWithAutonomyPolicy(
    buildAutonomousExecutionPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      eligiblePlans,
      queuedExecutions: refreshedRuntime.activeExecutions.filter((row) => row.state === "queued").length,
      activeExecutions: refreshedRuntime.systemSummary.activeCount,
      activeRuns: 0,
    }),
    policy,
  )
}

export async function buildGrowthAutonomousExecutionPilotReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; runCycle?: boolean },
): Promise<GrowthAutonomousExecutionPilotReadModel> {
  if (input.runCycle) {
    return runAutonomousExecutionPilotCycle(admin, input)
  }

  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const runtimeReadModel = await buildGrowthLeadResearchExecutionRuntimeReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const { pilotEligiblePlans } = await buildExecutionRuntimePilotPlanQueues(admin, {
    organizationId: input.organizationId,
    policyDerivedFlags: resolvePolicyDerivedRuntimeFlags(evaluationContext.policy),
  })

  return enrichAutonomousExecutionPilotWithAutonomyPolicy(
    buildAutonomousExecutionPilotReadModel({
      controlState: orgState.controlState,
      runs: orgState.runs,
      generatedAt,
      eligiblePlans: pilotEligiblePlans.length,
      queuedExecutions: runtimeReadModel.activeExecutions.filter((row) => row.state === "queued").length,
      activeExecutions: runtimeReadModel.systemSummary.activeCount,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

export async function buildGrowthAutonomousExecutionPilotPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousExecutionPilotPlanContext> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const effectiveControlState = deriveExecutionPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot?.executionPlan) {
    return buildAutonomousExecutionPilotPlanContext({
      planId: input.leadId,
      leadId: input.leadId,
      executionPlan: null,
      approvalState: null,
      readinessState: null,
      handoffState: null,
      preflightStatus: null,
      dryRunStatus: null,
      enqueueAllowed: false,
      blockReason: "Execution plan missing.",
      controlState: effectiveControlState,
      runs: orgState.runs,
      runtimeState: null,
      generatedAt,
    })
  }

  const plan = snapshot.executionPlan
  const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: input.leadId, plan })
  const confidence =
    snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null
  const approvalState = "approved_for_future_execution" as const
  const policyDerivedFlags = resolvePolicyDerivedRuntimeFlags(evaluationContext.policy)

  const pilotValidation = await validateGrowthLeadResearchExecutionPilotEnqueue(admin, {
    organizationId: input.organizationId,
    planId,
    leadId: input.leadId,
    executionPlan: plan,
    approvalState,
    confidence,
    policyDerivedFlags,
  })

  const gateValidation = await buildExecutionRuntimeValidation(admin, {
    organizationId: input.organizationId,
    executionPlan: plan,
    approvalState,
    confidence,
    runtimeEnabled: policyDerivedFlags.runtimeEnabled && policyDerivedFlags.pilotEnabled,
  })

  const readinessState = resolveApprovedPlanReadinessState({
    plan,
    approvalStatus: approvalState,
    confidence,
  })

  const runtimeReadModel = await buildGrowthLeadResearchExecutionRuntimeReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const activeExecution =
    runtimeReadModel.activeExecutions.find((row) => row.planId === planId) ?? null

  return buildAutonomousExecutionPilotPlanContext({
    planId,
    leadId: input.leadId,
    executionPlan: plan,
    approvalState,
    readinessState,
    handoffState:
      gateValidation.gateSnapshot.handoffState === "not_evaluated"
        ? "handoff_blocked"
        : gateValidation.gateSnapshot.handoffState,
    preflightStatus:
      gateValidation.gateSnapshot.preflightStatus === "not_evaluated"
        ? "preflight_not_allowed"
        : gateValidation.gateSnapshot.preflightStatus,
    dryRunStatus: getLatestDryRunReportForPlan(planId)?.finalStatus ?? null,
    enqueueAllowed: pilotValidation.allowed,
    blockReason: pilotValidation.blockReason ?? gateValidation.blockReason,
    controlState: effectiveControlState,
    runs: orgState.runs,
    runtimeState: activeExecution?.state ?? null,
    generatedAt,
  })
}

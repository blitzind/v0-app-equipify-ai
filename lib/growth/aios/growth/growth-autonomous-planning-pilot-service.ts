/** GE-AIOS-GROWTH-5D — Autonomous Planning Agent Pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
  publishGrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import {
  applyPlanningPilotControlTransition,
  buildAutonomousPlanningPilotPlanContext,
  buildAutonomousPlanningPilotReadModel,
  buildAutonomousPlanningRunRecord,
  enforcePlanningAgentBudget,
  evaluateAutonomousPlanningDecision,
  evaluatePlanningWakeCondition,
  isPlanningAgentSchedulerActive,
  isRevenueOperatorPlanningBlocked,
  resolvePlanningIntelligenceFromSnapshot,
  selectPlanningWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-engine"
import {
  appendAutonomousPlanningRun,
  getAutonomousPlanningPilotOrgState,
  setAutonomousPlanningPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-store"
import type {
  GrowthAutonomousPlanningPilotControlState,
  GrowthAutonomousPlanningPilotPlanContext,
  GrowthAutonomousPlanningPilotReadModel,
  GrowthAutonomousPlanningWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import {
  GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  derivePlanningPilotControlFromPolicy,
  enrichAutonomousPlanningPilotWithAutonomyPolicy,
  evaluatePlanningPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"

export {
  applyPlanningPilotControlTransition,
  buildAutonomousPlanningPilotPlanContext,
  buildAutonomousPlanningPilotReadModel,
  buildAutonomousPlanningRunRecord,
  enforcePlanningAgentBudget,
  evaluateAutonomousPlanningDecision,
  evaluatePlanningWakeCondition,
  isPlanningAgentSchedulerActive,
  selectPlanningWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-engine"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishPlanningAgentWakeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeCondition: GrowthAutonomousPlanningWakeCondition
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    category: "agent",
    producer: "growth_autonomous_planning_pilot",
    source: "growth_autonomous_planning_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
      scheduler_mode: "controlled_agent_wake",
      wake_condition: input.wakeCondition,
      pilot_phase: "GE-AIOS-GROWTH-5D",
      read_only_outbound: true,
      provider_calls: false,
      occurred_at: input.generatedAt,
    },
  })
}

async function publishExecutionPlanGeneratedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt: string
    decision: NonNullable<ReturnType<typeof evaluateAutonomousPlanningDecision>>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT,
    category: "agent",
    producer: "growth_autonomous_planning_pilot",
    source: "growth_autonomous_planning_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
      plan_id: input.decision.planId,
      workflow_type: input.decision.executionPlan.workflowType,
      execution_readiness: input.decision.executionPlan.executionReadiness,
      confidence: input.decision.confidence,
      expected_outcome: input.decision.expectedOutcome,
      revenue_operator_handoff: input.decision.revenueOperatorHandoff,
      occurred_at: input.generatedAt,
    },
  })
}

async function executeAutonomousPlanningEvaluation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    wakeCondition: GrowthAutonomousPlanningWakeCondition
    generatedAt: string
  },
) {
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot) {
    throw new Error("Missing workflow snapshot for planning.")
  }

  const decision = evaluateAutonomousPlanningDecision({
    snapshot,
    companyName: input.companyName,
  })

  if (!decision) {
    throw new Error("Planning intelligence incomplete for lead.")
  }

  const intelligence = resolvePlanningIntelligenceFromSnapshot({
    snapshot,
    companyName: input.companyName,
  })

  if (!intelligence) {
    throw new Error("Unable to resolve planning intelligence.")
  }

  await publishPlanningAgentWakeEvent(admin, input)

  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: snapshot.missionId,
    workOrderId: null,
    researchRunId: snapshot.researchRunId,
    workflowStatus: "assessed",
    qualification: intelligence.qualification,
    opportunityAssessment: intelligence.opportunityAssessment,
    nextBestAction: intelligence.nextBestAction,
    evidenceSummary: intelligence.evidenceSummary,
    executionPlan: decision.executionPlan,
    detail: `GE-AIOS-GROWTH-5D autonomous planning (${input.wakeCondition}).`,
  })

  await publishExecutionPlanGeneratedEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    decision,
  })

  return decision
}

export async function applyGrowthAutonomousPlanningPilotControl(input: {
  organizationId: string
  action: "pause" | "resume" | "disable"
  generatedAt?: string
}): Promise<GrowthAutonomousPlanningPilotControlState> {
  const generatedAt = input.generatedAt ?? nowIso()
  const state = getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt)
  const next = applyPlanningPilotControlTransition({ current: state.controlState, action: input.action })
  setAutonomousPlanningPilotControlState({
    organizationId: input.organizationId,
    controlState: next,
    now: generatedAt,
  })
  return next
}

export async function runAutonomousPlanningPilotCycle(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; maxRuns?: number },
): Promise<GrowthAutonomousPlanningPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const { policy } = evaluationContext
  const policyGate = evaluatePlanningPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = derivePlanningPilotControlFromPolicy(policy, orgState.controlState)

  let eligibleLeads = 0

  if (policyGate.allowed && isPlanningAgentSchedulerActive(effectiveControlState)) {
    const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    })
    const candidates = selectPlanningWakeCandidates({
      rankedMissions: missionPriority.rankedMissions,
    }).slice(0, input.maxRuns ?? 3)

    for (const candidate of candidates) {
      if (isRevenueOperatorPlanningBlocked(candidate)) {
        appendAutonomousPlanningRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousPlanningRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition: "qualification_completed",
            generatedAt,
            outcome: "skipped",
            skipReason: "Revenue Operator blocked planning handoff.",
          }),
        })
        continue
      }

      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: candidate.leadId,
      })
      const wakeCondition = evaluatePlanningWakeCondition({
        leadId: candidate.leadId,
        snapshot,
        runs: getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        companyName: candidate.companyName,
      })

      if (wakeCondition) eligibleLeads += 1
      if (!wakeCondition) continue

      const budget = enforcePlanningAgentBudget({
        runs: getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        leadId: candidate.leadId,
      })
      if (!budget.allowed) {
        appendAutonomousPlanningRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousPlanningRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "skipped",
            skipReason: budget.skipReason,
          }),
        })
        continue
      }

      try {
        const decision = await executeAutonomousPlanningEvaluation(admin, {
          organizationId: input.organizationId,
          leadId: candidate.leadId,
          companyName: candidate.companyName,
          wakeCondition,
          generatedAt,
        })
        appendAutonomousPlanningRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousPlanningRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "completed",
            decision,
          }),
        })
      } catch {
        appendAutonomousPlanningRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousPlanningRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "failed",
          }),
        })
      }
    }
  }

  const finalState = getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt)
  return enrichAutonomousPlanningPilotWithAutonomyPolicy(
    buildAutonomousPlanningPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      eligibleLeads,
      activeRuns: 0,
    }),
    policy,
  )
}

export async function buildGrowthAutonomousPlanningPilotReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; runCycle?: boolean },
): Promise<GrowthAutonomousPlanningPilotReadModel> {
  if (input.runCycle) {
    return runAutonomousPlanningPilotCycle(admin, input)
  }

  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  return enrichAutonomousPlanningPilotWithAutonomyPolicy(
    buildAutonomousPlanningPilotReadModel({
      controlState: orgState.controlState,
      runs: orgState.runs,
      generatedAt,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

export async function buildGrowthAutonomousPlanningPilotPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousPlanningPilotPlanContext> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const effectiveControlState = derivePlanningPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  return buildAutonomousPlanningPilotPlanContext({
    leadId: input.leadId,
    snapshot,
    controlState: effectiveControlState,
    runs: orgState.runs,
    generatedAt,
  })
}

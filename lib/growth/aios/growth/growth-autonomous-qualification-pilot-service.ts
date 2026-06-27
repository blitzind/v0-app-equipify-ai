/** GE-AIOS-GROWTH-5C — Autonomous Qualification Agent Pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
  publishGrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import {
  applyQualificationPilotControlTransition,
  buildAutonomousQualificationPilotPlanContext,
  buildAutonomousQualificationPilotReadModel,
  buildAutonomousQualificationRunRecord,
  buildResearchResultFromWorkflowSnapshot,
  enforceQualificationAgentBudget,
  evaluateAutonomousQualificationDecision,
  evaluateQualificationWakeCondition,
  isQualificationAgentSchedulerActive,
  isRevenueOperatorHandoffBlocked,
  selectQualificationWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine"
import {
  appendAutonomousQualificationRun,
  getAutonomousQualificationPilotOrgState,
  setAutonomousQualificationPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-store"
import type {
  GrowthAutonomousQualificationPilotControlState,
  GrowthAutonomousQualificationPilotPlanContext,
  GrowthAutonomousQualificationPilotReadModel,
  GrowthAutonomousQualificationWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import {
  GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  deriveQualificationPilotControlFromPolicy,
  enrichAutonomousQualificationPilotWithAutonomyPolicy,
  evaluateQualificationPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"

export {
  applyQualificationPilotControlTransition,
  buildAutonomousQualificationPilotPlanContext,
  buildAutonomousQualificationPilotReadModel,
  buildAutonomousQualificationRunRecord,
  buildResearchResultFromWorkflowSnapshot,
  enforceQualificationAgentBudget,
  evaluateAutonomousQualificationDecision,
  evaluateQualificationWakeCondition,
  isQualificationAgentSchedulerActive,
  selectQualificationWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishQualificationAgentWakeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeCondition: GrowthAutonomousQualificationWakeCondition
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    category: "agent",
    producer: "growth_autonomous_qualification_pilot",
    source: "growth_autonomous_qualification_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
      scheduler_mode: "controlled_agent_wake",
      wake_condition: input.wakeCondition,
      pilot_phase: "GE-AIOS-GROWTH-5C",
      read_only_outbound: true,
      provider_calls: false,
      occurred_at: input.generatedAt,
    },
  })
}

async function publishQualificationCompletedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt: string
    decision: ReturnType<typeof evaluateAutonomousQualificationDecision>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT,
    category: "agent",
    producer: "growth_autonomous_qualification_pilot",
    source: "growth_autonomous_qualification_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
      qualification_status: input.decision.terminalStatus,
      icp_fit_score: input.decision.qualification.fitScore,
      buying_signal_score: input.decision.buyingSignalScore,
      confidence: input.decision.qualification.confidence,
      reasoning: input.decision.reasoning,
      missing_evidence: input.decision.qualification.missingEvidence,
      recommended_next_step: input.decision.recommendedNextStep,
      revenue_operator_handoff: input.decision.revenueOperatorHandoff,
      occurred_at: input.generatedAt,
    },
  })
}

async function executeAutonomousQualificationEvaluation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    wakeCondition: GrowthAutonomousQualificationWakeCondition
    generatedAt: string
  },
) {
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot) {
    throw new Error("Missing research snapshot for qualification.")
  }

  const decision = evaluateAutonomousQualificationDecision({
    snapshot,
    companyName: input.companyName,
  })

  await publishQualificationAgentWakeEvent(admin, input)

  const researchResult = buildResearchResultFromWorkflowSnapshot({
    snapshot,
    companyName: input.companyName,
  })

  let opportunityAssessment = snapshot.opportunityAssessment
  let nextBestAction = snapshot.nextBestAction
  let evidenceSummary = snapshot.evidenceSummary
  let executionPlan = snapshot.executionPlan

  if (decision.terminalStatus === "qualified") {
    const intelligence = assessGrowthLeadResearchOpportunity({
      result: researchResult,
      qualification: decision.qualification,
    })
    opportunityAssessment = intelligence.opportunityAssessment
    nextBestAction = intelligence.nextBestAction
    evidenceSummary = intelligence.evidenceSummary
    executionPlan = intelligence.executionPlan
  }

  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: snapshot.missionId,
    workOrderId: null,
    researchRunId: snapshot.researchRunId,
    workflowStatus: decision.terminalStatus === "qualified" ? "assessed" : decision.terminalStatus,
    qualification: decision.qualification,
    opportunityAssessment,
    nextBestAction,
    evidenceSummary,
    executionPlan,
    detail: `GE-AIOS-GROWTH-5C autonomous qualification (${input.wakeCondition}).`,
  })

  await publishQualificationCompletedEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    decision,
  })

  return decision
}

export async function applyGrowthAutonomousQualificationPilotControl(input: {
  organizationId: string
  action: "pause" | "resume" | "disable"
  generatedAt?: string
}): Promise<GrowthAutonomousQualificationPilotControlState> {
  const generatedAt = input.generatedAt ?? nowIso()
  const state = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  const next = applyQualificationPilotControlTransition({ current: state.controlState, action: input.action })
  setAutonomousQualificationPilotControlState({
    organizationId: input.organizationId,
    controlState: next,
    now: generatedAt,
  })
  return next
}

export async function runAutonomousQualificationPilotCycle(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; maxRuns?: number },
): Promise<GrowthAutonomousQualificationPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const { policy } = evaluationContext
  const policyGate = evaluateQualificationPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = deriveQualificationPilotControlFromPolicy(policy, orgState.controlState)

  let eligibleLeads = 0

  if (policyGate.allowed && isQualificationAgentSchedulerActive(effectiveControlState)) {
    const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    })
    const candidates = selectQualificationWakeCandidates({
      rankedMissions: missionPriority.rankedMissions,
    }).slice(0, input.maxRuns ?? 3)

    for (const candidate of candidates) {
      if (isRevenueOperatorHandoffBlocked(candidate)) {
        appendAutonomousQualificationRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousQualificationRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition: "research_completed",
            generatedAt,
            outcome: "skipped",
            skipReason: "Revenue Operator blocked qualification handoff.",
          }),
        })
        continue
      }

      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: candidate.leadId,
      })
      const wakeCondition = evaluateQualificationWakeCondition({
        leadId: candidate.leadId,
        snapshot,
        runs: getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
      })

      if (wakeCondition) eligibleLeads += 1
      if (!wakeCondition) continue

      const budget = enforceQualificationAgentBudget({
        runs: getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        leadId: candidate.leadId,
      })
      if (!budget.allowed) {
        appendAutonomousQualificationRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousQualificationRunRecord({
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
        const decision = await executeAutonomousQualificationEvaluation(admin, {
          organizationId: input.organizationId,
          leadId: candidate.leadId,
          companyName: candidate.companyName,
          wakeCondition,
          generatedAt,
        })
        appendAutonomousQualificationRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousQualificationRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "completed",
            decision,
          }),
        })
      } catch {
        appendAutonomousQualificationRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousQualificationRunRecord({
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

  const finalState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  return enrichAutonomousQualificationPilotWithAutonomyPolicy(
    buildAutonomousQualificationPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      eligibleLeads,
      activeRuns: 0,
    }),
    policy,
  )
}

export async function buildGrowthAutonomousQualificationPilotReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; runCycle?: boolean },
): Promise<GrowthAutonomousQualificationPilotReadModel> {
  if (input.runCycle) {
    return runAutonomousQualificationPilotCycle(admin, input)
  }

  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  return enrichAutonomousQualificationPilotWithAutonomyPolicy(
    buildAutonomousQualificationPilotReadModel({
      controlState: orgState.controlState,
      runs: orgState.runs,
      generatedAt,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

export async function buildGrowthAutonomousQualificationPilotPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousQualificationPilotPlanContext> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const effectiveControlState = deriveQualificationPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  return buildAutonomousQualificationPilotPlanContext({
    leadId: input.leadId,
    snapshot,
    controlState: effectiveControlState,
    runs: orgState.runs,
    generatedAt,
  })
}

export async function runAutonomousQualificationManualEvaluation(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousQualificationPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const policyGate = evaluateQualificationPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = deriveQualificationPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )

  if (!policyGate.allowed || !isQualificationAgentSchedulerActive(effectiveControlState)) {
    appendAutonomousQualificationRun({
      organizationId: input.organizationId,
      now: generatedAt,
      run: buildAutonomousQualificationRunRecord({
        leadId: input.leadId,
        companyName: null,
        wakeCondition: "manual_qualification_request",
        generatedAt,
        outcome: "skipped",
        skipReason: policyGate.blockReason ?? "Pilot not active under current autonomy policy.",
      }),
    })
  } else {
    const budget = enforceQualificationAgentBudget({
      runs: orgState.runs,
      generatedAt,
      leadId: input.leadId,
    })
    if (!budget.allowed) {
      appendAutonomousQualificationRun({
        organizationId: input.organizationId,
        now: generatedAt,
        run: buildAutonomousQualificationRunRecord({
          leadId: input.leadId,
          companyName: null,
          wakeCondition: "manual_qualification_request",
          generatedAt,
          outcome: "skipped",
          skipReason: budget.skipReason,
        }),
      })
    } else {
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      })
      try {
        await executeAutonomousQualificationEvaluation(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          companyName: snapshot?.companyName ?? null,
          wakeCondition: "manual_qualification_request",
          generatedAt,
        })
        appendAutonomousQualificationRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousQualificationRunRecord({
            leadId: input.leadId,
            companyName: snapshot?.companyName ?? null,
            wakeCondition: "manual_qualification_request",
            generatedAt,
            outcome: "completed",
          }),
        })
      } catch {
        appendAutonomousQualificationRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousQualificationRunRecord({
            leadId: input.leadId,
            companyName: snapshot?.companyName ?? null,
            wakeCondition: "manual_qualification_request",
            generatedAt,
            outcome: "failed",
          }),
        })
      }
    }
  }

  const finalState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  return enrichAutonomousQualificationPilotWithAutonomyPolicy(
    buildAutonomousQualificationPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

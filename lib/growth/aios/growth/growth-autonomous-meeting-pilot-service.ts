/** GE-AIOS-GROWTH-5G — Autonomous Meeting Agent Pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  applyMeetingPilotControlTransition,
  buildAutonomousMeetingPilotPlanContext,
  buildAutonomousMeetingPilotReadModel,
  buildAutonomousMeetingRunRecord,
  enforceMeetingAgentBudget,
  evaluateMeetingPreparationGateReadiness,
  evaluateMeetingPreparationWakeCondition,
  hasRequiredContactData,
  isMeetingAgentSchedulerActive,
  isRevenueOperatorMeetingPreparationBlocked,
  resolveMeetingPreparationConfidence,
  selectMeetingPreparationWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-engine"
import { buildAutonomousMeetingPreparationPackage } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-draft-service"
import {
  appendAutonomousMeetingRun,
  getAutonomousMeetingPilotOrgState,
  setAutonomousMeetingPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-store"
import type {
  GrowthAutonomousMeetingPilotControlState,
  GrowthAutonomousMeetingPilotPlanContext,
  GrowthAutonomousMeetingPilotReadModel,
  GrowthAutonomousMeetingWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import {
  GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT,
  GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import { getAutonomousExecutionPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-store"
import { getAutonomousOutreachPreparationPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  deriveMeetingPilotControlFromPolicy,
  enrichAutonomousMeetingPilotWithAutonomyPolicy,
  evaluateMeetingPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export {
  applyMeetingPilotControlTransition,
  buildAutonomousMeetingPilotPlanContext,
  buildAutonomousMeetingPilotReadModel,
  buildAutonomousMeetingRunRecord,
  buildOperationsMeetingAgentStatus,
  enforceMeetingAgentBudget,
  evaluateMeetingPreparationGateReadiness,
  evaluateMeetingPreparationWakeCondition,
  isMeetingAgentSchedulerActive,
  selectMeetingPreparationWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-engine"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishMeetingAgentWakeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeCondition: GrowthAutonomousMeetingWakeCondition
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    category: "agent",
    producer: "growth_autonomous_meeting_pilot",
    source: "growth_autonomous_meeting_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
      scheduler_mode: "controlled_agent_wake",
      wake_condition: input.wakeCondition,
      pilot_phase: "GE-AIOS-GROWTH-5G",
      preparation_mode_only: true,
      calendar_blocked: true,
      booking_blocked: true,
      occurred_at: input.generatedAt,
    },
  })
}

async function publishMeetingPreparedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    packageId: string
    meetingId: string | null
    generatedAt: string
    assetCount: number
    confidence: number
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT,
    category: "agent",
    producer: "growth_autonomous_meeting_pilot",
    source: "growth_autonomous_meeting_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.packageId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
      package_id: input.packageId,
      meeting_id: input.meetingId,
      asset_count: input.assetCount,
      confidence: input.confidence,
      pending_human_approval: true,
      calendar_blocked: true,
      booking_blocked: true,
      occurred_at: input.generatedAt,
    },
  })
}

async function executeAutonomousMeetingPreparation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    wakeCondition: GrowthAutonomousMeetingWakeCondition
    generatedAt: string
  },
) {
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot) {
    throw new Error("Missing workflow snapshot for meeting preparation.")
  }

  await publishMeetingAgentWakeEvent(admin, input)

  const preparationPackage = await buildAutonomousMeetingPreparationPackage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    companyName: input.companyName,
    snapshot,
    generatedAt: input.generatedAt,
  })

  await publishMeetingPreparedEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    packageId: preparationPackage.packageId,
    meetingId: preparationPackage.meetingId,
    generatedAt: input.generatedAt,
    assetCount: preparationPackage.generatedAssets.length,
    confidence: preparationPackage.confidence,
  })

  return {
    preparationPackage,
    confidence: preparationPackage.confidence,
    revenueOperatorHandoff: "human_review_required",
  }
}

export async function applyGrowthAutonomousMeetingPilotControl(input: {
  organizationId: string
  action: "pause" | "resume" | "disable"
  generatedAt?: string
}): Promise<GrowthAutonomousMeetingPilotControlState> {
  const generatedAt = input.generatedAt ?? nowIso()
  const state = getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt)
  const next = applyMeetingPilotControlTransition({ current: state.controlState, action: input.action })
  setAutonomousMeetingPilotControlState({
    organizationId: input.organizationId,
    controlState: next,
    now: generatedAt,
  })
  return next
}

async function resolveLeadContactData(
  admin: SupabaseClient,
  leadId: string,
): Promise<boolean> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return false
  const decisionMakers = await listGrowthLeadDecisionMakers(admin, leadId)
  return hasRequiredContactData({
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.contactPhone,
    decisionMakerCount: decisionMakers.length,
  })
}

export async function runAutonomousMeetingPilotCycle(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; maxRuns?: number },
): Promise<GrowthAutonomousMeetingPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const { policy } = evaluationContext
  const policyGate = evaluateMeetingPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = deriveMeetingPilotControlFromPolicy(policy, orgState.controlState)
  const executionRuns = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs
  const outreachRuns = (
    await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  ).runs

  let eligibleLeads = 0

  if (policyGate.allowed && isMeetingAgentSchedulerActive(effectiveControlState)) {
    const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    })

    const outreachReadyLeadIds = [
      ...new Set(
        outreachRuns
          .filter((run) => run.outcome === "completed" && run.approvalPackage?.pendingHumanApproval)
          .map((run) => run.leadId),
      ),
    ]

    const snapshotsByLeadId = new Map<string, Awaited<ReturnType<typeof fetchLatestGrowthLeadResearchWorkflowSnapshot>>>()
    for (const leadId of outreachReadyLeadIds.slice(0, 12)) {
      snapshotsByLeadId.set(
        leadId,
        await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
          organizationId: input.organizationId,
          leadId,
        }),
      )
    }

    const candidates = selectMeetingPreparationWakeCandidates({
      outreachRuns,
      rankedMissions: missionPriority.rankedMissions,
      snapshotsByLeadId,
    }).slice(0, input.maxRuns ?? 2)

    eligibleLeads = candidates.length

    for (const candidate of candidates) {
      const snapshot = snapshotsByLeadId.get(candidate.leadId) ?? null
      const ranked = missionPriority.rankedMissions.find((row) => row.leadId === candidate.leadId)
      if (
        ranked &&
        isRevenueOperatorMeetingPreparationBlocked({
          allocationStatus: ranked.allocationStatus,
          blockers: ranked.blockers,
        })
      ) {
        appendAutonomousMeetingRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousMeetingRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition: "outreach_preparation_completed",
            generatedAt,
            outcome: "skipped",
            skipReason: "Revenue Operator blocked meeting preparation handoff.",
            confidence: candidate.confidence,
          }),
        })
        continue
      }

      const hasContactData = await resolveLeadContactData(admin, candidate.leadId)
      const gateReadiness = evaluateMeetingPreparationGateReadiness({
        snapshot,
        executionRuns,
        outreachRuns,
        leadId: candidate.leadId,
        confidence: candidate.confidence,
        hasContactData,
      })

      const wakeCondition = evaluateMeetingPreparationWakeCondition({
        leadId: candidate.leadId,
        runs: getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        gateReadiness,
      })

      if (!wakeCondition) continue

      const budget = enforceMeetingAgentBudget({
        runs: getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
        leadId: candidate.leadId,
      })
      if (!budget.allowed) {
        appendAutonomousMeetingRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousMeetingRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "skipped",
            skipReason: budget.skipReason,
            confidence: candidate.confidence,
          }),
        })
        continue
      }

      try {
        if (!snapshot) {
          throw new Error("Workflow snapshot missing for meeting preparation.")
        }
        const decision = await executeAutonomousMeetingPreparation(admin, {
          organizationId: input.organizationId,
          leadId: candidate.leadId,
          companyName: candidate.companyName,
          wakeCondition,
          generatedAt,
        })
        appendAutonomousMeetingRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousMeetingRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "completed",
            preparationPackage: decision.preparationPackage,
            confidence: decision.confidence,
            revenueOperatorHandoff: decision.revenueOperatorHandoff,
          }),
        })
      } catch (error) {
        appendAutonomousMeetingRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousMeetingRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "failed",
            blockReason: error instanceof Error ? error.message : String(error),
            confidence: candidate.confidence,
          }),
        })
      }
    }
  }

  const finalState = getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt)

  return enrichAutonomousMeetingPilotWithAutonomyPolicy(
    buildAutonomousMeetingPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      eligibleLeads,
      activeRuns: 0,
    }),
    policy,
  )
}

export async function buildGrowthAutonomousMeetingPilotReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; runCycle?: boolean },
): Promise<GrowthAutonomousMeetingPilotReadModel> {
  if (input.runCycle) {
    return runAutonomousMeetingPilotCycle(admin, input)
  }

  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const outreachRuns = (
    await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  ).runs
  const eligibleLeads = new Set(
    outreachRuns
      .filter((run) => run.outcome === "completed" && run.approvalPackage?.pendingHumanApproval)
      .map((run) => run.leadId),
  ).size

  return enrichAutonomousMeetingPilotWithAutonomyPolicy(
    buildAutonomousMeetingPilotReadModel({
      controlState: orgState.controlState,
      runs: orgState.runs,
      generatedAt,
      eligibleLeads,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

export async function buildGrowthAutonomousMeetingPilotPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousMeetingPilotPlanContext> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousMeetingPilotOrgState(input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const effectiveControlState = deriveMeetingPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  const executionRuns = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs
  const outreachRuns = (
    await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  ).runs
  const hasContactData = await resolveLeadContactData(admin, input.leadId)

  return buildAutonomousMeetingPilotPlanContext({
    leadId: input.leadId,
    controlState: effectiveControlState,
    runs: orgState.runs,
    snapshot,
    executionRuns,
    outreachRuns,
    generatedAt,
    hasContactData,
  })
}

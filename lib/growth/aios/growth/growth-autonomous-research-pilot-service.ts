/** GE-AIOS-GROWTH-5B — Autonomous Research Agent Pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
  publishGrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import {
  applyPilotControlTransition,
  buildAutonomousResearchPilotPlanContext,
  buildAutonomousResearchPilotReadModel,
  buildAutonomousResearchRunRecord,
  buildDeterministicResearchSummary,
  enforceResearchAgentBudget,
  evaluateWakeCondition,
  isResearchAgentSchedulerActive,
  selectResearchWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-engine"
import { shadowEvaluatePortfolioAllocation } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade"
import { mapMissionAllocationToPortfolioCandidate } from "@/lib/growth/portfolio-allocation/portfolio-allocation-mappers"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import {
  appendAutonomousResearchRun,
  getAutonomousResearchPilotOrgState,
  setAutonomousResearchPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-store"
import type {
  GrowthAutonomousResearchPilotControlState,
  GrowthAutonomousResearchPilotPlanContext,
  GrowthAutonomousResearchPilotReadModel,
  GrowthAutonomousResearchWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  deriveResearchPilotControlFromPolicy,
  enrichAutonomousResearchPilotWithAutonomyPolicy,
  evaluateResearchPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"

export {
  applyPilotControlTransition,
  buildAutonomousResearchPilotPlanContext,
  buildAutonomousResearchPilotReadModel,
  buildAutonomousResearchRunRecord,
  enforceResearchAgentBudget,
  evaluateWakeCondition,
  isResearchAgentSchedulerActive,
  selectResearchWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-engine"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishResearchAgentWakeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeCondition: GrowthAutonomousResearchWakeCondition
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    category: "agent",
    producer: "growth_autonomous_research_pilot",
    source: "growth_autonomous_research_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT,
      scheduler_mode: "controlled_agent_wake",
      wake_condition: input.wakeCondition,
      pilot_phase: "GE-AIOS-GROWTH-5B",
      read_only_outbound: true,
      provider_calls: false,
      occurred_at: input.generatedAt,
    },
  })
}

async function executeAutonomousResearchRefresh(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    wakeCondition: GrowthAutonomousResearchWakeCondition
    generatedAt: string
  },
) {
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  const research = buildDeterministicResearchSummary({
    leadId: input.leadId,
    companyName: input.companyName,
    snapshot,
    generatedAt: input.generatedAt,
  })

  await publishResearchAgentWakeEvent(admin, input)

  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: snapshot?.missionId ?? null,
    workOrderId: null,
    researchRunId: `autonomous-research:${input.leadId}:${input.generatedAt}`,
    workflowStatus: "research_complete",
    qualification: snapshot?.qualification ?? null,
    opportunityAssessment: snapshot?.opportunityAssessment ?? null,
    nextBestAction: snapshot?.nextBestAction ?? null,
    evidenceSummary: snapshot?.evidenceSummary ?? {
      verifiedEvidence: [research.summary],
      missingEvidence: [],
      potentialRisks: [],
      assumptions: ["Autonomous internal refresh — no provider invocation."],
      humanReviewNotes: [],
    },
    executionPlan: snapshot?.executionPlan ?? null,
    detail: `GE-AIOS-GROWTH-5B autonomous research refresh (${input.wakeCondition}).`,
  })

  return research
}

export async function applyGrowthAutonomousResearchPilotControl(input: {
  organizationId: string
  action: "pause" | "resume" | "disable"
  generatedAt?: string
}): Promise<GrowthAutonomousResearchPilotControlState> {
  const generatedAt = input.generatedAt ?? nowIso()
  const state = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  const next = applyPilotControlTransition({ current: state.controlState, action: input.action })
  setAutonomousResearchPilotControlState({
    organizationId: input.organizationId,
    controlState: next,
    now: generatedAt,
  })
  return next
}

export async function runAutonomousResearchPilotCycle(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; maxRuns?: number },
): Promise<GrowthAutonomousResearchPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  const autonomyPolicy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const policyGate = evaluateResearchPilotAutonomyPolicyGate(autonomyPolicy)
  const effectiveControlState = deriveResearchPilotControlFromPolicy(
    autonomyPolicy,
    orgState.controlState,
  )

  if (policyGate.allowed && isResearchAgentSchedulerActive(effectiveControlState)) {
    const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    })
    const wakePool = selectResearchWakeCandidates({
      rankedMissions: missionPriority.rankedMissions,
    })
    const candidates = wakePool.slice(0, input.maxRuns ?? 3)

    // SV1-2 / ARCH-2A — Portfolio Allocation Facade in shadow mode only.
    // Existing selectResearchWakeCandidates + slice remain the production selector.
    await shadowEvaluatePortfolioAllocation(admin, {
      organizationId: input.organizationId,
      capacityClass: "website_research",
      capacitySlotsAvailable: input.maxRuns ?? 3,
      existingSelectedLeadIds: candidates.map((row) => row.leadId),
      candidates: wakePool.map((row) => {
        const resource = evaluateResourceAllocationFacade({
          organizationId: input.organizationId,
          accountId: row.leadId,
          resourceClass: "website_research",
          signals: {
            admission: {
              state: row.allocationStatus === "abandon_recommended" ? "rejected" : "accepted",
            },
            budgetAvailable: row.allocationStatus !== "blocked",
            qualificationRecommendation:
              row.allocationStatus === "abandon_recommended" ? "abandon" : "continue_research",
            evidenceConfidence: Math.max(0, Math.min(1, (row.priority.confidenceScore ?? 50) / 100)),
          },
        })
        return mapMissionAllocationToPortfolioCandidate({
          organizationId: input.organizationId,
          row,
          investmentState: resource.investment_state,
          missionAligned: true,
        })
      }),
    }).catch(() => undefined)

    for (const candidate of candidates) {
      const budget = enforceResearchAgentBudget({
        runs: getAutonomousResearchPilotOrgState(input.organizationId, generatedAt).runs,
        generatedAt,
      })
      if (!budget.allowed) {
        appendAutonomousResearchRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousResearchRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition: "scheduled_research_refresh",
            generatedAt,
            outcome: "skipped",
            skipReason: budget.skipReason,
            snapshot: null,
          }),
        })
        continue
      }

      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: candidate.leadId,
      })
      const wakeCondition = evaluateWakeCondition({
        leadId: candidate.leadId,
        snapshot,
        generatedAt,
      })
      if (!wakeCondition) continue

      try {
        await executeAutonomousResearchRefresh(admin, {
          organizationId: input.organizationId,
          leadId: candidate.leadId,
          companyName: candidate.companyName,
          wakeCondition,
          generatedAt,
        })
        appendAutonomousResearchRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousResearchRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "completed",
            snapshot,
          }),
        })
      } catch {
        appendAutonomousResearchRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousResearchRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "failed",
            snapshot,
          }),
        })
      }
    }
  }

  const finalState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  return enrichAutonomousResearchPilotWithAutonomyPolicy(
    buildAutonomousResearchPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      activeRuns: 0,
    }),
    autonomyPolicy,
  )
}

export async function buildGrowthAutonomousResearchPilotReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; runCycle?: boolean },
): Promise<GrowthAutonomousResearchPilotReadModel> {
  if (input.runCycle) {
    return runAutonomousResearchPilotCycle(admin, input)
  }

  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  return buildAutonomousResearchPilotReadModel({
    controlState: orgState.controlState,
    runs: orgState.runs,
    generatedAt,
    activeRuns: 0,
  })
}

export async function buildGrowthAutonomousResearchPilotPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousResearchPilotPlanContext | null> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  return buildAutonomousResearchPilotPlanContext({
    leadId: input.leadId,
    snapshot,
    controlState: orgState.controlState,
    runs: orgState.runs,
    generatedAt,
  })
}

export async function runAutonomousResearchManualRefresh(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousResearchPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  const autonomyPolicy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const policyGate = evaluateResearchPilotAutonomyPolicyGate(autonomyPolicy)
  const effectiveControlState = deriveResearchPilotControlFromPolicy(
    autonomyPolicy,
    orgState.controlState,
  )

  if (!policyGate.allowed || !isResearchAgentSchedulerActive(effectiveControlState)) {
    appendAutonomousResearchRun({
      organizationId: input.organizationId,
      now: generatedAt,
      run: buildAutonomousResearchRunRecord({
        leadId: input.leadId,
        companyName: null,
        wakeCondition: "manual_refresh_request",
        generatedAt,
        outcome: "skipped",
        skipReason: policyGate.blockReason ?? "Pilot not active under current autonomy policy.",
        snapshot: null,
      }),
    })
  } else {
    const budget = enforceResearchAgentBudget({ runs: orgState.runs, generatedAt })
    if (!budget.allowed) {
      appendAutonomousResearchRun({
        organizationId: input.organizationId,
        now: generatedAt,
        run: buildAutonomousResearchRunRecord({
          leadId: input.leadId,
          companyName: null,
          wakeCondition: "manual_refresh_request",
          generatedAt,
          outcome: "skipped",
          skipReason: budget.skipReason,
          snapshot: null,
        }),
      })
    } else {
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      })
      const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
      try {
        await executeAutonomousResearchRefresh(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          companyName: lead?.companyName ?? null,
          wakeCondition: "manual_refresh_request",
          generatedAt,
        })
        appendAutonomousResearchRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousResearchRunRecord({
            leadId: input.leadId,
            companyName: lead?.companyName ?? null,
            wakeCondition: "manual_refresh_request",
            generatedAt,
            outcome: "completed",
            snapshot,
          }),
        })
      } catch {
        appendAutonomousResearchRun({
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousResearchRunRecord({
            leadId: input.leadId,
            companyName: lead?.companyName ?? null,
            wakeCondition: "manual_refresh_request",
            generatedAt,
            outcome: "failed",
            snapshot,
          }),
        })
      }
    }
  }

  const finalState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  return enrichAutonomousResearchPilotWithAutonomyPolicy(
    buildAutonomousResearchPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      activeRuns: 0,
    }),
    autonomyPolicy,
  )
}

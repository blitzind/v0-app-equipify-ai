/** GE-AIOS-GROWTH-5F — Autonomous Outreach Preparation Agent Pilot service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  applyOutreachPreparationPilotControlTransition,
  buildAutonomousOutreachPreparationPilotPlanContext,
  buildAutonomousOutreachPreparationPilotReadModel,
  buildAutonomousOutreachPreparationRunRecord,
  enforceOutreachPreparationAgentBudget,
  evaluateOutreachPreparationGateReadiness,
  evaluateOutreachPreparationWakeCondition,
  isOutreachPreparationAgentSchedulerActive,
  isRevenueOperatorOutreachPreparationBlocked,
  resolveOutreachPreparationConfidence,
  selectOutreachPreparationWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import {
  appendAutonomousOutreachPreparationRun,
  getAutonomousOutreachPreparationPilotOrgState,
  setAutonomousOutreachPreparationPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import type {
  GrowthAutonomousOutreachPreparationPilotControlState,
  GrowthAutonomousOutreachPreparationPilotPlanContext,
  GrowthAutonomousOutreachPreparationPilotReadModel,
  GrowthAutonomousOutreachPreparationWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { getAutonomousExecutionPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-store"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  deriveOutreachPreparationPilotControlFromPolicy,
  enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy,
  evaluateOutreachPreparationPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { shadowEvaluateResourceAllocation } from "@/lib/growth/resource-allocation/resource-allocation-facade"
import { shadowEvaluatePortfolioAllocation } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade"
import { mapMissionAllocationToPortfolioCandidate } from "@/lib/growth/portfolio-allocation/portfolio-allocation-mappers"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { advanceDraftFactoryForLeadLive } from "@/lib/growth/draft-factory/draft-factory-durable-live"

export {
  applyOutreachPreparationPilotControlTransition,
  buildAutonomousOutreachPreparationPilotPlanContext,
  buildAutonomousOutreachPreparationPilotReadModel,
  buildAutonomousOutreachPreparationRunRecord,
  buildOperationsOutreachAgentStatus,
  enforceOutreachPreparationAgentBudget,
  evaluateOutreachPreparationGateReadiness,
  evaluateOutreachPreparationWakeCondition,
  isOutreachPreparationAgentSchedulerActive,
  selectOutreachPreparationWakeCandidates,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishOutreachPreparationAgentWakeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeCondition: GrowthAutonomousOutreachPreparationWakeCondition
    generatedAt: string
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    category: "agent",
    producer: "growth_autonomous_outreach_preparation_pilot",
    source: "growth_autonomous_outreach_preparation_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
      scheduler_mode: "controlled_agent_wake",
      wake_condition: input.wakeCondition,
      pilot_phase: "GE-AIOS-GROWTH-5F",
      preparation_mode_only: true,
      transport_blocked: true,
      occurred_at: input.generatedAt,
    },
  })
}

async function publishOutreachPreparedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    packageId: string
    generatedAt: string
    assetCount: number
    confidence: number
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT,
    category: "agent",
    producer: "growth_autonomous_outreach_preparation_pilot",
    source: "growth_autonomous_outreach_preparation_pilot_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.packageId,
    payload: {
      agent_kind: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
      package_id: input.packageId,
      asset_count: input.assetCount,
      confidence: input.confidence,
      pending_human_approval: true,
      transport_blocked: true,
      occurred_at: input.generatedAt,
    },
  })
}

async function executeAutonomousOutreachPreparation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    wakeCondition: GrowthAutonomousOutreachPreparationWakeCondition
    generatedAt: string
  },
) {
  // SV1-5A — Postgres durable Draft Factory is production authority.
  // Growth 5F remains the only package generator. No parallel scheduler.
  const factoryAdvance = await advanceDraftFactoryForLeadLive(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    wake: {
      type: "outreach_preparation_wake",
      sourceId: `5f:${input.wakeCondition}:${input.generatedAt}`,
    },
    portfolioSelected: true,
    now: input.generatedAt,
    allowGeneration: true,
  }).catch(() => null)

  const isCertHarness =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("example.supabase.co") ||
    process.env.GROWTH_DRAFT_FACTORY_CERT_FALLBACK === "1"

  const postgresUnavailable =
    factoryAdvance?.state?.pausedReason === "postgres_fail_closed" ||
    factoryAdvance?.state?.lastErrorCode === "postgres_unavailable" ||
    Boolean(factoryAdvance?.reason?.includes("Postgres durable store unavailable"))

  // Production: never fall back to in-memory SV1-3.
  // Cert harness (example.supabase.co): allow SV1-3 path so Growth 5F certs remain green pre-migration.
  if (factoryAdvance && !postgresUnavailable) {
    if (factoryAdvance.nextState === "waiting_for_approval" && factoryAdvance.packageId) {
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      })
      if (snapshot) {
        const approvalPackage = await buildAutonomousOutreachApprovalPackage(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          companyName: input.companyName,
          snapshot,
          generatedAt: input.generatedAt,
        })
        if (
          approvalPackage.pendingHumanApproval === true &&
          approvalPackage.transportBlocked === true
        ) {
          if (!factoryAdvance.duplicate) {
            await publishOutreachPreparationAgentWakeEvent(admin, input)
            await publishOutreachPreparedEvent(admin, {
              organizationId: input.organizationId,
              leadId: input.leadId,
              packageId: approvalPackage.packageId,
              generatedAt: input.generatedAt,
              assetCount: approvalPackage.generatedAssets.length,
              confidence: approvalPackage.confidence,
            })
          }
          return {
            approvalPackage,
            confidence: approvalPackage.confidence,
            revenueOperatorHandoff: "human_review_required" as const,
          }
        }
      }
    }

    if (
      factoryAdvance.outcome === "stopped" ||
      factoryAdvance.outcome === "deferred" ||
      factoryAdvance.outcome === "waiting" ||
      factoryAdvance.outcome === "retryable_failure" ||
      factoryAdvance.nextState === "waiting_for_research" ||
      factoryAdvance.nextState === "waiting_for_dm" ||
      factoryAdvance.nextState === "waiting_for_contact_verification" ||
      factoryAdvance.nextState === "waiting_for_personalization" ||
      factoryAdvance.nextState === "waiting_for_generation" ||
      factoryAdvance.nextState === "paused"
    ) {
      return {
        approvalPackage: null,
        confidence: 0,
        revenueOperatorHandoff: "human_review_required" as const,
      }
    }
  }

  if (postgresUnavailable && !isCertHarness) {
    throw new Error(
      factoryAdvance?.reason ??
        "Draft Factory Postgres durable store unavailable — fail closed (no memory fallback).",
    )
  }

  // Cert-harness / transitional SV1-3 path (not production authority).
  const { advanceDraftFactoryForLead: advanceSv13 } = await import(
    "@/lib/growth/draft-factory/draft-factory-service"
  )
  const sv13 = await advanceSv13(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    wakeSource: "outreach_preparation_wake",
    portfolioSelected: true,
    selectedBecause: `Growth 5F wake (${input.wakeCondition}) after internal execution.`,
    generatedAt: input.generatedAt,
    allowGeneration: true,
  }).catch(() => null)

  if (
    sv13?.package?.growth5fApprovalPackage &&
    sv13.duplicatePrevented &&
    sv13.nextState === "waiting_for_approval"
  ) {
    const approvalPackage = sv13.package.growth5fApprovalPackage
    return {
      approvalPackage,
      confidence: approvalPackage.confidence,
      revenueOperatorHandoff: "human_review_required" as const,
    }
  }

  if (sv13?.package?.growth5fApprovalPackage && sv13.stageExecuted === "generation") {
    const approvalPackage = sv13.package.growth5fApprovalPackage
    await publishOutreachPreparationAgentWakeEvent(admin, input)
    await publishOutreachPreparedEvent(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      packageId: approvalPackage.packageId,
      generatedAt: input.generatedAt,
      assetCount: approvalPackage.generatedAssets.length,
      confidence: approvalPackage.confidence,
    })
    return {
      approvalPackage,
      confidence: approvalPackage.confidence,
      revenueOperatorHandoff: "human_review_required" as const,
    }
  }

  if (
    sv13?.blockedReason &&
    /Investment gate|Portfolio gate|Stop Investment|transport_blocked must remain/i.test(sv13.blockedReason)
  ) {
    throw new Error(sv13.blockedReason)
  }

  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot) {
    throw new Error("Missing workflow snapshot for outreach preparation.")
  }

  await publishOutreachPreparationAgentWakeEvent(admin, input)

  const approvalPackage = await buildAutonomousOutreachApprovalPackage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    companyName: input.companyName,
    snapshot,
    generatedAt: input.generatedAt,
  })

  await publishOutreachPreparedEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    packageId: approvalPackage.packageId,
    generatedAt: input.generatedAt,
    assetCount: approvalPackage.generatedAssets.length,
    confidence: approvalPackage.confidence,
  })

  return {
    approvalPackage,
    confidence: approvalPackage.confidence,
    revenueOperatorHandoff: "human_review_required" as const,
  }
}

export async function applyGrowthAutonomousOutreachPreparationPilotControl(input: {
  admin: SupabaseClient
  organizationId: string
  action: "pause" | "resume" | "disable"
  generatedAt?: string
}): Promise<GrowthAutonomousOutreachPreparationPilotControlState> {
  const generatedAt = input.generatedAt ?? nowIso()
  const state = await getAutonomousOutreachPreparationPilotOrgState(
    input.admin,
    input.organizationId,
    generatedAt,
  )
  const next = applyOutreachPreparationPilotControlTransition({ current: state.controlState, action: input.action })
  await setAutonomousOutreachPreparationPilotControlState({
    admin: input.admin,
    organizationId: input.organizationId,
    controlState: next,
    now: generatedAt,
  })
  return next
}

export async function runAutonomousOutreachPreparationPilotCycle(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; maxRuns?: number },
): Promise<GrowthAutonomousOutreachPreparationPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const { policy } = evaluationContext
  const policyGate = evaluateOutreachPreparationPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = deriveOutreachPreparationPilotControlFromPolicy(policy, orgState.controlState)
  const executionRuns = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs

  let eligibleLeads = 0

  if (policyGate.allowed && isOutreachPreparationAgentSchedulerActive(effectiveControlState)) {
    const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    })

    const completedLeadIds = [
      ...new Set(
        executionRuns
          .filter((run) => run.outcome === "completed" && run.workflowType === "research_company")
          .map((run) => run.leadId),
      ),
    ]

    const snapshotsByLeadId = new Map<string, Awaited<ReturnType<typeof fetchLatestGrowthLeadResearchWorkflowSnapshot>>>()
    for (const leadId of completedLeadIds.slice(0, 12)) {
      snapshotsByLeadId.set(
        leadId,
        await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
          organizationId: input.organizationId,
          leadId,
        }),
      )
    }

    const wakePool = selectOutreachPreparationWakeCandidates({
      executionRuns,
      rankedMissions: missionPriority.rankedMissions,
      snapshotsByLeadId,
    })
    const candidates = wakePool.slice(0, input.maxRuns ?? 2)

    eligibleLeads = candidates.length

    // SV1-2 / ARCH-2A — Portfolio Allocation Facade in shadow mode only.
    // Existing selectOutreachPreparationWakeCandidates + slice remain the production selector.
    await shadowEvaluatePortfolioAllocation(admin, {
      organizationId: input.organizationId,
      capacityClass: "sequence_preparation",
      capacitySlotsAvailable: input.maxRuns ?? 2,
      existingSelectedLeadIds: candidates.map((row) => row.leadId),
      candidates: wakePool.map((row) => {
        const ranked = missionPriority.rankedMissions.find((mission) => mission.leadId === row.leadId)
        const resource = evaluateResourceAllocationFacade({
          organizationId: input.organizationId,
          accountId: row.leadId,
          resourceClass: "sequence_preparation",
          signals: {
            admission: { state: "accepted" },
            budgetAvailable: true,
            evidenceConfidence: row.confidence,
            approvalRequired: true,
            approvalGranted: false,
            qualificationRecommendation: "prepare_outreach",
          },
        })
        return ranked
          ? mapMissionAllocationToPortfolioCandidate({
              organizationId: input.organizationId,
              row: ranked,
              investmentState: resource.investment_state,
              missionAligned: true,
            })
          : {
              leadId: row.leadId,
              organizationId: input.organizationId,
              companyName: row.companyName,
              investmentState: resource.investment_state,
              signals: {
                missionAligned: true,
                missionPriorityOverall: Math.round(row.confidence * 100),
                urgencyScore: Math.round(row.confidence * 100),
              },
            }
      }),
    }).catch(() => undefined)

    for (const candidate of candidates) {
      const snapshot = snapshotsByLeadId.get(candidate.leadId) ?? null
      const ranked = missionPriority.rankedMissions.find((row) => row.leadId === candidate.leadId)
      let pilotRuns = (
        await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
      ).runs
      if (
        ranked &&
        isRevenueOperatorOutreachPreparationBlocked({
          allocationStatus: ranked.allocationStatus,
          blockers: ranked.blockers,
        })
      ) {
        await appendAutonomousOutreachPreparationRun({
          admin,
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousOutreachPreparationRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition: "execution_completed",
            generatedAt,
            outcome: "skipped",
            skipReason: "Revenue Operator blocked outreach preparation handoff.",
            confidence: candidate.confidence,
          }),
        })
        continue
      }

      const gateReadiness = evaluateOutreachPreparationGateReadiness({
        snapshot,
        executionRuns,
        leadId: candidate.leadId,
        confidence: candidate.confidence,
      })

      const wakeCondition = evaluateOutreachPreparationWakeCondition({
        leadId: candidate.leadId,
        runs: pilotRuns,
        generatedAt,
        gateReadiness,
      })

      if (!wakeCondition) continue

      pilotRuns = (
        await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
      ).runs
      const budget = enforceOutreachPreparationAgentBudget({
        runs: pilotRuns,
        generatedAt,
        leadId: candidate.leadId,
      })
      if (!budget.allowed) {
        await appendAutonomousOutreachPreparationRun({
          admin,
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousOutreachPreparationRunRecord({
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

      // SV1-1 / ARCH-1A — shadow Resource Allocation before sequence preparation.
      // Existing budget / wake / autonomy gates remain the production allow/deny path.
      await shadowEvaluateResourceAllocation(admin, {
        organizationId: input.organizationId,
        accountId: candidate.leadId,
        accountKind: "lead",
        resourceClass: "sequence_preparation",
        requestedBy: "outreach_preparation_pilot",
        signals: {
          admission: { state: "accepted" },
          evidenceConfidence: candidate.confidence,
          autonomyAllowed: policyGate.allowed,
          budgetAvailable: budget.allowed,
          approvalRequired: true,
          approvalGranted: false,
        },
      }).catch(() => undefined)

      try {
        if (!snapshot) {
          throw new Error("Workflow snapshot missing for outreach preparation.")
        }
        const decision = await executeAutonomousOutreachPreparation(admin, {
          organizationId: input.organizationId,
          leadId: candidate.leadId,
          companyName: candidate.companyName,
          wakeCondition,
          generatedAt,
        })
        await appendAutonomousOutreachPreparationRun({
          admin,
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousOutreachPreparationRunRecord({
            leadId: candidate.leadId,
            companyName: candidate.companyName,
            wakeCondition,
            generatedAt,
            outcome: "completed",
            approvalPackage: decision.approvalPackage,
            confidence: decision.confidence,
            revenueOperatorHandoff: decision.revenueOperatorHandoff,
          }),
        })
      } catch (error) {
        await appendAutonomousOutreachPreparationRun({
          admin,
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousOutreachPreparationRunRecord({
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

  const finalState = await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)

  return enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy(
    buildAutonomousOutreachPreparationPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      eligibleLeads,
      activeRuns: 0,
    }),
    policy,
  )
}

export async function buildGrowthAutonomousOutreachPreparationPilotReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string; runCycle?: boolean },
): Promise<GrowthAutonomousOutreachPreparationPilotReadModel> {
  if (input.runCycle) {
    return runAutonomousOutreachPreparationPilotCycle(admin, input)
  }

  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const executionRuns = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs
  const eligibleLeads = new Set(
    executionRuns.filter((run) => run.outcome === "completed").map((run) => run.leadId),
  ).size

  return enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy(
    buildAutonomousOutreachPreparationPilotReadModel({
      controlState: orgState.controlState,
      runs: orgState.runs,
      generatedAt,
      eligibleLeads,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

export async function buildGrowthAutonomousOutreachPreparationPilotPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousOutreachPreparationPilotPlanContext> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const effectiveControlState = deriveOutreachPreparationPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )
  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  const executionRuns = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt).runs

  return buildAutonomousOutreachPreparationPilotPlanContext({
    leadId: input.leadId,
    controlState: effectiveControlState,
    runs: orgState.runs,
    snapshot,
    executionRuns,
    generatedAt,
  })
}

export async function runAutonomousOutreachPreparationManualRequest(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthAutonomousOutreachPreparationPilotReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const orgState = await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const policyGate = evaluateOutreachPreparationPilotAutonomyPolicyGate(evaluationContext)
  const effectiveControlState = deriveOutreachPreparationPilotControlFromPolicy(
    evaluationContext.policy,
    orgState.controlState,
  )

  if (!policyGate.allowed || !isOutreachPreparationAgentSchedulerActive(effectiveControlState)) {
    await appendAutonomousOutreachPreparationRun({
      admin,
      organizationId: input.organizationId,
      now: generatedAt,
      run: buildAutonomousOutreachPreparationRunRecord({
        leadId: input.leadId,
        companyName: null,
        wakeCondition: "manual_outreach_preparation_request",
        generatedAt,
        outcome: "skipped",
        skipReason: policyGate.blockReason ?? "Pilot not active under current autonomy policy.",
      }),
    })
  } else {
    const budget = enforceOutreachPreparationAgentBudget({
      runs: orgState.runs,
      generatedAt,
      leadId: input.leadId,
    })
    if (!budget.allowed) {
      await appendAutonomousOutreachPreparationRun({
        admin,
        organizationId: input.organizationId,
        now: generatedAt,
        run: buildAutonomousOutreachPreparationRunRecord({
          leadId: input.leadId,
          companyName: null,
          wakeCondition: "manual_outreach_preparation_request",
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
        const decision = await executeAutonomousOutreachPreparation(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          companyName: snapshot?.companyName ?? null,
          wakeCondition: "manual_outreach_preparation_request",
          generatedAt,
        })
        await appendAutonomousOutreachPreparationRun({
          admin,
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousOutreachPreparationRunRecord({
            leadId: input.leadId,
            companyName: snapshot?.companyName ?? null,
            wakeCondition: "manual_outreach_preparation_request",
            generatedAt,
            outcome: "completed",
            approvalPackage: decision.approvalPackage,
            confidence: decision.confidence,
            revenueOperatorHandoff: decision.revenueOperatorHandoff,
          }),
        })
      } catch {
        await appendAutonomousOutreachPreparationRun({
          admin,
          organizationId: input.organizationId,
          now: generatedAt,
          run: buildAutonomousOutreachPreparationRunRecord({
            leadId: input.leadId,
            companyName: snapshot?.companyName ?? null,
            wakeCondition: "manual_outreach_preparation_request",
            generatedAt,
            outcome: "failed",
          }),
        })
      }
    }
  }

  const finalState = await getAutonomousOutreachPreparationPilotOrgState(admin, input.organizationId, generatedAt)
  return enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy(
    buildAutonomousOutreachPreparationPilotReadModel({
      controlState: effectiveControlState,
      runs: finalState.runs,
      generatedAt,
      activeRuns: 0,
    }),
    evaluationContext.policy,
  )
}

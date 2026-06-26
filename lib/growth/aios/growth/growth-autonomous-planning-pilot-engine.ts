/** GE-AIOS-GROWTH-5D — Autonomous Planning Agent Pilot engine (client-safe, deterministic). */

import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import {
  planGrowthLeadResearchExecution,
  type GrowthLeadResearchExecutionPlan,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { buildGrowthLeadResearchExecutionPlanId } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { buildResearchResultFromWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-engine"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type {
  GrowthAutonomousPlanningDecisionSummary,
  GrowthAutonomousPlanningPilotControlState,
  GrowthAutonomousPlanningPilotPlanContext,
  GrowthAutonomousPlanningPilotReadModel,
  GrowthAutonomousPlanningPilotTelemetry,
  GrowthAutonomousPlanningRunRecord,
  GrowthAutonomousPlanningWakeCondition,
  GrowthRevenueOperatorPlanningSupervision,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import {
  GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_MIN_CONFIDENCE,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_RULE,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"

const RECENT_PLANNING_MS = 24 * 60 * 60 * 1000
const STALE_PLAN_MS = 7 * 24 * 60 * 60 * 1000

export const GROWTH_AUTONOMOUS_PLANNING_DISABLED_AGENT_KINDS = [
  "meeting_agent",
] as const satisfies readonly GrowthAgentKind[]

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isPlanningAgentSchedulerActive(
  controlState: GrowthAutonomousPlanningPilotControlState,
): boolean {
  return controlState === "active"
}

export function evaluatePlanningMemoryReadiness(snapshot: GrowthLeadResearchWorkflowSnapshot | null): {
  sufficient: boolean
  blockReason: string | null
} {
  if (!snapshot || !snapshot.researchRunId) {
    return { sufficient: false, blockReason: "Required research context is missing." }
  }

  if (!snapshot.qualification) {
    return { sufficient: false, blockReason: "Qualification incomplete — planning not eligible." }
  }

  if (snapshot.workflowStatus === "failed" || snapshot.workflowStatus === "blocked") {
    return { sufficient: false, blockReason: "Lead blocked or failed — planning not eligible." }
  }

  if (snapshot.workflowStatus !== "qualified" && snapshot.workflowStatus !== "assessed") {
    return { sufficient: false, blockReason: "Qualification must complete before planning." }
  }

  const confidence = snapshot.qualification.confidence
  if (confidence < GROWTH_AUTONOMOUS_PLANNING_PILOT_MIN_CONFIDENCE) {
    return {
      sufficient: false,
      blockReason: `Confidence ${confidence} below planning threshold ${GROWTH_AUTONOMOUS_PLANNING_PILOT_MIN_CONFIDENCE}.`,
    }
  }

  if (!snapshot.evidenceSummary?.verifiedEvidence?.length) {
    return { sufficient: false, blockReason: "Shared memory completeness insufficient for planning." }
  }

  return { sufficient: true, blockReason: null }
}

export function resolvePlanningIntelligenceFromSnapshot(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot
  companyName: string | null
}) {
  if (
    input.snapshot.qualification &&
    input.snapshot.opportunityAssessment &&
    input.snapshot.nextBestAction &&
    input.snapshot.evidenceSummary
  ) {
    return {
      qualification: input.snapshot.qualification,
      opportunityAssessment: input.snapshot.opportunityAssessment,
      nextBestAction: input.snapshot.nextBestAction,
      evidenceSummary: input.snapshot.evidenceSummary,
    }
  }

  const researchResult = buildResearchResultFromWorkflowSnapshot({
    snapshot: input.snapshot,
    companyName: input.companyName,
  })

  if (!input.snapshot.qualification) {
    return null
  }

  return assessGrowthLeadResearchOpportunity({
    result: researchResult,
    qualification: input.snapshot.qualification,
  })
}

export function evaluateAutonomousPlanningDecision(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot
  companyName: string | null
}): {
  executionPlan: GrowthLeadResearchExecutionPlan
  planId: string
  confidence: number
  reasoning: string
  expectedOutcome: string
  requiredApprovals: string[]
  prerequisites: string[]
  revenueOperatorHandoff: string
} | null {
  const intelligence = resolvePlanningIntelligenceFromSnapshot(input)
  if (!intelligence) return null

  const executionPlan = planGrowthLeadResearchExecution({
    nextBestAction: intelligence.nextBestAction,
    opportunityAssessment: intelligence.opportunityAssessment,
    evidenceSummary: intelligence.evidenceSummary,
    qualification: intelligence.qualification,
  })

  const planId = buildGrowthLeadResearchExecutionPlanId({
    leadId: input.snapshot.leadId,
    plan: executionPlan,
  })

  const requiredApprovals = executionPlan.approvalRequired
    ? ["Operator approval required before future execution."]
    : []

  const revenueOperatorHandoff =
    executionPlan.executionReadiness === "blocked"
      ? "human_review_required"
      : executionPlan.approvalRequired
        ? "await_operator_approval"
        : "handoff_to_revenue_operator"

  return {
    executionPlan,
    planId,
    confidence: intelligence.qualification.confidence,
    reasoning: `Deterministic plan for ${executionPlan.workflowType.replaceAll("_", " ")} — ${intelligence.opportunityAssessment.summary}`,
    expectedOutcome: executionPlan.expectedOutcome,
    requiredApprovals,
    prerequisites: executionPlan.prerequisites,
    revenueOperatorHandoff,
  }
}

export function countPlanningRunsInWindow(input: {
  runs: GrowthAutonomousPlanningRunRecord[]
  generatedAt: string
  windowMs: number
  leadId?: string
  outcomes?: GrowthAutonomousPlanningRunRecord["outcome"][]
}): number {
  const now = Date.parse(input.generatedAt)
  return input.runs.filter((run) => {
    if (input.leadId && run.leadId !== input.leadId) return false
    if (input.outcomes && !input.outcomes.includes(run.outcome)) return false
    if (run.outcome === "skipped") return false
    const started = Date.parse(run.startedAt)
    return Number.isFinite(started) && now - started <= input.windowMs
  }).length
}

export function isLeadInPlanningFailureCooldown(input: {
  runs: GrowthAutonomousPlanningRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const cooldownMs = GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.cooldownAfterFailureMinutes * 60 * 1000
  const now = Date.parse(input.generatedAt)
  const lastFailed = input.runs
    .filter((run) => run.leadId === input.leadId && run.outcome === "failed")
    .map((run) => parseTime(run.completedAt))
    .sort((a, b) => b - a)[0]

  return lastFailed > 0 && now - lastFailed < cooldownMs
}

export function enforcePlanningAgentBudget(input: {
  runs: GrowthAutonomousPlanningRunRecord[]
  generatedAt: string
  leadId?: string
}): { allowed: boolean; skipReason: string | null } {
  const hourCount = countPlanningRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 60 * 60 * 1000,
  })
  if (hourCount >= GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour) {
    return {
      allowed: false,
      skipReason: `Hourly budget exhausted (${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour}/hr).`,
    }
  }

  const dayCount = countPlanningRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (dayCount >= GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerDay) {
    return {
      allowed: false,
      skipReason: `Daily budget exhausted (${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerDay}/day).`,
    }
  }

  if (input.leadId) {
    const leadRetries = countPlanningRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
      leadId: input.leadId,
      outcomes: ["failed", "completed"],
    })
    if (leadRetries >= GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRetriesPerLeadPerDay) {
      return {
        allowed: false,
        skipReason: `Lead retry limit reached (${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRetriesPerLeadPerDay}/day).`,
      }
    }

    if (isLeadInPlanningFailureCooldown({ runs: input.runs, leadId: input.leadId, generatedAt: input.generatedAt })) {
      return {
        allowed: false,
        skipReason: `Cooldown active after failed planning (${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.cooldownAfterFailureMinutes} min).`,
      }
    }
  }

  return { allowed: true, skipReason: null }
}

export function hasRecentDuplicatePlan(input: {
  runs: GrowthAutonomousPlanningRunRecord[]
  leadId: string
  planId: string
  generatedAt: string
}): boolean {
  const now = Date.parse(input.generatedAt)
  return input.runs.some(
    (run) =>
      run.leadId === input.leadId &&
      run.outcome === "completed" &&
      run.planId === input.planId &&
      now - parseTime(run.completedAt) <= RECENT_PLANNING_MS,
  )
}

export function evaluatePlanningWakeCondition(input: {
  leadId: string
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  runs: GrowthAutonomousPlanningRunRecord[]
  generatedAt: string
  explicitTrigger?: GrowthAutonomousPlanningWakeCondition | null
  companyName?: string | null
}): GrowthAutonomousPlanningWakeCondition | null {
  if (input.explicitTrigger) return input.explicitTrigger

  const memory = evaluatePlanningMemoryReadiness(input.snapshot)
  if (!memory.sufficient) return null

  const snapshot = input.snapshot!
  const decision = evaluateAutonomousPlanningDecision({
    snapshot,
    companyName: input.companyName ?? null,
  })
  if (!decision) return null

  if (
    hasRecentDuplicatePlan({
      runs: input.runs,
      leadId: input.leadId,
      planId: decision.planId,
      generatedAt: input.generatedAt,
    })
  ) {
    return null
  }

  const updatedAt = parseTime(snapshot.updatedAt)
  const now = Date.parse(input.generatedAt)

  if (!snapshot.executionPlan) {
    return "qualification_completed"
  }

  if (updatedAt > 0 && now - updatedAt > STALE_PLAN_MS) {
    return "stale_execution_plan"
  }

  if (
    snapshot.executionPlan.workflowType !== decision.executionPlan.workflowType ||
    snapshot.executionPlan.nextBestActionKind !== decision.executionPlan.nextBestActionKind
  ) {
    return "qualification_completed"
  }

  return null
}

export function selectPlanningWakeCandidates(input: {
  rankedMissions: GrowthMissionAllocationRecommendation[]
}): GrowthMissionAllocationRecommendation[] {
  return input.rankedMissions.filter(
    (row) =>
      row.missionType === "prepare_outreach" &&
      row.allocationStatus !== "abandon_recommended" &&
      row.allocationStatus !== "blocked" &&
      row.allocationStatus !== "waiting_for_human",
  )
}

export function isRevenueOperatorPlanningBlocked(input: {
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"]
  blockers: string[]
}): boolean {
  if (input.allocationStatus === "blocked" || input.allocationStatus === "waiting_for_human") {
    return true
  }
  return input.blockers.some((blocker) =>
    /revenue operator|planning blocked|orchestration blocked|handoff blocked/i.test(blocker),
  )
}

export function buildAutonomousPlanningRunRecord(input: {
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousPlanningWakeCondition
  generatedAt: string
  outcome: GrowthAutonomousPlanningRunRecord["outcome"]
  skipReason?: string | null
  decision?: ReturnType<typeof evaluateAutonomousPlanningDecision> | null
  durationMs?: number
}): GrowthAutonomousPlanningRunRecord {
  const durationMs = input.durationMs ?? 1100
  const decision = input.decision

  return {
    runId: `growth-planning-agent-run:${input.leadId}:${input.generatedAt}`,
    leadId: input.leadId,
    companyName: input.companyName,
    wakeCondition: input.wakeCondition,
    outcome: input.outcome,
    startedAt: input.generatedAt,
    completedAt: new Date(Date.parse(input.generatedAt) + durationMs).toISOString(),
    durationMs,
    planId: decision?.planId ?? null,
    workflowType: decision?.executionPlan.workflowType ?? null,
    confidence: decision?.confidence ?? null,
    executionReadiness: decision?.executionPlan.executionReadiness ?? null,
    skipReason: input.skipReason ?? null,
    reasoning: decision?.reasoning ?? null,
    expectedOutcome: decision?.expectedOutcome ?? null,
    requiredApprovals: decision?.requiredApprovals ?? [],
    prerequisites: decision?.prerequisites ?? [],
    revenueOperatorHandoff: decision?.revenueOperatorHandoff ?? null,
  }
}

export function buildAutonomousPlanningTelemetry(input: {
  runs: GrowthAutonomousPlanningRunRecord[]
  generatedAt: string
  eligibleLeads: number
  activeRuns: number
}): GrowthAutonomousPlanningPilotTelemetry {
  const completed = input.runs.filter((run) => run.outcome === "completed")
  const failed = input.runs.filter((run) => run.outcome === "failed")
  const skipped = input.runs.filter((run) => run.outcome === "skipped")
  const blocked = skipped.filter((run) =>
    Boolean(run.skipReason?.includes("blocked") || run.skipReason?.includes("Revenue Operator")),
  )
  const avgDuration =
    completed.length > 0
      ? Math.round(completed.reduce((sum, run) => sum + run.durationMs, 0) / completed.length)
      : 0
  const avgConfidence =
    completed.length > 0
      ? Math.round(
          (completed.reduce((sum, run) => sum + (run.confidence ?? 0), 0) / completed.length) * 100,
        ) / 100
      : 0

  return {
    successfulRuns: completed.length,
    failedRuns: failed.length,
    skippedRuns: skipped.length,
    eligibleLeads: input.eligibleLeads,
    plansGenerated: completed.length,
    blockedPlanning: blocked.length,
    averageDurationMs: avgDuration,
    averageConfidence: avgConfidence,
    budgetConsumptionHour: countPlanningRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 60 * 60 * 1000,
    }),
    budgetConsumptionDay: countPlanningRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    activeRuns: input.activeRuns,
  }
}

export function buildRevenueOperatorPlanningSupervision(input: {
  controlState: GrowthAutonomousPlanningPilotControlState
  telemetry: GrowthAutonomousPlanningPilotTelemetry
  latestHandoff: string | null
}): GrowthRevenueOperatorPlanningSupervision {
  const budgetNearLimit =
    input.telemetry.budgetConsumptionHour >= GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour - 2

  return {
    approveWakeRecommendation:
      input.controlState === "active"
        ? "Planning Agent wake approved under controlled_agent_wake — prepare_outreach missions only."
        : "Planning Agent wake blocked — pilot not active.",
    budgetMonitorSummary: `${input.telemetry.budgetConsumptionHour}/${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour} hourly · ${input.telemetry.budgetConsumptionDay}/${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerDay} daily.`,
    failureMonitorSummary:
      input.telemetry.failedRuns > 0
        ? `${input.telemetry.failedRuns} failed runs — review before expanding wake scope.`
        : "No failed autonomous planning runs recorded.",
    pauseRecommendation:
      budgetNearLimit || input.telemetry.failedRuns >= 3
        ? "Recommend pausing Planning Agent pilot until budget resets or failures reviewed."
        : null,
    escalationRecommendation:
      input.telemetry.failedRuns >= 5
        ? "Escalate to Revenue Operator — disable pilot and audit wake conditions."
        : null,
    latestHandoffRecommendation: input.latestHandoff,
  }
}

export function applyPlanningPilotControlTransition(input: {
  current: GrowthAutonomousPlanningPilotControlState
  action: "pause" | "resume" | "disable"
}): GrowthAutonomousPlanningPilotControlState {
  if (input.action === "disable") return "disabled"
  if (input.action === "pause") {
    return input.current === "disabled" ? "disabled" : "paused"
  }
  return "active"
}

export function buildAutonomousPlanningPilotReadModel(input: {
  controlState: GrowthAutonomousPlanningPilotControlState
  runs: GrowthAutonomousPlanningRunRecord[]
  generatedAt: string
  eligibleLeads?: number
  activeRuns?: number
}): GrowthAutonomousPlanningPilotReadModel {
  const telemetry = buildAutonomousPlanningTelemetry({
    runs: input.runs,
    generatedAt: input.generatedAt,
    eligibleLeads: input.eligibleLeads ?? 0,
    activeRuns: input.activeRuns ?? 0,
  })

  const latestPlans: GrowthAutonomousPlanningDecisionSummary[] = input.runs
    .filter((run) => run.outcome === "completed" && run.planId && run.workflowType)
    .slice(-8)
    .reverse()
    .map((run) => ({
      leadId: run.leadId,
      companyName: run.companyName,
      plannedAt: run.completedAt,
      planId: run.planId!,
      workflowType: run.workflowType!,
      confidence: run.confidence ?? 0,
      executionReadiness: run.executionReadiness ?? "needs_approval",
      expectedOutcome: run.expectedOutcome ?? "",
      nextBestAction: run.reasoning ?? "",
    }))

  const latestHandoff = input.runs.filter((run) => run.revenueOperatorHandoff).at(-1)?.revenueOperatorHandoff ?? null

  return {
    qaMarker: GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AUTONOMOUS_PLANNING_PILOT_RULE,
    agentKind: GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
    schedulerMode: GROWTH_AUTONOMOUS_PLANNING_PILOT_SCHEDULER_MODE,
    controlState: input.controlState,
    enabled: input.controlState === "active",
    disabledAgentKinds: [...GROWTH_AUTONOMOUS_PLANNING_DISABLED_AGENT_KINDS],
    budgetLimits: GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET,
    telemetry,
    latestPlans,
    recentRuns: [...input.runs].slice(-12).reverse(),
    revenueOperatorSupervision: buildRevenueOperatorPlanningSupervision({
      controlState: input.controlState,
      telemetry,
      latestHandoff,
    }),
    wakeConditionsSupported: GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS,
  }
}

export function buildAutonomousPlanningPilotPlanContext(input: {
  leadId: string
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  controlState: GrowthAutonomousPlanningPilotControlState
  runs: GrowthAutonomousPlanningRunRecord[]
  generatedAt: string
}): GrowthAutonomousPlanningPilotPlanContext {
  const leadRuns = input.runs.filter((run) => run.leadId === input.leadId)
  const lastCompleted = leadRuns.filter((run) => run.outcome === "completed").at(-1) ?? null
  const memory = evaluatePlanningMemoryReadiness(input.snapshot)
  const wakeCondition = evaluatePlanningWakeCondition({
    leadId: input.leadId,
    snapshot: input.snapshot,
    runs: input.runs,
    generatedAt: input.generatedAt,
  })

  let planningStatus: GrowthAutonomousPlanningPilotPlanContext["planningStatus"] = "not_eligible"
  let blockedReason: string | null = memory.blockReason

  if (lastCompleted?.planId) {
    planningStatus = lastCompleted.executionReadiness === "blocked" ? "blocked" : "planned"
  } else if (wakeCondition) {
    planningStatus = "pending"
    blockedReason = null
  } else if (memory.sufficient && input.snapshot?.executionPlan) {
    planningStatus = "planned"
    blockedReason = null
  }

  if (input.controlState !== "active") {
    blockedReason = blockedReason ?? "Planning Agent pilot is not active."
    if (planningStatus === "pending") planningStatus = "not_eligible"
  }

  const requiredApprovals =
    lastCompleted?.requiredApprovals ??
    (input.snapshot?.executionPlan?.approvalRequired ? ["Operator approval required before future execution."] : [])

  return {
    planningAgentOwner: GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT,
    planningStatus,
    lastPlannedAt: lastCompleted?.completedAt ?? input.snapshot?.updatedAt ?? null,
    planId: lastCompleted?.planId ?? null,
    confidence: lastCompleted?.confidence ?? input.snapshot?.qualification?.confidence ?? null,
    executionReadiness:
      lastCompleted?.executionReadiness ?? input.snapshot?.executionPlan?.executionReadiness ?? null,
    prerequisites: lastCompleted?.prerequisites ?? input.snapshot?.executionPlan?.prerequisites ?? [],
    requiredApprovals,
    blockedReason,
    wakeRecommendation: wakeCondition
      ? `Planning Agent would wake for ${wakeCondition.replaceAll("_", " ")} when pilot is active.`
      : blockedReason ?? "No autonomous planning recommended for this lead.",
    revenueOperatorHandoff: lastCompleted?.revenueOperatorHandoff ?? null,
    expectedOutcome: lastCompleted?.expectedOutcome ?? input.snapshot?.executionPlan?.expectedOutcome ?? null,
  }
}

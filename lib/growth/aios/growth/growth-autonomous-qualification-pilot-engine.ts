/** GE-AIOS-GROWTH-5C — Autonomous Qualification Agent Pilot engine (client-safe, deterministic). */

import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  qualifyGrowthLeadResearch,
  type GrowthLeadResearchQualificationOutput,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"
import type {
  GrowthAutonomousQualificationDecisionSummary,
  GrowthAutonomousQualificationPilotControlState,
  GrowthAutonomousQualificationPilotPlanContext,
  GrowthAutonomousQualificationPilotReadModel,
  GrowthAutonomousQualificationPilotTelemetry,
  GrowthAutonomousQualificationRunRecord,
  GrowthAutonomousQualificationWakeCondition,
  GrowthRevenueOperatorQualificationSupervision,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import {
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_RULE,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"

const FRESH_RESEARCH_MS = 7 * 24 * 60 * 60 * 1000
const RECENT_QUALIFICATION_MS = 24 * 60 * 60 * 1000

export const GROWTH_AUTONOMOUS_QUALIFICATION_DISABLED_AGENT_KINDS = [
  "outreach_agent",
  "meeting_agent",
] as const satisfies readonly GrowthAgentKind[]

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isQualificationAgentSchedulerActive(
  controlState: GrowthAutonomousQualificationPilotControlState,
): boolean {
  return controlState === "active"
}

export function evaluateQualificationMemoryReadiness(snapshot: GrowthLeadResearchWorkflowSnapshot | null): {
  sufficient: boolean
  blockReason: string | null
} {
  if (!snapshot || !snapshot.researchRunId) {
    return { sufficient: false, blockReason: "Required research context is missing." }
  }

  if (snapshot.workflowStatus === "failed" || snapshot.workflowStatus === "blocked") {
    return { sufficient: false, blockReason: "Research failed or blocked — qualification not eligible." }
  }

  const evidence = snapshot.evidenceSummary
  if (!evidence?.verifiedEvidence?.length && !snapshot.qualification?.reason) {
    return { sufficient: false, blockReason: "Shared memory completeness insufficient for qualification." }
  }

  return { sufficient: true, blockReason: null }
}

export function buildResearchResultFromWorkflowSnapshot(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot
  companyName: string | null
}): GrowthLeadResearchResult {
  const evidence = input.snapshot.evidenceSummary
  const opp = input.snapshot.opportunityAssessment
  const qualification = input.snapshot.qualification
  const verified = evidence?.verifiedEvidence ?? []
  const painPoints = verified
    .filter((line) => line.toLowerCase().includes("pain"))
    .map((line) => line.replace(/^Pain point:\s*/i, ""))
  const indicators = verified
    .filter((line) => line.toLowerCase().includes("service indicator"))
    .map((line) => line.replace(/^Service indicator:\s*/i, ""))

  return {
    companySummary:
      verified.find((line) => line.startsWith("Company summary:"))?.replace(/^Company summary:\s*/i, "") ??
      qualification?.reason ??
      `Research complete for ${input.companyName ?? input.snapshot.leadId}`,
    websiteSummary: verified.some((line) => line.includes("Website summary")) ? "Captured in research snapshot" : null,
    likelyServiceCategory: "Field service",
    serviceAreaClues: [],
    companySizeEstimate: null,
    equipmentServiceIndicators: indicators.length > 0 ? indicators : ["fleet operations"],
    equipifyPainPoints: painPoints.length > 0 ? painPoints : ["operational efficiency"],
    equipifyFitScore: qualification?.fitScore ?? opp?.fitScore ?? 62,
    outreachAngles: verified.filter((line) => line.toLowerCase().includes("outreach")),
    recommendedNextAction: qualification?.recommendedNextAction ?? "Continue qualification review",
    researchConfidence: qualification?.confidence ?? opp?.confidence ?? 0.65,
    sourceUrls: verified.filter((line) => line.startsWith("Source:")).map((line) => line.replace(/^Source:\s*/i, "")),
    caveats: evidence?.missingEvidence ?? [],
    fitModelVersion: "snapshot-v1",
    decisionMakerCandidates: [],
    estimatedAnnualRevenue: opp?.estimatedRevenueRange ?? null,
    estimatedEmployeeCount: null,
    fleetSizeEstimate: null,
    crmDetected: null,
    fieldServiceStackDetected: null,
  }
}

export function countQualificationRunsInWindow(input: {
  runs: GrowthAutonomousQualificationRunRecord[]
  generatedAt: string
  windowMs: number
  leadId?: string
  outcomes?: GrowthAutonomousQualificationRunRecord["outcome"][]
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

export function isLeadInQualificationFailureCooldown(input: {
  runs: GrowthAutonomousQualificationRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const cooldownMs = GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.cooldownAfterFailureMinutes * 60 * 1000
  const now = Date.parse(input.generatedAt)
  const lastFailed = input.runs
    .filter((run) => run.leadId === input.leadId && run.outcome === "failed")
    .map((run) => parseTime(run.completedAt))
    .sort((a, b) => b - a)[0]

  return lastFailed > 0 && now - lastFailed < cooldownMs
}

export function enforceQualificationAgentBudget(input: {
  runs: GrowthAutonomousQualificationRunRecord[]
  generatedAt: string
  leadId?: string
}): { allowed: boolean; skipReason: string | null } {
  const hourCount = countQualificationRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 60 * 60 * 1000,
  })
  if (hourCount >= GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour) {
    return {
      allowed: false,
      skipReason: `Hourly budget exhausted (${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour}/hr).`,
    }
  }

  const dayCount = countQualificationRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (dayCount >= GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerDay) {
    return {
      allowed: false,
      skipReason: `Daily budget exhausted (${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerDay}/day).`,
    }
  }

  if (input.leadId) {
    const leadRetries = countQualificationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
      leadId: input.leadId,
      outcomes: ["failed", "completed"],
    })
    if (leadRetries >= GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRetriesPerLeadPerDay) {
      return {
        allowed: false,
        skipReason: `Lead retry limit reached (${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRetriesPerLeadPerDay}/day).`,
      }
    }

    if (isLeadInQualificationFailureCooldown({ runs: input.runs, leadId: input.leadId, generatedAt: input.generatedAt })) {
      return {
        allowed: false,
        skipReason: `Cooldown active after failed qualification (${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.cooldownAfterFailureMinutes} min).`,
      }
    }
  }

  return { allowed: true, skipReason: null }
}

export function hasRecentQualificationRun(input: {
  runs: GrowthAutonomousQualificationRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const now = Date.parse(input.generatedAt)
  return input.runs.some(
    (run) =>
      run.leadId === input.leadId &&
      run.outcome === "completed" &&
      now - parseTime(run.completedAt) <= RECENT_QUALIFICATION_MS,
  )
}

export function evaluateQualificationWakeCondition(input: {
  leadId: string
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  runs: GrowthAutonomousQualificationRunRecord[]
  generatedAt: string
  explicitTrigger?: GrowthAutonomousQualificationWakeCondition | null
}): GrowthAutonomousQualificationWakeCondition | null {
  if (input.explicitTrigger) return input.explicitTrigger

  const memory = evaluateQualificationMemoryReadiness(input.snapshot)
  if (!memory.sufficient) return null

  const snapshot = input.snapshot!
  const now = Date.parse(input.generatedAt)
  const updatedAt = parseTime(snapshot.updatedAt)

  if (hasRecentQualificationRun({ runs: input.runs, leadId: input.leadId, generatedAt: input.generatedAt })) {
    return null
  }

  if (snapshot.workflowStatus === "research_complete" && updatedAt > 0 && now - updatedAt <= FRESH_RESEARCH_MS) {
    return "research_completed"
  }

  if (
    (snapshot.workflowStatus === "qualified" || snapshot.workflowStatus === "assessed") &&
    updatedAt > 0 &&
    now - updatedAt > RECENT_QUALIFICATION_MS
  ) {
    return "stale_qualification"
  }

  return null
}

export function selectQualificationWakeCandidates(input: {
  rankedMissions: GrowthMissionAllocationRecommendation[]
}): GrowthMissionAllocationRecommendation[] {
  return input.rankedMissions.filter(
    (row) =>
      (row.missionType === "qualify_lead" || row.missionType === "identify_buying_committee") &&
      row.allocationStatus !== "abandon_recommended" &&
      row.allocationStatus !== "blocked" &&
      row.allocationStatus !== "waiting_for_human",
  )
}

export function isRevenueOperatorHandoffBlocked(input: {
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"]
  blockers: string[]
}): boolean {
  if (input.allocationStatus === "blocked" || input.allocationStatus === "waiting_for_human") {
    return true
  }
  return input.blockers.some((blocker) => /revenue operator|handoff blocked|orchestration blocked/i.test(blocker))
}

export function evaluateAutonomousQualificationDecision(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot
  companyName: string | null
}): {
  qualification: GrowthLeadResearchQualificationOutput
  terminalStatus: "qualified" | "blocked" | "failed"
  buyingSignalScore: number
  recommendedNextStep: string
  revenueOperatorHandoff: string
  reasoning: string
} {
  const researchResult = buildResearchResultFromWorkflowSnapshot({
    snapshot: input.snapshot,
    companyName: input.companyName,
  })
  const qualificationResult = qualifyGrowthLeadResearch({
    result: researchResult,
    researchRunStatus: "succeeded",
  })

  let buyingSignalScore = 0
  let recommendedNextStep = qualificationResult.qualification.recommendedNextAction

  if (qualificationResult.terminalStatus === "qualified") {
    const intelligence = assessGrowthLeadResearchOpportunity({
      result: researchResult,
      qualification: qualificationResult.qualification,
    })
    buyingSignalScore = intelligence.opportunityAssessment.buyingSignalScore
    recommendedNextStep = intelligence.nextBestAction.label
  }

  const revenueOperatorHandoff =
    qualificationResult.terminalStatus === "qualified"
      ? "handoff_to_planning_agent"
      : qualificationResult.terminalStatus === "blocked"
        ? "human_review_required"
        : "continue_research"

  return {
    qualification: qualificationResult.qualification,
    terminalStatus: qualificationResult.terminalStatus,
    buyingSignalScore,
    recommendedNextStep,
    revenueOperatorHandoff,
    reasoning: qualificationResult.qualification.reason,
  }
}

export function buildAutonomousQualificationRunRecord(input: {
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousQualificationWakeCondition
  generatedAt: string
  outcome: GrowthAutonomousQualificationRunRecord["outcome"]
  skipReason?: string | null
  decision?: ReturnType<typeof evaluateAutonomousQualificationDecision> | null
  durationMs?: number
}): GrowthAutonomousQualificationRunRecord {
  const durationMs = input.durationMs ?? 900
  const decision = input.decision

  return {
    runId: `growth-qualification-agent-run:${input.leadId}:${input.generatedAt}`,
    leadId: input.leadId,
    companyName: input.companyName,
    wakeCondition: input.wakeCondition,
    outcome: input.outcome,
    startedAt: input.generatedAt,
    completedAt: new Date(Date.parse(input.generatedAt) + durationMs).toISOString(),
    durationMs,
    qualificationStatus:
      input.outcome === "skipped" ? "skipped" : decision?.terminalStatus ?? (input.outcome === "failed" ? "failed" : null),
    icpFitScore: decision?.qualification.fitScore ?? null,
    buyingSignalScore: decision?.buyingSignalScore ?? null,
    confidence: decision?.qualification.confidence ?? null,
    skipReason: input.skipReason ?? null,
    reasoning: decision?.reasoning ?? null,
    missingEvidence: decision?.qualification.missingEvidence ?? [],
    recommendedNextStep: decision?.recommendedNextStep ?? null,
    revenueOperatorHandoff: decision?.revenueOperatorHandoff ?? null,
  }
}

export function buildAutonomousQualificationTelemetry(input: {
  runs: GrowthAutonomousQualificationRunRecord[]
  generatedAt: string
  eligibleLeads: number
  activeRuns: number
}): GrowthAutonomousQualificationPilotTelemetry {
  const completed = input.runs.filter((run) => run.outcome === "completed")
  const failed = input.runs.filter((run) => run.outcome === "failed")
  const skipped = input.runs.filter((run) => run.outcome === "skipped")
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
    averageDurationMs: avgDuration,
    averageConfidence: avgConfidence,
    budgetConsumptionHour: countQualificationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 60 * 60 * 1000,
    }),
    budgetConsumptionDay: countQualificationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    activeRuns: input.activeRuns,
  }
}

export function buildRevenueOperatorQualificationSupervision(input: {
  controlState: GrowthAutonomousQualificationPilotControlState
  telemetry: GrowthAutonomousQualificationPilotTelemetry
  latestHandoff: string | null
}): GrowthRevenueOperatorQualificationSupervision {
  const budgetNearLimit =
    input.telemetry.budgetConsumptionHour >= GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour - 3

  return {
    approveWakeRecommendation:
      input.controlState === "active"
        ? "Qualification Agent wake approved under controlled_agent_wake — qualify_lead missions only."
        : "Qualification Agent wake blocked — pilot not active.",
    budgetMonitorSummary: `${input.telemetry.budgetConsumptionHour}/${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour} hourly · ${input.telemetry.budgetConsumptionDay}/${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerDay} daily.`,
    failureMonitorSummary:
      input.telemetry.failedRuns > 0
        ? `${input.telemetry.failedRuns} failed runs — review before expanding wake scope.`
        : "No failed autonomous qualification runs recorded.",
    pauseRecommendation:
      budgetNearLimit || input.telemetry.failedRuns >= 3
        ? "Recommend pausing Qualification Agent pilot until budget resets or failures reviewed."
        : null,
    escalationRecommendation:
      input.telemetry.failedRuns >= 5
        ? "Escalate to Revenue Operator — disable pilot and audit wake conditions."
        : null,
    latestHandoffRecommendation: input.latestHandoff,
  }
}

export function applyQualificationPilotControlTransition(input: {
  current: GrowthAutonomousQualificationPilotControlState
  action: "pause" | "resume" | "disable"
}): GrowthAutonomousQualificationPilotControlState {
  if (input.action === "disable") return "disabled"
  if (input.action === "pause") {
    return input.current === "disabled" ? "disabled" : "paused"
  }
  return "active"
}

export function buildAutonomousQualificationPilotReadModel(input: {
  controlState: GrowthAutonomousQualificationPilotControlState
  runs: GrowthAutonomousQualificationRunRecord[]
  generatedAt: string
  eligibleLeads?: number
  activeRuns?: number
}): GrowthAutonomousQualificationPilotReadModel {
  const telemetry = buildAutonomousQualificationTelemetry({
    runs: input.runs,
    generatedAt: input.generatedAt,
    eligibleLeads: input.eligibleLeads ?? 0,
    activeRuns: input.activeRuns ?? 0,
  })

  const latestDecisions: GrowthAutonomousQualificationDecisionSummary[] = input.runs
    .filter((run) => run.outcome === "completed" && run.qualificationStatus && run.qualificationStatus !== "skipped")
    .slice(-8)
    .reverse()
    .map((run) => ({
      leadId: run.leadId,
      companyName: run.companyName,
      qualifiedAt: run.completedAt,
      qualificationStatus: run.qualificationStatus as "qualified" | "blocked" | "failed",
      icpFitScore: run.icpFitScore ?? 0,
      buyingSignalScore: run.buyingSignalScore ?? 0,
      confidence: run.confidence ?? 0,
      reasoning: run.reasoning ?? "",
      recommendedNextStep: run.recommendedNextStep ?? "",
    }))

  const latestHandoff = input.runs.filter((run) => run.revenueOperatorHandoff).at(-1)?.revenueOperatorHandoff ?? null

  return {
    qaMarker: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_RULE,
    agentKind: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
    schedulerMode: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_SCHEDULER_MODE,
    controlState: input.controlState,
    enabled: input.controlState === "active",
    disabledAgentKinds: [...GROWTH_AUTONOMOUS_QUALIFICATION_DISABLED_AGENT_KINDS],
    budgetLimits: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET,
    telemetry,
    latestDecisions,
    recentRuns: [...input.runs].slice(-12).reverse(),
    revenueOperatorSupervision: buildRevenueOperatorQualificationSupervision({
      controlState: input.controlState,
      telemetry,
      latestHandoff,
    }),
    wakeConditionsSupported: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS,
  }
}

export function buildAutonomousQualificationPilotPlanContext(input: {
  leadId: string
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  controlState: GrowthAutonomousQualificationPilotControlState
  runs: GrowthAutonomousQualificationRunRecord[]
  generatedAt: string
}): GrowthAutonomousQualificationPilotPlanContext {
  const leadRuns = input.runs.filter((run) => run.leadId === input.leadId)
  const lastCompleted = leadRuns.filter((run) => run.outcome === "completed").at(-1) ?? null
  const wakeCondition = evaluateQualificationWakeCondition({
    leadId: input.leadId,
    snapshot: input.snapshot,
    runs: input.runs,
    generatedAt: input.generatedAt,
  })
  const memory = evaluateQualificationMemoryReadiness(input.snapshot)

  let qualificationStatus: GrowthAutonomousQualificationPilotPlanContext["qualificationStatus"] = "not_eligible"
  let blockedReason: string | null = memory.blockReason

  if (lastCompleted?.qualificationStatus && lastCompleted.qualificationStatus !== "skipped") {
    qualificationStatus = lastCompleted.qualificationStatus
  } else if (input.snapshot?.workflowStatus === "qualified" || input.snapshot?.workflowStatus === "assessed") {
    qualificationStatus = "qualified"
  } else if (wakeCondition) {
    qualificationStatus = "pending"
    blockedReason = null
  } else if (memory.sufficient) {
    qualificationStatus = "pending"
  }

  if (input.controlState !== "active") {
    blockedReason = blockedReason ?? "Qualification Agent pilot is not active."
    if (qualificationStatus === "pending") qualificationStatus = "not_eligible"
  }

  return {
    qualificationAgentOwner: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT,
    qualificationStatus,
    lastQualifiedAt: lastCompleted?.completedAt ?? input.snapshot?.updatedAt ?? null,
    confidence: lastCompleted?.confidence ?? input.snapshot?.qualification?.confidence ?? null,
    icpFitScore: lastCompleted?.icpFitScore ?? input.snapshot?.qualification?.fitScore ?? null,
    buyingSignalScore: lastCompleted?.buyingSignalScore ?? input.snapshot?.opportunityAssessment?.buyingSignalScore ?? null,
    blockedReason,
    wakeRecommendation: wakeCondition
      ? `Qualification Agent would wake for ${wakeCondition.replaceAll("_", " ")} when pilot is active.`
      : blockedReason ?? "No autonomous qualification recommended for this lead.",
    revenueOperatorHandoff: lastCompleted?.revenueOperatorHandoff ?? null,
  }
}

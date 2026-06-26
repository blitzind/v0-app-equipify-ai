/** GE-AIOS-GROWTH-5B — Autonomous Research Agent Pilot engine (client-safe, deterministic). */

import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type {
  GrowthAutonomousResearchPilotControlState,
  GrowthAutonomousResearchPilotPlanContext,
  GrowthAutonomousResearchPilotReadModel,
  GrowthAutonomousResearchPilotTelemetry,
  GrowthAutonomousResearchRefreshSummary,
  GrowthAutonomousResearchRunRecord,
  GrowthAutonomousResearchWakeCondition,
  GrowthRevenueOperatorResearchSupervision,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import {
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_RULE,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"

const STALE_RESEARCH_MS = 7 * 24 * 60 * 60 * 1000

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isResearchAgentSchedulerActive(
  controlState: GrowthAutonomousResearchPilotControlState,
): boolean {
  return controlState === "active"
}

export function evaluateWakeCondition(input: {
  leadId: string
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  generatedAt: string
  explicitTrigger?: GrowthAutonomousResearchWakeCondition | null
}): GrowthAutonomousResearchWakeCondition | null {
  if (input.explicitTrigger) return input.explicitTrigger

  const now = Date.parse(input.generatedAt)
  const updatedAt = parseTime(input.snapshot?.updatedAt ?? null)

  if (!input.snapshot || input.snapshot.workflowStatus === "not_started") {
    return "newly_discovered_lead"
  }

  if (
    !input.snapshot.researchRunId ||
    input.snapshot.workflowStatus === "failed" ||
    input.snapshot.workflowStatus === "blocked" ||
    (updatedAt > 0 && now - updatedAt > STALE_RESEARCH_MS)
  ) {
    return "stale_research"
  }

  const hourSlot = Math.floor(now / (60 * 60 * 1000))
  const leadHash = [...input.leadId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  if (hourSlot % 24 === leadHash % 24) {
    return "scheduled_research_refresh"
  }

  return null
}

export function countRunsInWindow(input: {
  runs: GrowthAutonomousResearchRunRecord[]
  generatedAt: string
  windowMs: number
}): number {
  const now = Date.parse(input.generatedAt)
  return input.runs.filter((run) => {
    if (run.outcome === "skipped") return false
    const started = Date.parse(run.startedAt)
    return Number.isFinite(started) && now - started <= input.windowMs
  }).length
}

export function enforceResearchAgentBudget(input: {
  runs: GrowthAutonomousResearchRunRecord[]
  generatedAt: string
}): { allowed: boolean; skipReason: string | null } {
  const hourCount = countRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 60 * 60 * 1000,
  })
  if (hourCount >= GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour) {
    return {
      allowed: false,
      skipReason: `Hourly budget exhausted (${GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour}/hr).`,
    }
  }

  const dayCount = countRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (dayCount >= GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerDay) {
    return {
      allowed: false,
      skipReason: `Daily budget exhausted (${GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerDay}/day).`,
    }
  }

  return { allowed: true, skipReason: null }
}

export function buildDeterministicResearchSummary(input: {
  leadId: string
  companyName: string | null
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  generatedAt: string
}): { summary: string; confidence: number } {
  const baseConfidence = input.snapshot?.qualification?.confidence ?? 0.62
  const company = input.companyName ?? input.leadId
  const stamp = input.generatedAt.slice(0, 16).replace("T", " ")
  return {
    summary: `Autonomous research refresh for ${company} at ${stamp} — internal snapshot updated without provider calls.`,
    confidence: Math.min(0.95, Math.round((baseConfidence + 0.05) * 100) / 100),
  }
}

export function buildAutonomousResearchRunRecord(input: {
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousResearchWakeCondition
  generatedAt: string
  outcome: GrowthAutonomousResearchRunRecord["outcome"]
  skipReason?: string | null
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  durationMs?: number
}): GrowthAutonomousResearchRunRecord {
  const durationMs = input.durationMs ?? 1200
  const research = buildDeterministicResearchSummary({
    leadId: input.leadId,
    companyName: input.companyName,
    snapshot: input.snapshot,
    generatedAt: input.generatedAt,
  })

  return {
    runId: `growth-research-agent-run:${input.leadId}:${input.generatedAt}`,
    leadId: input.leadId,
    companyName: input.companyName,
    wakeCondition: input.wakeCondition,
    outcome: input.outcome,
    startedAt: input.generatedAt,
    completedAt: new Date(Date.parse(input.generatedAt) + durationMs).toISOString(),
    durationMs,
    confidence: input.outcome === "completed" ? research.confidence : 0,
    skipReason: input.skipReason ?? null,
    researchSummary: input.outcome === "completed" ? research.summary : null,
  }
}

export function selectResearchWakeCandidates(input: {
  rankedMissions: GrowthMissionAllocationRecommendation[]
}): GrowthMissionAllocationRecommendation[] {
  return input.rankedMissions.filter(
    (row) =>
      (row.missionType === "enrich_account" || row.missionType === "monitor_account") &&
      row.allocationStatus !== "abandon_recommended",
  )
}

export function buildAutonomousResearchTelemetry(input: {
  runs: GrowthAutonomousResearchRunRecord[]
  generatedAt: string
  activeRuns: number
}): GrowthAutonomousResearchPilotTelemetry {
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
          (completed.reduce((sum, run) => sum + run.confidence, 0) / completed.length) * 100,
        ) / 100
      : 0

  return {
    successfulRuns: completed.length,
    failedRuns: failed.length,
    skippedRuns: skipped.length,
    averageDurationMs: avgDuration,
    averageConfidence: avgConfidence,
    budgetConsumptionHour: countRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 60 * 60 * 1000,
    }),
    budgetConsumptionDay: countRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    staleResearchResolved: completed.filter((run) => run.wakeCondition === "stale_research").length,
    activeRuns: input.activeRuns,
  }
}

export function buildRevenueOperatorResearchSupervision(input: {
  controlState: GrowthAutonomousResearchPilotControlState
  telemetry: GrowthAutonomousResearchPilotTelemetry
}): GrowthRevenueOperatorResearchSupervision {
  const budgetNearLimit =
    input.telemetry.budgetConsumptionHour >= GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour - 2

  return {
    approveWakeRecommendation:
      input.controlState === "active"
        ? "Research Agent wake approved under controlled_agent_wake — enrich and monitor missions only."
        : "Research Agent wake blocked — pilot not active.",
    budgetMonitorSummary: `${input.telemetry.budgetConsumptionHour}/${GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour} hourly · ${input.telemetry.budgetConsumptionDay}/${GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerDay} daily.`,
    failureMonitorSummary:
      input.telemetry.failedRuns > 0
        ? `${input.telemetry.failedRuns} failed runs — review before expanding wake scope.`
        : "No failed autonomous research runs recorded.",
    pauseRecommendation:
      budgetNearLimit || input.telemetry.failedRuns >= 3
        ? "Recommend pausing Research Agent pilot until budget resets or failures reviewed."
        : null,
    escalationRecommendation:
      input.telemetry.failedRuns >= 5
        ? "Escalate to Revenue Operator — disable pilot and audit wake conditions."
        : null,
  }
}

export function applyPilotControlTransition(input: {
  current: GrowthAutonomousResearchPilotControlState
  action: "pause" | "resume" | "disable"
}): GrowthAutonomousResearchPilotControlState {
  if (input.action === "disable") return "disabled"
  if (input.action === "pause") {
    return input.current === "disabled" ? "disabled" : "paused"
  }
  return "active"
}

export function buildAutonomousResearchPilotReadModel(input: {
  controlState: GrowthAutonomousResearchPilotControlState
  runs: GrowthAutonomousResearchRunRecord[]
  generatedAt: string
  activeRuns?: number
}): GrowthAutonomousResearchPilotReadModel {
  const telemetry = buildAutonomousResearchTelemetry({
    runs: input.runs,
    generatedAt: input.generatedAt,
    activeRuns: input.activeRuns ?? 0,
  })

  const latestRefreshes: GrowthAutonomousResearchRefreshSummary[] = input.runs
    .filter((run) => run.outcome === "completed" && run.researchSummary)
    .slice(-8)
    .reverse()
    .map((run) => ({
      leadId: run.leadId,
      companyName: run.companyName,
      refreshedAt: run.completedAt,
      confidence: run.confidence,
      summary: run.researchSummary ?? "",
      staleResolved: run.wakeCondition === "stale_research",
    }))

  return {
    qaMarker: GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AUTONOMOUS_RESEARCH_PILOT_RULE,
    agentKind: GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT,
    schedulerMode: GROWTH_AUTONOMOUS_RESEARCH_PILOT_SCHEDULER_MODE,
    controlState: input.controlState,
    enabled: input.controlState === "active",
    otherAgentsDisabled: true,
    budgetLimits: GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET,
    telemetry,
    latestRefreshes,
    recentRuns: [...input.runs].slice(-12).reverse(),
    revenueOperatorSupervision: buildRevenueOperatorResearchSupervision({
      controlState: input.controlState,
      telemetry,
    }),
    wakeConditionsSupported: GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS,
  }
}

export function buildAutonomousResearchPilotPlanContext(input: {
  leadId: string
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  controlState: GrowthAutonomousResearchPilotControlState
  runs: GrowthAutonomousResearchRunRecord[]
  generatedAt: string
}): GrowthAutonomousResearchPilotPlanContext | null {
  const leadRuns = input.runs.filter((run) => run.leadId === input.leadId)
  const lastCompleted = leadRuns.filter((run) => run.outcome === "completed").at(-1) ?? null
  const wakeCondition = evaluateWakeCondition({
    leadId: input.leadId,
    snapshot: input.snapshot,
    generatedAt: input.generatedAt,
  })

  const updatedAt = parseTime(input.snapshot?.updatedAt ?? null)
  const now = Date.parse(input.generatedAt)
  const staleStatus: GrowthAutonomousResearchPilotPlanContext["staleStatus"] =
    !input.snapshot
      ? "unknown"
      : updatedAt > 0 && now - updatedAt > STALE_RESEARCH_MS
        ? "stale"
        : "fresh"

  const hourSlot = Math.floor(now / (60 * 60 * 1000)) + 1
  const leadHash = [...input.leadId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const nextHour = new Date((hourSlot + (leadHash % 6)) * 60 * 60 * 1000).toISOString()

  return {
    autonomousResearchStatus: input.controlState,
    lastRefreshAt: lastCompleted?.completedAt ?? input.snapshot?.updatedAt ?? null,
    staleStatus,
    confidence: lastCompleted?.confidence ?? input.snapshot?.qualification?.confidence ?? null,
    nextScheduledRefresh: wakeCondition === "scheduled_research_refresh" ? input.generatedAt : nextHour,
    wakeRecommendation: wakeCondition
      ? `Research Agent would wake for ${wakeCondition.replaceAll("_", " ")} when pilot is active.`
      : "No autonomous wake recommended for this lead.",
  }
}

/** GE-AIOS-GROWTH-5E — Autonomous Execution Agent Pilot engine (client-safe, deterministic). */

import type { GrowthLeadResearchExecutionDryRunStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type { GrowthLeadResearchExecutionRuntimePilotPlanItem } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import { isRuntimePilotWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import type { GrowthLeadResearchFutureExecutionHandoffState } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type { GrowthLeadResearchExecutionPreflightStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import type { GrowthLeadResearchExecutionState } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type {
  AiOsOperationsExecutionAgentStatus,
  GrowthAutonomousExecutionDecisionSummary,
  GrowthAutonomousExecutionPilotControlState,
  GrowthAutonomousExecutionPilotPlanContext,
  GrowthAutonomousExecutionPilotReadModel,
  GrowthAutonomousExecutionPilotTelemetry,
  GrowthAutonomousExecutionRunRecord,
  GrowthAutonomousExecutionWakeCondition,
  GrowthRevenueOperatorExecutionSupervision,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import {
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_RULE,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"

const RECENT_EXECUTION_MS = 24 * 60 * 60 * 1000

export const GROWTH_AUTONOMOUS_EXECUTION_DISABLED_AGENT_KINDS = [
  "outreach_agent",
  "meeting_agent",
] as const satisfies readonly GrowthAgentKind[]

export const GROWTH_AUTONOMOUS_EXECUTION_OUTBOUND_WORKFLOWS = [
  "outreach_generation",
  "verify_email",
  "buying_committee",
  "meeting_preparation",
  "approval",
  "close",
  "monitoring",
] as const

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isExecutionAgentSchedulerActive(
  controlState: GrowthAutonomousExecutionPilotControlState,
): boolean {
  return controlState === "active"
}

export function isAutonomousExecutionWorkflowAllowed(workflowType: string): boolean {
  return workflowType === GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW
}

export function isOutboundWorkflowBlocked(workflowType: string): boolean {
  return (
    GROWTH_AUTONOMOUS_EXECUTION_OUTBOUND_WORKFLOWS.includes(
      workflowType as (typeof GROWTH_AUTONOMOUS_EXECUTION_OUTBOUND_WORKFLOWS)[number],
    ) || !isAutonomousExecutionWorkflowAllowed(workflowType)
  )
}

export function evaluateExecutionGateReadiness(input: {
  workflowType: string
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
  handoffState: GrowthLeadResearchFutureExecutionHandoffState
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus
  dryRunStatus: GrowthLeadResearchExecutionDryRunStatus | null
  enqueueAllowed: boolean
  blockReason: string | null
}): { eligible: boolean; blockReason: string | null } {
  if (isOutboundWorkflowBlocked(input.workflowType)) {
    return {
      eligible: false,
      blockReason: `Workflow ${input.workflowType} is not allowlisted for autonomous internal execution.`,
    }
  }

  if (input.approvalState !== "approved_for_future_execution") {
    return { eligible: false, blockReason: "Execution plan approval missing." }
  }

  if (input.readinessState !== "ready_for_future_execution") {
    return { eligible: false, blockReason: "Plan readiness is not ready_for_future_execution." }
  }

  if (input.handoffState !== "handoff_ready") {
    return { eligible: false, blockReason: "Future execution handoff is not handoff_ready." }
  }

  if (input.preflightStatus !== "preflight_passed") {
    return { eligible: false, blockReason: "Preflight checklist has not passed." }
  }

  if (input.dryRunStatus !== "dry_run_passed") {
    return {
      eligible: false,
      blockReason:
        input.dryRunStatus == null
          ? "Dry-run required before autonomous execution enqueue."
          : "Dry-run has not passed.",
    }
  }

  if (!input.enqueueAllowed) {
    return { eligible: false, blockReason: input.blockReason ?? "Runtime enqueue blocked by gate validation." }
  }

  return { eligible: true, blockReason: null }
}

export function countExecutionRunsInWindow(input: {
  runs: GrowthAutonomousExecutionRunRecord[]
  generatedAt: string
  windowMs: number
  planId?: string
  outcomes?: GrowthAutonomousExecutionRunRecord["outcome"][]
}): number {
  const now = Date.parse(input.generatedAt)
  return input.runs.filter((run) => {
    if (input.planId && run.planId !== input.planId) return false
    if (input.outcomes && !input.outcomes.includes(run.outcome)) return false
    if (run.outcome === "skipped") return false
    const started = Date.parse(run.startedAt)
    return Number.isFinite(started) && now - started <= input.windowMs
  }).length
}

export function isPlanInExecutionFailureCooldown(input: {
  runs: GrowthAutonomousExecutionRunRecord[]
  planId: string
  generatedAt: string
}): boolean {
  const cooldownMs = GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.cooldownAfterFailureMinutes * 60 * 1000
  const now = Date.parse(input.generatedAt)
  const lastFailed = input.runs
    .filter((run) => run.planId === input.planId && run.outcome === "failed")
    .map((run) => parseTime(run.completedAt))
    .sort((a, b) => b - a)[0]

  return lastFailed > 0 && now - lastFailed < cooldownMs
}

export function enforceExecutionAgentBudget(input: {
  runs: GrowthAutonomousExecutionRunRecord[]
  generatedAt: string
  planId?: string
}): { allowed: boolean; skipReason: string | null } {
  const hourCount = countExecutionRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 60 * 60 * 1000,
  })
  if (hourCount >= GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour) {
    return {
      allowed: false,
      skipReason: `Hourly budget exhausted (${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour}/hr).`,
    }
  }

  const dayCount = countExecutionRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (dayCount >= GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerDay) {
    return {
      allowed: false,
      skipReason: `Daily budget exhausted (${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerDay}/day).`,
    }
  }

  if (input.planId) {
    const planRetries = countExecutionRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
      planId: input.planId,
      outcomes: ["failed", "completed"],
    })
    if (planRetries >= GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRetriesPerPlanPerDay) {
      return {
        allowed: false,
        skipReason: `Plan retry limit reached (${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRetriesPerPlanPerDay}/day).`,
      }
    }

    if (isPlanInExecutionFailureCooldown({ runs: input.runs, planId: input.planId, generatedAt: input.generatedAt })) {
      return {
        allowed: false,
        skipReason: `Cooldown active after failed execution (${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.cooldownAfterFailureMinutes} min).`,
      }
    }
  }

  return { allowed: true, skipReason: null }
}

export function hasRecentSuccessfulExecution(input: {
  runs: GrowthAutonomousExecutionRunRecord[]
  planId: string
  generatedAt: string
}): boolean {
  const now = Date.parse(input.generatedAt)
  return input.runs.some(
    (run) =>
      run.planId === input.planId &&
      run.outcome === "completed" &&
      now - parseTime(run.completedAt) <= RECENT_EXECUTION_MS,
  )
}

export function evaluateExecutionWakeCondition(input: {
  planId: string
  leadId: string
  runs: GrowthAutonomousExecutionRunRecord[]
  generatedAt: string
  explicitTrigger?: GrowthAutonomousExecutionWakeCondition | null
  gateReadiness: ReturnType<typeof evaluateExecutionGateReadiness>
}): GrowthAutonomousExecutionWakeCondition | null {
  if (input.explicitTrigger) return input.explicitTrigger
  if (!input.gateReadiness.eligible) return null
  if (hasRecentSuccessfulExecution({ runs: input.runs, planId: input.planId, generatedAt: input.generatedAt })) {
    return null
  }

  const lastFailed = input.runs
    .filter((run) => run.planId === input.planId && run.outcome === "failed")
    .at(-1)

  if (lastFailed) {
    return "stale_runtime_retry"
  }

  return "execution_plan_ready"
}

export function selectExecutionWakeCandidates(input: {
  pilotEligiblePlans: GrowthLeadResearchExecutionRuntimePilotPlanItem[]
  rankedMissions: GrowthMissionAllocationRecommendation[]
}): GrowthLeadResearchExecutionRuntimePilotPlanItem[] {
  const prioritizedLeadIds = new Set(
    input.rankedMissions
      .filter(
        (row) =>
          row.missionType === "recover_failed_workflow" ||
          row.missionType === "prepare_outreach" ||
          row.allocationStatus === "allocated",
      )
      .map((row) => row.leadId),
  )

  return input.pilotEligiblePlans.filter(
    (plan) =>
      isRuntimePilotWorkflow(plan.workflowType) &&
      plan.enqueueAllowed &&
      (prioritizedLeadIds.size === 0 || prioritizedLeadIds.has(plan.leadId)),
  )
}

export function isRevenueOperatorExecutionBlocked(input: {
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"]
  blockers: string[]
}): boolean {
  if (input.allocationStatus === "blocked" || input.allocationStatus === "waiting_for_human") {
    return true
  }
  return input.blockers.some((blocker) =>
    /revenue operator|execution blocked|orchestration blocked|handoff blocked/i.test(blocker),
  )
}

export function buildAutonomousExecutionRunRecord(input: {
  leadId: string
  companyName: string | null
  planId: string
  wakeCondition: GrowthAutonomousExecutionWakeCondition
  generatedAt: string
  outcome: GrowthAutonomousExecutionRunRecord["outcome"]
  skipReason?: string | null
  blockReason?: string | null
  executionId?: string | null
  workflowType?: string | null
  runtimeState?: GrowthLeadResearchExecutionState | null
  dryRunStatus?: GrowthLeadResearchExecutionDryRunStatus | null
  revenueOperatorHandoff?: string | null
  durationMs?: number
}): GrowthAutonomousExecutionRunRecord {
  const durationMs = input.durationMs ?? 1400

  return {
    runId: `growth-execution-agent-run:${input.planId}:${input.generatedAt}`,
    leadId: input.leadId,
    companyName: input.companyName,
    planId: input.planId,
    wakeCondition: input.wakeCondition,
    outcome: input.outcome,
    startedAt: input.generatedAt,
    completedAt: new Date(Date.parse(input.generatedAt) + durationMs).toISOString(),
    durationMs,
    executionId: input.executionId ?? null,
    workflowType: input.workflowType ?? null,
    runtimeState: input.runtimeState ?? null,
    skipReason: input.skipReason ?? null,
    blockReason: input.blockReason ?? null,
    dryRunStatus: input.dryRunStatus ?? null,
    revenueOperatorHandoff: input.revenueOperatorHandoff ?? null,
  }
}

export function buildAutonomousExecutionTelemetry(input: {
  runs: GrowthAutonomousExecutionRunRecord[]
  generatedAt: string
  eligiblePlans: number
  queuedExecutions: number
  activeExecutions: number
  activeRuns: number
}): GrowthAutonomousExecutionPilotTelemetry {
  const completed = input.runs.filter((run) => run.outcome === "completed")
  const failed = input.runs.filter((run) => run.outcome === "failed")
  const skipped = input.runs.filter((run) => run.outcome === "skipped")
  const blocked = skipped.filter((run) => Boolean(run.blockReason || run.skipReason?.includes("blocked")))

  return {
    successfulRuns: completed.length,
    failedRuns: failed.length,
    skippedRuns: skipped.length,
    eligiblePlans: input.eligiblePlans,
    queuedExecutions: input.queuedExecutions,
    activeExecutions: input.activeExecutions,
    completedExecutions: completed.length,
    failedExecutions: failed.length,
    blockedExecutions: blocked.length,
    budgetConsumptionHour: countExecutionRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 60 * 60 * 1000,
    }),
    budgetConsumptionDay: countExecutionRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    activeRuns: input.activeRuns,
  }
}

export function buildRevenueOperatorExecutionSupervision(input: {
  controlState: GrowthAutonomousExecutionPilotControlState
  telemetry: GrowthAutonomousExecutionPilotTelemetry
  latestOutcome: string | null
}): GrowthRevenueOperatorExecutionSupervision {
  const budgetNearLimit =
    input.telemetry.budgetConsumptionHour >= GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour - 1

  return {
    approveWakeRecommendation:
      input.controlState === "active"
        ? "Execution Agent wake approved for research_company internal runtime only."
        : "Execution Agent wake blocked — pilot not active.",
    budgetMonitorSummary: `${input.telemetry.budgetConsumptionHour}/${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour} hourly · ${input.telemetry.budgetConsumptionDay}/${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerDay} daily.`,
    failureMonitorSummary:
      input.telemetry.failedRuns > 0
        ? `${input.telemetry.failedRuns} failed execution runs — review before expanding scope.`
        : "No failed autonomous execution runs recorded.",
    pauseRecommendation:
      budgetNearLimit || input.telemetry.failedRuns >= 2
        ? "Recommend pausing Execution Agent pilot until budget resets or failures reviewed."
        : null,
    escalationRecommendation:
      input.telemetry.failedRuns >= 4
        ? "Escalate to Revenue Operator — disable pilot and audit runtime gates."
        : null,
    latestOutcomeRecommendation: input.latestOutcome,
  }
}

export function applyExecutionPilotControlTransition(input: {
  current: GrowthAutonomousExecutionPilotControlState
  action: "pause" | "resume" | "disable"
}): GrowthAutonomousExecutionPilotControlState {
  if (input.action === "disable") return "disabled"
  if (input.action === "pause") {
    return input.current === "disabled" ? "disabled" : "paused"
  }
  return "active"
}

export function buildAutonomousExecutionPilotReadModel(input: {
  controlState: GrowthAutonomousExecutionPilotControlState
  runs: GrowthAutonomousExecutionRunRecord[]
  generatedAt: string
  eligiblePlans?: number
  queuedExecutions?: number
  activeExecutions?: number
  activeRuns?: number
}): GrowthAutonomousExecutionPilotReadModel {
  const telemetry = buildAutonomousExecutionTelemetry({
    runs: input.runs,
    generatedAt: input.generatedAt,
    eligiblePlans: input.eligiblePlans ?? 0,
    queuedExecutions: input.queuedExecutions ?? 0,
    activeExecutions: input.activeExecutions ?? 0,
    activeRuns: input.activeRuns ?? 0,
  })

  const latestExecutions: GrowthAutonomousExecutionDecisionSummary[] = input.runs
    .filter((run) => run.outcome === "completed" || run.outcome === "failed")
    .slice(-8)
    .reverse()
    .map((run) => ({
      leadId: run.leadId,
      companyName: run.companyName,
      planId: run.planId,
      executedAt: run.completedAt,
      executionId: run.executionId,
      workflowType: run.workflowType ?? GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW,
      runtimeState: run.runtimeState,
      outcome: run.outcome,
    }))

  const latestOutcome = input.runs.filter((run) => run.revenueOperatorHandoff).at(-1)?.revenueOperatorHandoff ?? null

  return {
    qaMarker: GROWTH_AUTONOMOUS_EXECUTION_PILOT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AUTONOMOUS_EXECUTION_PILOT_RULE,
    agentKind: GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
    schedulerMode: GROWTH_AUTONOMOUS_EXECUTION_PILOT_SCHEDULER_MODE,
    controlState: input.controlState,
    enabled: input.controlState === "active",
    allowedWorkflow: GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW,
    disabledAgentKinds: [...GROWTH_AUTONOMOUS_EXECUTION_DISABLED_AGENT_KINDS],
    budgetLimits: GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET,
    telemetry,
    latestExecutions,
    recentRuns: [...input.runs].slice(-12).reverse(),
    revenueOperatorSupervision: buildRevenueOperatorExecutionSupervision({
      controlState: input.controlState,
      telemetry,
      latestOutcome,
    }),
    wakeConditionsSupported: GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS,
  }
}

export function buildAutonomousExecutionPilotPlanContext(input: {
  planId: string
  leadId: string
  executionPlan: GrowthLeadResearchExecutionPlan | null
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus | null
  readinessState: GrowthLeadResearchApprovedPlanReadinessState | null
  handoffState: GrowthLeadResearchFutureExecutionHandoffState | null
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus | null
  dryRunStatus: GrowthLeadResearchExecutionDryRunStatus | null
  enqueueAllowed: boolean
  blockReason: string | null
  controlState: GrowthAutonomousExecutionPilotControlState
  runs: GrowthAutonomousExecutionRunRecord[]
  runtimeState: GrowthLeadResearchExecutionState | null
  generatedAt: string
}): GrowthAutonomousExecutionPilotPlanContext {
  const leadRuns = input.runs.filter((run) => run.leadId === input.leadId)
  const lastRun = leadRuns.at(-1) ?? null
  const workflowType = input.executionPlan?.workflowType ?? null

  const gateReadiness = evaluateExecutionGateReadiness({
    workflowType: workflowType ?? "unknown",
    approvalState: input.approvalState ?? "pending_review",
    readinessState: input.readinessState ?? "not_ready",
    handoffState: input.handoffState ?? "handoff_blocked",
    preflightStatus: input.preflightStatus ?? "preflight_not_allowed",
    dryRunStatus: input.dryRunStatus,
    enqueueAllowed: input.enqueueAllowed,
    blockReason: input.blockReason,
  })

  const wakeCondition = evaluateExecutionWakeCondition({
    planId: input.planId,
    leadId: input.leadId,
    runs: input.runs,
    generatedAt: input.generatedAt,
    gateReadiness,
  })

  let blockedReason = gateReadiness.blockReason
  if (input.controlState !== "active") {
    blockedReason = blockedReason ?? "Execution Agent pilot is not active."
  }

  return {
    executionAgentOwner: GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT,
    executionEligible: gateReadiness.eligible && input.controlState === "active",
    dryRunRequired: true,
    dryRunStatus: input.dryRunStatus,
    runtimeState: input.runtimeState ?? lastRun?.runtimeState ?? null,
    latestExecutionId: lastRun?.executionId ?? null,
    latestExecutionResult: lastRun?.outcome ?? null,
    blockedReason,
    wakeRecommendation: wakeCondition
      ? `Execution Agent would wake for ${wakeCondition.replaceAll("_", " ")} when pilot is active.`
      : blockedReason ?? "No autonomous execution recommended for this plan.",
    revenueOperatorHandoff: lastRun?.revenueOperatorHandoff ?? null,
    workflowType,
  }
}

export function buildOperationsExecutionAgentStatus(input: {
  pilot: GrowthAutonomousExecutionPilotReadModel
  configureHref: string
}): AiOsOperationsExecutionAgentStatus {
  const { telemetry } = input.pilot
  const latestRun = input.pilot.recentRuns[0] ?? null

  return {
    enabled: input.pilot.enabled,
    controlState: input.pilot.controlState,
    eligiblePlans: telemetry.eligiblePlans,
    queuedExecutions: telemetry.queuedExecutions,
    activeExecutions: telemetry.activeExecutions,
    completedExecutions: telemetry.completedExecutions,
    failedExecutions: telemetry.failedExecutions,
    blockedExecutions: telemetry.blockedExecutions,
    budgetLabel: `${telemetry.budgetConsumptionHour}/${input.pilot.budgetLimits.maxRunsPerHour} hr · ${telemetry.budgetConsumptionDay}/${input.pilot.budgetLimits.maxRunsPerDay} day`,
    latestEventSummary: latestRun
      ? `${latestRun.outcome} · ${latestRun.workflowType ?? "research_company"} · ${latestRun.companyName ?? latestRun.leadId}`
      : null,
    configureHref: input.configureHref,
  }
}

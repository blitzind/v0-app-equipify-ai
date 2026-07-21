/**
 * GE-AIOS-LAUNCH-1B — Runtime trust presenter (client-safe).
 * Wires existing production signals only — no simulated activity.
 */

import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import {
  GROWTH_AVA_ACTIVATION_CTA,
  type GrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import {
  buildOperatorCanCloseBrowserLine,
  buildOperatorWhatHappensNextLines,
  resolvePrimaryOperatorCompanyName,
} from "@/lib/growth/home/growth-home-operator-closure-1a"
import {
  GROWTH_HOME_RECENT_AUTONOMOUS_ACTIVITY_MS,
  GROWTH_HOME_STALE_AUTONOMOUS_ACTIVITY_MS,
} from "@/lib/growth/specialists/execution/growth-runtime-throughput-1a"
import { humanizeOperatorFacingCopy } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import {
  GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
  type GrowthHomeCanonicalRuntimeActivitySource,
  type GrowthHomeRuntimeTrustActivityEntry,
  type GrowthHomeRuntimeTrustCurrentActivity,
  type GrowthHomeRuntimeTrustHeartbeatLine,
  type GrowthHomeRuntimeTrustOperatorState,
  type GrowthHomeRuntimeTrustPipelineStep,
  type GrowthHomeRuntimeTrustServerPayload,
  type GrowthHomeRuntimeTrustStartStatus,
  type GrowthHomeRuntimeTrustViewModel,
} from "@/lib/growth/home/growth-home-runtime-trust-types-1b"

const STATE_LABELS: Record<GrowthHomeRuntimeTrustOperatorState, string> = {
  working: "Working",
  waiting: "Waiting",
  scheduled: "Scheduled",
  idle: "Idle",
  blocked: "Blocked",
  stale: "Stale telemetry",
}

const STATE_EMOJI: Record<GrowthHomeRuntimeTrustOperatorState, string> = {
  working: "🟢",
  waiting: "🟡",
  scheduled: "🔵",
  idle: "⚪",
  blocked: "🔴",
  stale: "🟠",
}

function formatClockTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function formatRelativeAgo(iso: string, nowMs: number): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso
  const deltaSec = Math.max(0, Math.round((nowMs - parsed) / 1000))
  if (deltaSec < 60) return `${deltaSec} second${deltaSec === 1 ? "" : "s"} ago`
  const deltaMin = Math.round(deltaSec / 60)
  if (deltaMin < 60) return `${deltaMin} minute${deltaMin === 1 ? "" : "s"} ago`
  const deltaHr = Math.round(deltaMin / 60)
  if (deltaHr < 48) return `${deltaHr} hour${deltaHr === 1 ? "" : "s"} ago`
  const deltaDay = Math.round(deltaHr / 24)
  return `${deltaDay} day${deltaDay === 1 ? "" : "s"} ago`
}

function formatRelativeUntil(iso: string, nowMs: number): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso
  const deltaMin = Math.max(1, Math.round((parsed - nowMs) / 60000))
  if (deltaMin < 60) return `~${deltaMin} minute${deltaMin === 1 ? "" : "s"}`
  const deltaHr = Math.round(deltaMin / 60)
  return `~${deltaHr} hour${deltaHr === 1 ? "" : "s"}`
}

function humanizeStopReason(code: string | null | undefined): string | null {
  if (!code) return null
  switch (code) {
    case "autonomy_disabled":
      return "Autonomous work is paused. Enable Autonomous Mode to let me continue in the background."
    case "objective_mode_disabled":
      return "Mission scheduling is paused. Objective mode must be enabled for autonomous discovery and research."
    case "no_executable_work":
      return "I'm waiting for the next company to enter my work queue."
    case "operator_required":
    case "operator_approval_required":
      return "I'm waiting for your approval before I can continue."
    case "daily_budget_exhausted":
      return "I've reached today's autonomous work budget and will resume on the next scheduled cycle."
    case "autonomy_daily_budget_exceeded":
    case "autonomy_daily_budget_disabled":
      return "Today's research budget is full — I'll continue on the next scheduled cycle."
    case "hard_terminal_invalid":
    case "execution_authority_blocked:hard_terminal_invalid":
      return "This company didn't pass qualification — Ava won't advance it further."
    case "portfolio_healthy":
      return "Your pipeline is at target capacity — I'm monitoring for new opportunities."
    case "datamoon_dry_run_only":
      return "Company discovery is in observe-only mode until live discovery is enabled."
    case "datamoon_not_configured":
      return "Company discovery isn't configured yet — finish your Growth Profile and lead source setup."
    default:
      return humanizeOperatorFacingCopy(code.replace(/_/g, " "))
  }
}

function mapOutcomeToActivity(outcome: GrowthHomeSalesOutcomesPayload["outcomes"][number]): string {
  const company = outcome.summary.trim() || "Account"
  switch (outcome.outcome_type) {
    case "research_completed":
      return `Finished researching ${company}`
    case "qualification_completed":
      return `Qualified ${company}`
    case "outreach_prepared":
      return `Prepared outreach package for ${company}`
    case "approval_pending":
      return `Package ready for your review — ${company}`
    case "meeting_prepared":
      return `Prepared meeting materials for ${company}`
    default:
      return company
  }
}

function buildPipelineSteps(activeWork: AvaWorkItem | null): GrowthHomeRuntimeTrustPipelineStep[] {
  const type = activeWork?.type ?? null
  const stepOrder = [
    { id: "discovery", label: "Discovery", types: ["mission"] as AvaWorkItem["type"][] },
    { id: "research", label: "Research", types: ["research"] },
    { id: "qualification", label: "Qualification", types: ["qualification"] },
    { id: "decision_maker", label: "Decision maker", types: [] as AvaWorkItem["type"][] },
    { id: "buying_committee", label: "Buying committee", types: [] as AvaWorkItem["type"][] },
    { id: "package", label: "Package", types: ["outreach", "approval"] },
    { id: "operator_review", label: "Operator review", types: [] as AvaWorkItem["type"][] },
  ]

  let activeIndex = -1
  if (type === "research") activeIndex = 1
  else if (type === "qualification") activeIndex = 2
  else if (type === "outreach" || type === "approval") activeIndex = 5
  else if (type === "mission") activeIndex = 0
  else if (type === "reply" || type === "meeting") activeIndex = 6

  return stepOrder.map((step, index) => ({
    id: step.id,
    label: step.label,
    complete: activeIndex >= 0 && index < activeIndex,
    active: index === activeIndex,
  }))
}

function describeCurrentStep(activeWork: AvaWorkItem | null): string | null {
  if (!activeWork) return null
  const company = activeWork.company_name?.trim()
  switch (activeWork.type) {
    case "research":
      return company ? `Researching ${company}` : "Researching company"
    case "qualification":
      return company ? `Qualifying ${company}` : "Qualifying company"
    case "outreach":
      return company ? `Preparing outreach for ${company}` : "Preparing outreach"
    case "approval":
      return company ? `Preparing package for ${company}` : "Preparing outreach package"
    case "reply":
      return company ? `Following up with ${company}` : "Following up"
    case "meeting":
      return company ? `Preparing for meeting with ${company}` : "Preparing for meeting"
    case "mission":
      return humanizeOperatorFacingCopy(activeWork.title)
    default:
      return humanizeOperatorFacingCopy(activeWork.title)
  }
}

function buildCurrentActivity(
  activeWork: AvaWorkItem | null,
  canonicalClaim: {
    companyName: string | null
    claimedAt: string
  } | null,
): GrowthHomeRuntimeTrustCurrentActivity | null {
  if (!activeWork && !canonicalClaim) return null

  const startedAt =
    canonicalClaim?.claimedAt ?? activeWork?.updated_at ?? activeWork?.created_at ?? null
  const companyName = canonicalClaim?.companyName ?? activeWork?.company_name?.trim() ?? null

  return {
    companyName,
    taskLabel: activeWork ? describeCurrentStep(activeWork) : companyName ? `Researching ${companyName}` : null,
    currentStepLabel: activeWork ? describeCurrentStep(activeWork) : companyName ? `Researching ${companyName}` : null,
    startedAt,
    startedLabel: startedAt ? formatClockTime(startedAt) : null,
    expectedCompletionMinutes: activeWork?.estimated_minutes ?? null,
    expectedCompletionLabel:
      activeWork?.estimated_minutes != null && activeWork.estimated_minutes > 0
        ? `~${activeWork.estimated_minutes} minute${activeWork.estimated_minutes === 1 ? "" : "s"}`
        : null,
    pipelineSteps: buildPipelineSteps(activeWork),
  }
}

function resolveLastAutonomousActivity(input: {
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null | undefined
  server: GrowthHomeRuntimeTrustServerPayload | null | undefined
}): {
  occurredAt: string | null
  label: string | null
  source: GrowthHomeCanonicalRuntimeActivitySource | "sales_outcome" | "scheduler_fallback" | null
} {
  const feed = buildActivityFeed(input.salesOutcomes)
  const feedLatest = feed[0]
  const canonical = input.server?.canonicalActivity?.lastMeaningfulActivity ?? null

  const candidates: Array<{
    occurredAt: string
    label: string
    source: GrowthHomeCanonicalRuntimeActivitySource | "sales_outcome" | "scheduler_fallback"
  }> = []

  if (canonical) {
    candidates.push({
      occurredAt: canonical.occurredAt,
      label: canonical.label,
      source: canonical.source,
    })
  }
  if (feedLatest) {
    candidates.push({
      occurredAt: feedLatest.occurredAt,
      label: feedLatest.summary,
      source: "sales_outcome",
    })
  }
  if (input.server?.lastSchedulerRunAt) {
    candidates.push({
      occurredAt: input.server.lastSchedulerRunAt,
      label: "Scheduler cycle completed",
      source: "scheduler_fallback",
    })
  }

  const winner =
    candidates.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0] ?? null

  return {
    occurredAt: winner?.occurredAt ?? null,
    label: winner?.label ?? null,
    source: winner?.source ?? null,
  }
}

function buildActivityFeed(
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null | undefined,
): GrowthHomeRuntimeTrustActivityEntry[] {
  const outcomes = salesOutcomes?.outcomes ?? []
  if (outcomes.length === 0) return []

  return [...outcomes]
    .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
    .slice(0, 12)
    .map((outcome) => ({
      id: `${outcome.outcome_type}:${outcome.completed_at}:${outcome.summary}`,
      timeLabel: formatClockTime(outcome.completed_at),
      summary: mapOutcomeToActivity(outcome),
      occurredAt: outcome.completed_at,
    }))
}

function resolveOperatorState(input: {
  autonomyEnabled: boolean
  pendingApprovals: number
  activeWork: AvaWorkItem | null
  recentActivityAt: string | null
  stopReason: string | null
  setupIncomplete: boolean
  nowMs: number
  hasActiveCanonicalClaim: boolean
  lastActivitySource: GrowthHomeCanonicalRuntimeActivitySource | "sales_outcome" | "scheduler_fallback" | null
}): GrowthHomeRuntimeTrustOperatorState {
  if (!input.autonomyEnabled && input.setupIncomplete) return "blocked"
  if (!input.autonomyEnabled) return "idle"
  if (input.pendingApprovals > 0) return "waiting"
  if (input.stopReason === "operator_required" || input.stopReason === "operator_approval_required") {
    return "waiting"
  }

  const activityAgeMs = input.recentActivityAt
    ? input.nowMs - Date.parse(input.recentActivityAt)
    : Number.POSITIVE_INFINITY
  const hasRecentActivity = activityAgeMs < GROWTH_HOME_RECENT_AUTONOMOUS_ACTIVITY_MS
  const hasStaleActivity =
    Number.isFinite(activityAgeMs) && activityAgeMs >= GROWTH_HOME_STALE_AUTONOMOUS_ACTIVITY_MS

  if (input.hasActiveCanonicalClaim && activityAgeMs < GROWTH_HOME_STALE_AUTONOMOUS_ACTIVITY_MS) {
    return "working"
  }

  if (input.activeWork?.status === "working" && hasRecentActivity) {
    return "working"
  }

  if (
    (input.activeWork?.status === "working" || input.hasActiveCanonicalClaim) &&
    hasStaleActivity &&
    input.lastActivitySource !== "scheduler_fallback"
  ) {
    return "stale"
  }

  if (hasRecentActivity && input.lastActivitySource !== "scheduler_fallback") {
    return "working"
  }

  if (input.stopReason && input.stopReason !== "no_executable_work" && input.stopReason !== "portfolio_healthy") {
    return "blocked"
  }
  if (input.autonomyEnabled && !input.activeWork && !input.recentActivityAt) return "scheduled"
  if (input.autonomyEnabled && hasStaleActivity) return "scheduled"
  if (input.activeWork && hasRecentActivity) return "working"
  return "idle"
}

function resolveNextMilestoneLabel(activeWork: AvaWorkItem | null): string | null {
  const steps = buildPipelineSteps(activeWork)
  const activeIndex = steps.findIndex((step) => step.active)
  if (activeIndex >= 0 && activeIndex + 1 < steps.length) {
    return steps[activeIndex + 1]?.label ?? null
  }
  return null
}

function buildEmployeePresenceLine(input: {
  operatorState: GrowthHomeRuntimeTrustOperatorState
  activeWork: AvaWorkItem | null
  pendingApprovals: number
  idleReason: string | null
  employment: GrowthAvaActivationState["employment"]
}): string | null {
  if (input.operatorState === "working" && input.activeWork) {
    return describeCurrentStep(input.activeWork)
  }
  if (input.operatorState === "waiting" && input.pendingApprovals > 0) {
    return `I'm waiting for your approval on ${input.pendingApprovals} outreach ${input.pendingApprovals === 1 ? "package" : "packages"}.`
  }
  if (input.idleReason) return input.idleReason
  if (input.employment?.discoveryCyclesToday) {
    return `I've completed ${input.employment.discoveryCyclesToday} discovery ${input.employment.discoveryCyclesToday === 1 ? "cycle" : "cycles"} today.`
  }
  return null
}

function buildStartStatus(input: {
  autonomyEnabled: boolean
  objectiveModeEnabled: boolean
  setupIncomplete: boolean
  activation: GrowthAvaActivationState | null | undefined
  pendingApprovals: number
  lastAutonomousActionAt: string | null
  lastAutonomousActionLabel: string | null
  schedulerLastRunAt: string | null
  nowMs: number
}): GrowthHomeRuntimeTrustStartStatus {
  const base = {
    lastAutonomousActionAt: input.lastAutonomousActionAt,
    lastAutonomousActionLabel: input.lastAutonomousActionLabel,
    primaryActionKind: null as "link" | "activate" | null,
  }

  if (input.setupIncomplete) {
    return {
      ...base,
      mode: "setup_required",
      headline: "Finish setup so I can start working for you",
      detail: "Complete your Company Profile, mailbox, and mission setup in Training.",
      primaryActionLabel: "Continue setup in Training",
      primaryActionHref: GROWTH_TRAINING_WORKSPACE_ROUTE,
      primaryActionKind: "link",
    }
  }

  if (input.activation?.readiness.ready && !input.activation.activated) {
    return {
      ...base,
      mode: "activation_required",
      headline: "I'm ready — activate me to begin working",
      detail:
        "When you activate me I'll discover companies, research decision makers, and prepare review-ready packages in the background.",
      primaryActionLabel: GROWTH_AVA_ACTIVATION_CTA,
      primaryActionHref: null,
      primaryActionKind: "activate",
    }
  }

  if (input.activation?.activated) {
    const activeSince = input.activation.employment?.activatedLabel
    const lastAction = input.lastAutonomousActionAt
      ? formatRelativeAgo(input.lastAutonomousActionAt, input.nowMs)
      : null

    return {
      ...base,
      mode: "employee_active",
      headline: "I'm working for you",
      detail: activeSince
        ? `I've been active since ${activeSince}.${lastAction ? ` My last autonomous action was ${lastAction}.` : ""}`
        : lastAction
          ? `My last autonomous action was ${lastAction}.`
          : "I'm running autonomously in the background.",
      primaryActionLabel: input.pendingApprovals > 0 ? "Review what I prepared" : null,
      primaryActionHref: input.pendingApprovals > 0 ? GROWTH_HOME_STARTUP_STEP_PATHS.approvals : null,
      primaryActionKind: input.pendingApprovals > 0 ? "link" : null,
    }
  }

  if (!input.autonomyEnabled) {
    return {
      ...base,
      mode: "autonomous_paused",
      headline: "I'm ready but not activated yet",
      detail: "Activate me once setup is complete and I'll begin building your pipeline in the background.",
      primaryActionLabel: input.activation?.readiness.ready ? GROWTH_AVA_ACTIVATION_CTA : "Continue setup",
      primaryActionHref: input.activation?.readiness.ready ? null : GROWTH_TRAINING_WORKSPACE_ROUTE,
      primaryActionKind: input.activation?.readiness.ready ? "activate" : "link",
    }
  }

  if (!input.objectiveModeEnabled) {
    return {
      ...base,
      mode: "needs_operator_action",
      headline: "One more step before I can run on schedule",
      detail: "Activate me to turn on background discovery and research cycles.",
      primaryActionLabel: GROWTH_AVA_ACTIVATION_CTA,
      primaryActionHref: null,
      primaryActionKind: "activate",
    }
  }

  const beganLabel = input.lastAutonomousActionAt
    ? formatRelativeAgo(input.lastAutonomousActionAt, input.nowMs)
    : null

  return {
    ...base,
    mode: "autonomous_active",
    headline: "Autonomous mode active",
    detail: beganLabel
      ? `My last autonomous action was ${beganLabel}.`
      : "I'm scheduled to check for work every 20 minutes.",
    primaryActionLabel: input.pendingApprovals > 0 ? "Review what I prepared" : null,
    primaryActionHref: input.pendingApprovals > 0 ? GROWTH_HOME_STARTUP_STEP_PATHS.approvals : null,
    primaryActionKind: input.pendingApprovals > 0 ? "link" : null,
  }
}

export function buildGrowthHomeRuntimeTrustViewModel(input: {
  server: GrowthHomeRuntimeTrustServerPayload | null | undefined
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null | undefined
  activeWork: AvaWorkItem | null
  pendingApprovals: number
  setupIncomplete: boolean
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  activation?: GrowthAvaActivationState | null
  generatedAt?: string
  canonicalFocusCompanyName?: string | null
}): GrowthHomeRuntimeTrustViewModel {
  const nowMs = Date.parse(input.generatedAt ?? input.server?.generatedAt ?? new Date().toISOString())
  const killSwitches = input.server?.killSwitches ?? {}
  const autonomyEnabled = killSwitches.autonomy_enabled === true
  const objectiveModeEnabled = killSwitches.autonomy_objective_mode_enabled === true
  const tick = input.server?.autonomyTickHealth ?? null
  const stopReason = tick?.stopReason ?? null

  const activityFeed = buildActivityFeed(input.salesOutcomes)
  const lastActivity = resolveLastAutonomousActivity({
    salesOutcomes: input.salesOutcomes,
    server: input.server,
  })
  const lastAutonomousActionAt = lastActivity.occurredAt
  const lastAutonomousActionLabel = lastActivity.label
  const lastAutonomousActivitySource = lastActivity.source
  const canonicalClaim = input.server?.canonicalActivity?.activeClaim ?? null
  const hasActiveCanonicalClaim = canonicalClaim != null

  const activityAgeMs = lastAutonomousActionAt
    ? nowMs - Date.parse(lastAutonomousActionAt)
    : Number.POSITIVE_INFINITY
  const telemetryStale =
    Boolean(input.activeWork?.status === "working" || hasActiveCanonicalClaim) &&
    activityAgeMs >= GROWTH_HOME_STALE_AUTONOMOUS_ACTIVITY_MS &&
    lastAutonomousActivitySource !== "scheduler_fallback"

  const operatorState = resolveOperatorState({
    autonomyEnabled,
    pendingApprovals: input.pendingApprovals,
    activeWork: input.activeWork,
    recentActivityAt: lastAutonomousActionAt,
    stopReason,
    setupIncomplete: input.setupIncomplete,
    nowMs,
    hasActiveCanonicalClaim,
    lastActivitySource: lastAutonomousActivitySource,
  })

  const heartbeat: GrowthHomeRuntimeTrustHeartbeatLine[] = []

  if (lastAutonomousActionAt) {
    heartbeat.push({
      id: "last-autonomous-activity",
      label: "Last autonomous activity",
      value: formatRelativeAgo(lastAutonomousActionAt, nowMs),
    })
  }

  if (input.activeWork?.status === "working" || hasActiveCanonicalClaim) {
    const started =
      canonicalClaim?.claimedAt ?? input.activeWork?.updated_at ?? input.activeWork?.created_at ?? null
    heartbeat.push({
      id: "current-work-started",
      label: hasActiveCanonicalClaim ? "Current assignment claimed" : "Current work started",
      value: started ? formatRelativeAgo(started, nowMs) : "Just now",
    })
  }

  if (input.server?.lastSchedulerRunAt) {
    heartbeat.push({
      id: "last-scheduler-cycle",
      label: "Last scheduled cycle",
      value: formatRelativeAgo(input.server.lastSchedulerRunAt, nowMs),
    })
  }

  if (input.server?.nextSchedulerEstimateAt && autonomyEnabled) {
    heartbeat.push({
      id: "next-scheduler-cycle",
      label: "Next scheduled cycle",
      value: formatRelativeUntil(input.server.nextSchedulerEstimateAt, nowMs),
    })
  }

  if (tick?.selectedWorkType) {
    heartbeat.push({
      id: "next-planned-work",
      label: "Next planned work type",
      value: humanizeOperatorFacingCopy(tick.selectedWorkType.replace(/_/g, " ")),
    })
  }

  const activation = input.activation ?? null
  const employeeMode = activation?.activated === true
  const showActivationScreen = Boolean(activation?.readiness.ready && !activation?.activated)
  const employment = activation?.employment ?? null
  const nextMilestoneLabel = resolveNextMilestoneLabel(input.activeWork)

  if (employeeMode && employment?.activatedLabel) {
    heartbeat.unshift({
      id: "active-since",
      label: "I've been active since",
      value: employment.activatedLabel,
    })
  }

  let idleReason: string | null = null
  let blockedReason: string | null = null

  if (operatorState === "idle") {
    idleReason =
      humanizeStopReason(stopReason) ??
      (input.missionDiscovery?.discoveryAction === "monitoring"
        ? "I'm waiting for DataMoon to return additional companies that match your Growth Profile."
        : "I'm idle — nothing is queued for autonomous work right now.")
  }

  if (operatorState === "stale") {
    idleReason =
      "I have a projected assignment, but no recent autonomous progress was recorded. I'll retry on the next scheduled cycle."
  }

  if (operatorState === "blocked") {
    blockedReason =
      humanizeStopReason(stopReason) ??
      (!autonomyEnabled
        ? "Autonomous work is paused."
        : input.setupIncomplete
          ? "Setup isn't complete yet."
          : null)
  }

  if (operatorState === "waiting" && input.pendingApprovals > 0) {
    idleReason = `I'm waiting for your approval on ${input.pendingApprovals} outreach ${input.pendingApprovals === 1 ? "package" : "packages"}.`
  }

  let statusExplanation = ""
  switch (operatorState) {
    case "working":
      statusExplanation = input.activeWork
        ? describeCurrentStep(input.activeWork) ?? "I'm actively working."
        : "Autonomous work is in progress."
      break
    case "waiting":
      statusExplanation = idleReason ?? "I'm waiting on you before continuing."
      break
    case "scheduled":
      statusExplanation = "Autonomous mode is on — I'll pick up the next cycle on schedule."
      break
    case "stale":
      statusExplanation = idleReason ?? "Assignment telemetry is stale — waiting for the next scheduler cycle."
      break
    case "blocked":
      statusExplanation = blockedReason ?? "I'm blocked from continuing."
      break
    default:
      statusExplanation = idleReason ?? "I'm not running autonomous work right now."
  }

  const employeePresenceLine = buildEmployeePresenceLine({
    operatorState,
    activeWork: input.activeWork,
    pendingApprovals: input.pendingApprovals,
    idleReason,
    employment,
  })

  if (employeePresenceLine) {
    statusExplanation = employeePresenceLine
  }

  const primaryCompanyName = resolvePrimaryOperatorCompanyName({
    canonicalFocusCompanyName: input.canonicalFocusCompanyName,
    activeWorkCompanyName: input.activeWork?.company_name,
  })

  const nextSchedulerLabel =
    input.server?.nextSchedulerEstimateAt && autonomyEnabled
      ? formatRelativeUntil(input.server.nextSchedulerEstimateAt, nowMs)
      : null

  const whatHappensNextLines = buildOperatorWhatHappensNextLines({
    operatorState,
    pendingApprovals: input.pendingApprovals,
    nextMilestoneLabel,
    nextSchedulerLabel,
    autonomyEnabled,
  })

  const canCloseBrowserLine = buildOperatorCanCloseBrowserLine({
    operatorState,
    pendingApprovals: input.pendingApprovals,
    autonomyEnabled,
    setupIncomplete: input.setupIncomplete,
  })

  return {
    qaMarker: GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
    operatorState,
    operatorStateLabel: `${STATE_EMOJI[operatorState]} ${STATE_LABELS[operatorState]}`,
    statusExplanation,
    idleReason,
    blockedReason,
    heartbeat,
    currentActivity: buildCurrentActivity(
      input.activeWork,
      canonicalClaim
        ? { companyName: canonicalClaim.companyName, claimedAt: canonicalClaim.claimedAt }
        : null,
    ),
    activityFeed,
    startStatus: buildStartStatus({
      autonomyEnabled,
      objectiveModeEnabled,
      setupIncomplete: input.setupIncomplete,
      activation,
      pendingApprovals: input.pendingApprovals,
      lastAutonomousActionAt,
      lastAutonomousActionLabel,
      schedulerLastRunAt: input.server?.lastSchedulerRunAt ?? null,
      nowMs,
    }),
    employeeMode,
    showActivationScreen,
    activation,
    employment,
    employeePresenceLine,
    nextMilestoneLabel,
    primaryCompanyName,
    whatHappensNextLines,
    canCloseBrowserLine,
    telemetryStale,
    lastAutonomousActivitySource: lastAutonomousActivitySource,
  }
}

/**
 * GE-AIOS-LAUNCH-1B — Runtime trust presenter (client-safe).
 * Wires existing production signals only — no simulated activity.
 */

import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  GROWTH_AVA_ACTIVATION_CTA,
  type GrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  describeWorkItemStep,
  formatRuntimeExecutionStartedLabel,
  resolveOperatorFocusPresentation,
  resolveRuntimeExecutionPresentation,
} from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import {
  buildOperatorCanCloseBrowserLine,
  buildOperatorWhatHappensNextLines,
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
  type GrowthHomeRuntimeTrustServerPayload,
  type GrowthHomeRuntimeTrustStartStatus,
  type GrowthHomeRuntimeTrustViewModel,
  type GrowthHomeRuntimePipelinePaceSnapshot,
  type GrowthHomeRuntimeResearchPaceSnapshot,
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

function buildCurrentActivityFromPresentation(
  presentation: ReturnType<typeof resolveRuntimeExecutionPresentation>,
): GrowthHomeRuntimeTrustCurrentActivity | null {
  if (presentation.currentActivityScope === "idle" && !presentation.currentActivityLabel) {
    return null
  }

  const startedAt = presentation.startedAt
  const companyName =
    presentation.currentActivityScope === "lead" ? presentation.currentLeadCompanyName : null

  return {
    companyName,
    taskLabel: presentation.currentActivityLabel,
    currentStepLabel: presentation.currentStepLabel,
    startedAt,
    startedLabel: formatRuntimeExecutionStartedLabel(startedAt),
    expectedCompletionMinutes: presentation.expectedCompletionMinutes,
    expectedCompletionLabel:
      presentation.expectedCompletionMinutes != null && presentation.expectedCompletionMinutes > 0
        ? `~${presentation.expectedCompletionMinutes} minute${presentation.expectedCompletionMinutes === 1 ? "" : "s"}`
        : null,
    pipelineSteps: presentation.showLeadPipeline ? presentation.pipelineSteps : [],
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

function resolveNextMilestoneLabel(
  presentation: ReturnType<typeof resolveRuntimeExecutionPresentation>,
): string | null {
  return presentation.nextMilestoneLabel
}

function buildEmployeePresenceLine(input: {
  operatorState: GrowthHomeRuntimeTrustOperatorState
  activeWork: AvaWorkItem | null
  pendingApprovals: number
  idleReason: string | null
  employment: GrowthAvaActivationState["employment"]
  runtimePresentation: ReturnType<typeof resolveRuntimeExecutionPresentation>
}): string | null {
  if (input.operatorState === "working") {
    return input.runtimePresentation.currentActivityLabel ?? describeWorkItemStep(input.activeWork)
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

function buildPipelinePaceSnapshot(input: {
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null | undefined
  pendingApprovals: number
  emailsSentToday?: number
  repliesToday?: number
  meetingsToday?: number
}): GrowthHomeRuntimePipelinePaceSnapshot | null {
  const summary = input.salesOutcomes?.dailySummary
  if (!summary && input.pendingApprovals <= 0) return null

  const outreachDraftsCreated = summary?.outreach_prepared ?? 0
  const awaitingApproval = Math.max(input.pendingApprovals, summary?.approvals_pending ?? 0)
  const researchedToday = summary?.researched ?? 0

  return {
    outreachDraftsCreated,
    awaitingApproval,
    approvedToday: summary?.outreach_prepared ?? 0,
    emailsSent: input.emailsSentToday ?? 0,
    repliesReceived: input.repliesToday ?? 0,
    meetingsBooked: input.meetingsToday ?? summary?.meetings_prepared ?? 0,
    activeConversations: input.repliesToday ?? 0,
    researchedToday,
  }
}

function formatPipelineHeartbeatLines(
  pipelinePace: GrowthHomeRuntimePipelinePaceSnapshot,
): GrowthHomeRuntimeTrustHeartbeatLine[] {
  const lines: GrowthHomeRuntimeTrustHeartbeatLine[] = []

  if (pipelinePace.outreachDraftsCreated > 0) {
    lines.push({
      id: "outreach-drafts-created",
      label: "Outreach drafts created",
      value: String(pipelinePace.outreachDraftsCreated),
    })
  }
  if (pipelinePace.awaitingApproval > 0) {
    lines.push({
      id: "outreach-awaiting-approval",
      label: "Waiting for approval",
      value: String(pipelinePace.awaitingApproval),
    })
  }
  if (pipelinePace.emailsSent > 0) {
    lines.push({
      id: "emails-sent-today",
      label: "Emails sent",
      value: String(pipelinePace.emailsSent),
    })
  }
  if (pipelinePace.repliesReceived > 0) {
    lines.push({
      id: "replies-received",
      label: "Replies received",
      value: String(pipelinePace.repliesReceived),
    })
  }
  if (pipelinePace.meetingsBooked > 0) {
    lines.push({
      id: "meetings-booked",
      label: "Meetings booked",
      value: String(pipelinePace.meetingsBooked),
    })
  }
  if (pipelinePace.researchedToday > 0) {
    lines.push({
      id: "researched-secondary",
      label: "Researched today",
      value: String(pipelinePace.researchedToday),
    })
  }

  return lines
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
  canonicalOperatorFocus?: GrowthCanonicalOperatorFocus | null
  operatorApprovalCompanyName?: string | null
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  emailsSentToday?: number
  repliesToday?: number
  meetingsToday?: number
  /** @deprecated pass canonicalOperatorFocus instead */
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

  const runtimePresentation = resolveRuntimeExecutionPresentation({
    pendingApprovals: input.pendingApprovals,
    operatorApprovalCompanyName:
      input.operatorApprovalCompanyName ??
      input.canonicalOperatorFocus?.source === "approval"
        ? input.canonicalOperatorFocus.companyName
        : null,
    activeClaim: canonicalClaim,
    activeWork: input.activeWork,
    portfolioOperator: input.portfolioOperator ?? null,
    missionDiscovery: input.missionDiscovery ?? null,
    productionMissionAuthority: input.productionMissionAuthority ?? null,
    autonomyTickHealth: tick,
  })

  const operatorFocus = resolveOperatorFocusPresentation({
    canonicalOperatorFocus:
      input.canonicalOperatorFocus ??
      (input.canonicalFocusCompanyName
        ? {
            qaMarker: "ge-aios-operator-story-implementation-1a-v1",
            leadId: "",
            companyName: input.canonicalFocusCompanyName,
            source: "revenue_queue",
            title: "",
            detail: null,
            href: "",
            priorityRank: 4,
          }
        : null),
  })

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
  const nextMilestoneLabel = resolveNextMilestoneLabel(runtimePresentation)

  const researchPace: GrowthHomeRuntimeResearchPaceSnapshot | null =
    input.server?.canonicalActivity?.pace ?? null

  const pipelinePace = buildPipelinePaceSnapshot({
    salesOutcomes: input.salesOutcomes,
    pendingApprovals: input.pendingApprovals,
    emailsSentToday: input.emailsSentToday,
    repliesToday: input.repliesToday,
    meetingsToday: input.meetingsToday,
  })

  if (pipelinePace) {
    for (const line of formatPipelineHeartbeatLines(pipelinePace).reverse()) {
      heartbeat.unshift(line)
    }
  } else if (researchPace) {
    heartbeat.unshift({
      id: "research-pace-today",
      label: "Researched today",
      value: `${researchPace.researchedToday} / ${researchPace.researchTargetPerDay}`,
    })
  }

  if (researchPace && pipelinePace) {
    heartbeat.push({
      id: "research-pace-secondary",
      label: "Research pace",
      value: `${researchPace.researchedToday} / ${researchPace.researchTargetPerDay}`,
    })
  } else if (researchPace && !pipelinePace) {
    heartbeat.splice(1, 0, {
      id: "research-rate-hour",
      label: "Current rate",
      value: `${researchPace.ratePerHour} companies/hour`,
    })
    heartbeat.splice(2, 0, {
      id: "research-projected-eod",
      label: "Projected today",
      value: `${researchPace.projectedEndOfDay} companies`,
    })
    if (researchPace.activeConcurrentJobs > 0) {
      heartbeat.splice(3, 0, {
        id: "research-concurrent",
        label: "Active research jobs",
        value: `${researchPace.activeConcurrentJobs} / ${researchPace.maxConcurrentJobs}`,
      })
    }
    if (researchPace.budgetBlocked) {
      heartbeat.splice(3, 0, {
        id: "research-budget-blocked",
        label: "Research budget",
        value: "Daily limit reached",
      })
    }
  }

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
      statusExplanation =
        runtimePresentation.currentActivityLabel ??
        (input.activeWork ? describeWorkItemStep(input.activeWork) : "Autonomous work is in progress.")
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
    runtimePresentation,
  })

  if (employeePresenceLine) {
    statusExplanation = employeePresenceLine
  }

  const operatorFocusCompanyName = operatorFocus.operatorFocusCompanyName
  const primaryCompanyName = operatorFocusCompanyName

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
    currentActivity: buildCurrentActivityFromPresentation(runtimePresentation),
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
    primaryMissionLabel: runtimePresentation.primaryMissionLabel,
    primaryMissionKind: runtimePresentation.primaryMissionKind,
    currentActivityLabel: runtimePresentation.currentActivityLabel,
    currentActivityScope: runtimePresentation.currentActivityScope,
    currentLeadCompanyName: runtimePresentation.currentLeadCompanyName,
    operatorFocusCompanyName,
    operatorFocusHref: operatorFocus.operatorFocusHref,
    primaryCompanyName,
    whatHappensNextLines,
    canCloseBrowserLine,
    telemetryStale,
    lastAutonomousActivitySource: lastAutonomousActivitySource,
    researchPace,
    pipelinePace,
  }
}

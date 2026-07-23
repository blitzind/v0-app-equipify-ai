/** GE-AIOS-LAUNCH-1B — Runtime trust payload types (client-safe). */

import type { GrowthAvaActivationState, GrowthAvaEmploymentStats } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import type {
  GrowthHomePrimaryMissionKind,
  GrowthHomeRuntimeExecutionScope,
} from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"
import type { GrowthRuntimeKillSwitchKey } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export type { GrowthHomePrimaryMissionKind, GrowthHomeRuntimeExecutionScope }

export const GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER = "ge-aios-launch-1b-runtime-trust-v1" as const

export type GrowthHomeRuntimeTrustOperatorState =
  | "working"
  | "waiting"
  | "scheduled"
  | "idle"
  | "blocked"
  | "stale"

export type GrowthHomeRuntimeTrustServerPayload = {
  qaMarker: typeof GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER
  generatedAt: string
  killSwitches: Partial<Record<GrowthRuntimeKillSwitchKey, boolean>>
  autonomyTickHealth: GrowthAiosAutonomyTickHealthSnapshot | null
  lastSchedulerRunAt: string | null
  lastSchedulerOk: boolean | null
  nextSchedulerEstimateAt: string | null
  /** GE-AIOS-RUNTIME-THROUGHPUT-1A — canonical DB-backed activity authority */
  canonicalActivity?: GrowthHomeCanonicalRuntimeActivityPayload | null
}

export type GrowthHomeCanonicalRuntimeActivitySource =
  | "research_run_completed"
  | "research_run_claimed"
  | "organization_memory_event"
  | "scheduler_cycle"

export type GrowthHomeCanonicalRuntimeActivity = {
  occurredAt: string
  label: string
  source: GrowthHomeCanonicalRuntimeActivitySource
}

export type GrowthHomeCanonicalRuntimeActivityPayload = {
  qaMarker: string
  lastMeaningfulActivity: GrowthHomeCanonicalRuntimeActivity | null
  activeClaim: {
    runId: string
    leadId: string
    companyName: string | null
    claimedAt: string
    status: "queued" | "running"
  } | null
  recentCompletedResearchCount24h: number
  /** GE-AIOS-RUNTIME-SCALE-1A — operator pace telemetry */
  pace?: GrowthHomeRuntimeResearchPaceSnapshot | null
}

export type GrowthHomeRuntimeResearchPaceSnapshot = {
  researchedToday: number
  researchTargetPerDay: number
  researchedLastHour: number
  ratePerHour: number
  projectedEndOfDay: number
  activeConcurrentJobs: number
  maxConcurrentJobs: number
  queueDepth: number
  budgetConsumed: number | null
  budgetCap: number | null
  budgetBlocked: boolean
}

/** GE-AIOS-OUTREACH-1A — Pipeline-first operator metrics (research is secondary). */
export type GrowthHomeRuntimePipelinePaceSnapshot = {
  outreachDraftsCreated: number
  awaitingApproval: number
  approvedToday: number
  emailsSent: number
  repliesReceived: number
  meetingsBooked: number
  activeConversations: number
  researchedToday: number
}

export type GrowthHomeRuntimeTrustHeartbeatLine = {
  id: string
  label: string
  value: string
}

export type GrowthHomeRuntimeTrustActivityEntry = {
  id: string
  timeLabel: string
  summary: string
  occurredAt: string
}

export type GrowthHomeRuntimeTrustPipelineStep = {
  id: string
  label: string
  complete: boolean
  active: boolean
}

export type GrowthHomeRuntimeTrustCurrentActivity = {
  companyName: string | null
  taskLabel: string | null
  currentStepLabel: string | null
  startedAt: string | null
  startedLabel: string | null
  expectedCompletionMinutes: number | null
  expectedCompletionLabel: string | null
  pipelineSteps: GrowthHomeRuntimeTrustPipelineStep[]
}

export type GrowthHomeRuntimeTrustStartStatus = {
  mode:
    | "autonomous_active"
    | "employee_active"
    | "activation_required"
    | "needs_operator_action"
    | "setup_required"
    | "autonomous_paused"
  headline: string
  detail: string | null
  primaryActionLabel: string | null
  primaryActionHref: string | null
  primaryActionKind: "link" | "activate" | null
  lastAutonomousActionAt: string | null
  lastAutonomousActionLabel: string | null
}

export type GrowthHomeRuntimeExecutionScope = "lead" | "portfolio" | "operator_wait" | "idle"

export type GrowthHomePrimaryMissionKind =
  | "operator_review"
  | "prospect_research"
  | "draft_factory"
  | "portfolio_replenishment"
  | "portfolio_maintenance"
  | "idle"

export type GrowthHomeRuntimeTrustViewModel = {
  qaMarker: typeof GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER
  operatorState: GrowthHomeRuntimeTrustOperatorState
  operatorStateLabel: string
  statusExplanation: string
  idleReason: string | null
  blockedReason: string | null
  heartbeat: GrowthHomeRuntimeTrustHeartbeatLine[]
  currentActivity: GrowthHomeRuntimeTrustCurrentActivity | null
  activityFeed: GrowthHomeRuntimeTrustActivityEntry[]
  startStatus: GrowthHomeRuntimeTrustStartStatus
  /** GE-AIOS-LAUNCH-1C — employee mode after one-time activation */
  employeeMode: boolean
  showActivationScreen: boolean
  activation: GrowthAvaActivationState | null
  employment: GrowthAvaEmploymentStats | null
  employeePresenceLine: string | null
  nextMilestoneLabel: string | null
  /** GE-AIOS-HOME-RUNTIME-AUTHORITY-1B — runtime execution (what Ava is doing) */
  primaryMissionLabel: string | null
  primaryMissionKind: GrowthHomePrimaryMissionKind | null
  currentActivityLabel: string | null
  currentActivityScope: GrowthHomeRuntimeExecutionScope
  currentLeadCompanyName: string | null
  /** GE-AIOS-HOME-RUNTIME-AUTHORITY-1B — operator navigation (where to click) */
  operatorFocusCompanyName: string | null
  operatorFocusHref: string | null
  /**
   * @deprecated GE-AIOS-HOME-RUNTIME-AUTHORITY-1B — alias for operatorFocusCompanyName only.
   * Do not use for runtime assignment.
   */
  primaryCompanyName: string | null
  whatHappensNextLines: string[]
  canCloseBrowserLine: string | null
  /** GE-AIOS-RUNTIME-THROUGHPUT-1A */
  telemetryStale: boolean
  lastAutonomousActivitySource: GrowthHomeCanonicalRuntimeActivitySource | "sales_outcome" | "scheduler_fallback" | null
  /** GE-AIOS-RUNTIME-SCALE-1A */
  researchPace: GrowthHomeRuntimeResearchPaceSnapshot | null
  /** GE-AIOS-OUTREACH-1A */
  pipelinePace: GrowthHomeRuntimePipelinePaceSnapshot | null
}

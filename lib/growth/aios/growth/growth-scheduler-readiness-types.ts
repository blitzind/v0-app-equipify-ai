/** GE-AIOS-GROWTH-5A — Scheduler Readiness & Activation Plan types (client-safe). */

import type {
  GrowthAgentKind,
  GrowthAgentPermissionProfile,
  GrowthAgentRequiredGate,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthMissionType } from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type {
  GrowthMissionCapacityKind,
  GrowthMissionQueueBucket,
  GrowthMissionStarvationIssue,
  GrowthResourceCapacitySlot,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"

export const GROWTH_AIOS_GROWTH_5A_PHASE = "GE-AIOS-GROWTH-5A" as const

export const GROWTH_SCHEDULER_READINESS_QA_MARKER = "growth-aios-growth-5a-scheduler-readiness-v1" as const

export const GROWTH_SCHEDULER_READINESS_RULE =
  "Scheduler readiness is definition-only in 5A — activation paths, wake rules, budgets, and throttles are prepared from the Mission Priority Engine without activating schedulers, cron, workers, runtime, outbound, providers, Work Orders, or Core mutations." as const

export const GROWTH_SCHEDULER_MODES = [
  "disabled",
  "manual_review",
  "priority_queue_preview",
  "controlled_agent_wake",
  "autonomous",
] as const

export type GrowthSchedulerMode = (typeof GROWTH_SCHEDULER_MODES)[number]

/** Modes permitted in GE-AIOS-GROWTH-5A — no agent wake or autonomous scheduling. */
export const GROWTH_SCHEDULER_PHASE_ALLOWED_MODES = [
  "disabled",
  "priority_queue_preview",
] as const satisfies readonly GrowthSchedulerMode[]

export const GROWTH_SCHEDULER_ACTIVATION_STATUSES = [
  "not_configured",
  "ready_for_manual_activation",
  "blocked_missing_priority_queue",
  "blocked_missing_budget_limits",
  "blocked_missing_kill_switch",
  "blocked_missing_agent_permissions",
  "blocked_runtime_risk",
  "blocked_outbound_risk",
] as const

export type GrowthSchedulerActivationStatus = (typeof GROWTH_SCHEDULER_ACTIVATION_STATUSES)[number]

export type GrowthSchedulerKillSwitchStatus = {
  emergencyStop: "armed" | "missing"
  autonomyDisabled: "armed" | "missing"
  schedulerActive: false
}

export type GrowthSchedulerBudgetLimits = {
  maxAgentPreviewsPerHour: number
  maxInternalRuntimeCandidatesPerDay: number
  maxOutboundCandidatesPerDay: number
  maxEstimatedSpendPerDay: number
  maxFailedAttemptsPerMission: number
  cooldownAfterBlockMinutes: number
  cooldownAfterFailureMinutes: number
}

export type GrowthSchedulerThrottleRules = {
  previewThrottlePerHour: number
  runtimeCandidateThrottlePerDay: number
  outboundCandidateThrottlePerDay: number
  spendThrottlePerDay: number
  failureRetryCooldownMinutes: number
  blockCooldownMinutes: number
}

export type GrowthSchedulerWakeRule = {
  agentKind: GrowthAgentKind
  agentName: string
  allowedSchedulerModes: GrowthSchedulerMode[]
  requiredMissionTypes: GrowthMissionType[]
  requiredPermissionProfile: GrowthAgentPermissionProfile
  requiredGates: GrowthAgentRequiredGate[]
  cooldownMinutes: number
  maxRunsPerPeriod: number
  periodHours: number
  budgetCeilingTokens: number | null
  blockedCapabilities: string[]
  wakeAllowedInPhase: false
}

export type GrowthSchedulerPriorityQueueSnapshot = {
  immediateCount: number
  todayCount: number
  thisWeekCount: number
  backlogCount: number
  archiveCandidateCount: number
  eligibleQueues: GrowthMissionQueueBucket[]
  capacityLanes: GrowthResourceCapacitySlot[]
  starvationWarnings: GrowthMissionStarvationIssue[]
  prioritySource: "GE-AIOS-GROWTH-4F"
}

export type GrowthSchedulerReadinessRecord = {
  schedulerReadinessId: string
  schedulerMode: GrowthSchedulerMode
  activationStatus: GrowthSchedulerActivationStatus
  enabledAgents: GrowthAgentKind[]
  eligibleMissionQueues: GrowthMissionQueueBucket[]
  prioritySource: "GE-AIOS-GROWTH-4F"
  capacityLanes: GrowthMissionCapacityKind[]
  budgetLimits: GrowthSchedulerBudgetLimits
  throttleRules: GrowthSchedulerThrottleRules
  killSwitchStatus: GrowthSchedulerKillSwitchStatus
  requiredApprovals: string[]
  blockedReasons: string[]
  recommendedActivationPath: string[]
}

export type GrowthSchedulerReadinessReadModel = {
  qaMarker: typeof GROWTH_SCHEDULER_READINESS_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_SCHEDULER_READINESS_RULE
  schedulerActive: false
  phaseAllowedModes: typeof GROWTH_SCHEDULER_PHASE_ALLOWED_MODES
  readiness: GrowthSchedulerReadinessRecord
  priorityQueue: GrowthSchedulerPriorityQueueSnapshot
  agentWakeRules: GrowthSchedulerWakeRule[]
  summary: {
    activationStatus: GrowthSchedulerActivationStatus
    schedulerMode: GrowthSchedulerMode
    wakeRulesDefined: number
    blockedReasonCount: number
    starvationWarningCount: number
  }
  autonomyPolicySource?: string
  policySchedulerMode?: GrowthSchedulerMode
}

export type GrowthSchedulerReadinessPlanContext = {
  schedulerEligibility: "eligible_preview" | "blocked" | "not_applicable"
  queueSource: string
  wakeRecommendation: string
  blockedReasons: string[]
  cooldownBudgetSummary: string
}

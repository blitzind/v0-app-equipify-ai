/** GE-AIOS-GROWTH-5A — Scheduler Readiness & Activation Plan engine (client-safe, deterministic). */

import { isAgentSchedulerActive } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import { getGrowthAgentDefinition } from "@/lib/growth/aios/growth/growth-agent-framework-registry"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import { GROWTH_AGENT_KINDS } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthMissionType } from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type {
  GrowthMissionPriorityReadModel,
  GrowthMissionQueueBucket,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"
import { GROWTH_MISSION_CAPACITY_KINDS } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type {
  GrowthSchedulerActivationStatus,
  GrowthSchedulerBudgetLimits,
  GrowthSchedulerKillSwitchStatus,
  GrowthSchedulerMode,
  GrowthSchedulerPriorityQueueSnapshot,
  GrowthSchedulerReadinessPlanContext,
  GrowthSchedulerReadinessReadModel,
  GrowthSchedulerReadinessRecord,
  GrowthSchedulerThrottleRules,
  GrowthSchedulerWakeRule,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"
import {
  GROWTH_SCHEDULER_PHASE_ALLOWED_MODES,
  GROWTH_SCHEDULER_READINESS_QA_MARKER,
  GROWTH_SCHEDULER_READINESS_RULE,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

const DEFAULT_BUDGET_LIMITS: GrowthSchedulerBudgetLimits = {
  maxAgentPreviewsPerHour: 12,
  maxInternalRuntimeCandidatesPerDay: 4,
  maxOutboundCandidatesPerDay: 0,
  maxEstimatedSpendPerDay: 50,
  maxFailedAttemptsPerMission: 3,
  cooldownAfterBlockMinutes: 30,
  cooldownAfterFailureMinutes: 60,
}

const DEFAULT_THROTTLE_RULES: GrowthSchedulerThrottleRules = {
  previewThrottlePerHour: DEFAULT_BUDGET_LIMITS.maxAgentPreviewsPerHour,
  runtimeCandidateThrottlePerDay: DEFAULT_BUDGET_LIMITS.maxInternalRuntimeCandidatesPerDay,
  outboundCandidateThrottlePerDay: DEFAULT_BUDGET_LIMITS.maxOutboundCandidatesPerDay,
  spendThrottlePerDay: DEFAULT_BUDGET_LIMITS.maxEstimatedSpendPerDay,
  failureRetryCooldownMinutes: DEFAULT_BUDGET_LIMITS.cooldownAfterFailureMinutes,
  blockCooldownMinutes: DEFAULT_BUDGET_LIMITS.cooldownAfterBlockMinutes,
}

const AGENT_MISSION_MAP: Record<GrowthAgentKind, GrowthMissionType[]> = {
  research_agent: ["enrich_account", "monitor_account"],
  qualification_agent: ["qualify_lead", "identify_buying_committee"],
  planning_agent: ["prepare_outreach"],
  execution_agent: ["recover_failed_workflow"],
  outreach_agent: ["prepare_outreach"],
  meeting_agent: ["prepare_meeting"],
  revenue_operator_agent: ["close_opportunity", "qualify_lead", "recover_failed_workflow"],
}

const AGENT_WAKE_MODES: Record<GrowthAgentKind, GrowthSchedulerMode[]> = {
  research_agent: ["priority_queue_preview", "manual_review", "controlled_agent_wake"],
  qualification_agent: ["priority_queue_preview", "manual_review", "controlled_agent_wake"],
  planning_agent: ["priority_queue_preview", "manual_review", "controlled_agent_wake"],
  execution_agent: ["manual_review", "controlled_agent_wake"],
  outreach_agent: ["manual_review"],
  meeting_agent: ["priority_queue_preview", "manual_review", "controlled_agent_wake"],
  revenue_operator_agent: ["priority_queue_preview", "manual_review", "controlled_agent_wake", "autonomous"],
}

const AGENT_COOLDOWN: Record<GrowthAgentKind, { cooldownMinutes: number; maxRuns: number; periodHours: number }> = {
  research_agent: { cooldownMinutes: 15, maxRuns: 6, periodHours: 1 },
  qualification_agent: { cooldownMinutes: 20, maxRuns: 5, periodHours: 1 },
  planning_agent: { cooldownMinutes: 30, maxRuns: 4, periodHours: 1 },
  execution_agent: { cooldownMinutes: 60, maxRuns: 2, periodHours: 24 },
  outreach_agent: { cooldownMinutes: 120, maxRuns: 0, periodHours: 24 },
  meeting_agent: { cooldownMinutes: 45, maxRuns: 3, periodHours: 24 },
  revenue_operator_agent: { cooldownMinutes: 10, maxRuns: 8, periodHours: 1 },
}

function buildKillSwitchStatus(): GrowthSchedulerKillSwitchStatus {
  const sample = getGrowthAgentDefinition("research_agent")
  const required = sample?.requiredKillSwitches ?? []
  return {
    emergencyStop: required.includes("emergency_stop") ? "armed" : "missing",
    autonomyDisabled: required.includes("autonomy_disabled") ? "armed" : "missing",
    schedulerActive: false,
  }
}

export function buildSchedulerBudgetLimits(): GrowthSchedulerBudgetLimits {
  return { ...DEFAULT_BUDGET_LIMITS }
}

export function buildSchedulerThrottleRules(): GrowthSchedulerThrottleRules {
  return { ...DEFAULT_THROTTLE_RULES }
}

const PILOT_WAKE_ALLOWED_AGENTS = new Set<GrowthAgentKind>([
  "research_agent",
  "qualification_agent",
  "planning_agent",
  "execution_agent",
])

export function buildAgentWakeRules(): GrowthSchedulerWakeRule[] {
  return GROWTH_AGENT_KINDS.map((agentKind) => {
    const definition = getGrowthAgentDefinition(agentKind)
    const timing = AGENT_COOLDOWN[agentKind]
    return {
      agentKind,
      agentName: definition?.agentName ?? agentKind.replaceAll("_", " "),
      allowedSchedulerModes: AGENT_WAKE_MODES[agentKind],
      requiredMissionTypes: AGENT_MISSION_MAP[agentKind],
      requiredPermissionProfile: definition?.permissionProfile ?? "read_only",
      requiredGates: agentKind === "execution_agent"
        ? ["approval", "readiness", "handoff", "preflight", "boundary", "dry_run", "runtime_pilot"]
        : agentKind === "outreach_agent"
          ? ["approval", "readiness", "operator_approval"]
          : ["approval", "readiness", "handoff", "preflight", "boundary"],
      cooldownMinutes: timing.cooldownMinutes,
      maxRunsPerPeriod: timing.maxRuns,
      periodHours: timing.periodHours,
      budgetCeilingTokens: definition?.budgetProfile.dailyTokenCap ?? null,
      blockedCapabilities: definition?.blockedCapabilities ?? ["direct_execution"],
      wakeAllowedInPhase: PILOT_WAKE_ALLOWED_AGENTS.has(agentKind),
    }
  })
}

export function buildSchedulerPriorityQueueSnapshot(
  missionPriority: GrowthMissionPriorityReadModel,
): GrowthSchedulerPriorityQueueSnapshot {
  const eligibleQueues: GrowthMissionQueueBucket[] = []
  if (missionPriority.queues.immediate.length > 0) eligibleQueues.push("immediate")
  if (missionPriority.queues.today.length > 0) eligibleQueues.push("today")
  if (missionPriority.queues.this_week.length > 0) eligibleQueues.push("this_week")
  if (missionPriority.queues.backlog.length > 0) eligibleQueues.push("backlog")

  return {
    immediateCount: missionPriority.queues.immediate.length,
    todayCount: missionPriority.queues.today.length,
    thisWeekCount: missionPriority.queues.this_week.length,
    backlogCount: missionPriority.queues.backlog.length,
    archiveCandidateCount: missionPriority.queues.archive_candidate.length,
    eligibleQueues,
    capacityLanes: missionPriority.capacityPool,
    starvationWarnings: missionPriority.starvationIssues,
    prioritySource: "GE-AIOS-GROWTH-4F",
  }
}

function resolveActivationStatus(input: {
  priorityQueue: GrowthSchedulerPriorityQueueSnapshot
  budgetLimits: GrowthSchedulerBudgetLimits
  killSwitchStatus: GrowthSchedulerKillSwitchStatus
  agentWakeRules: GrowthSchedulerWakeRule[]
  missionPriority: GrowthMissionPriorityReadModel
}): {
  activationStatus: GrowthSchedulerActivationStatus
  blockedReasons: string[]
  recommendedActivationPath: string[]
} {
  const blockedReasons: string[] = []
  const path: string[] = [
    "1. Confirm Mission Priority Engine (4F) queues are populated.",
    "2. Verify kill switches (emergency_stop, autonomy_disabled) remain armed.",
    "3. Review budget and throttle limits with Revenue Operator.",
    "4. Switch scheduler mode to priority_queue_preview (read-only preview — no agent wake).",
    "5. Obtain operator approval before any future controlled_agent_wake activation.",
  ]

  if (input.priorityQueue.immediateCount + input.priorityQueue.todayCount === 0) {
    blockedReasons.push("No immediate or today priority queue missions available.")
    return {
      activationStatus: "blocked_missing_priority_queue",
      blockedReasons,
      recommendedActivationPath: [
        ...path.slice(0, 1),
        "Blocked — populate mission priority queues before scheduler preview.",
      ],
    }
  }

  if (
    input.budgetLimits.maxAgentPreviewsPerHour <= 0 ||
    input.budgetLimits.maxInternalRuntimeCandidatesPerDay < 0
  ) {
    blockedReasons.push("Budget limits are incomplete.")
    return {
      activationStatus: "blocked_missing_budget_limits",
      blockedReasons,
      recommendedActivationPath: path,
    }
  }

  if (
    input.killSwitchStatus.emergencyStop !== "armed" ||
    input.killSwitchStatus.autonomyDisabled !== "armed"
  ) {
    blockedReasons.push("Required kill switches are not armed in agent definitions.")
    return {
      activationStatus: "blocked_missing_kill_switch",
      blockedReasons,
      recommendedActivationPath: path,
    }
  }

  const hasRuntimeRisk = input.missionPriority.rankedMissions.some(
    (row) =>
      row.missionType === "recover_failed_workflow" &&
      (row.queueBucket === "immediate" || row.queueBucket === "today") &&
      row.allocationStatus === "allocated",
  )
  if (hasRuntimeRisk) {
    blockedReasons.push(
      "Immediate/today queue includes recover_failed_workflow missions — runtime risk gate required.",
    )
    return {
      activationStatus: "blocked_runtime_risk",
      blockedReasons,
      recommendedActivationPath: [
        ...path.slice(0, 3),
        "Resolve runtime pilot gates before enabling controlled agent wake.",
        ...path.slice(3),
      ],
    }
  }

  const hasOutboundRisk = input.missionPriority.rankedMissions.some(
    (row) => row.missionType === "prepare_outreach" && row.allocationStatus !== "abandon_recommended",
  )
  if (hasOutboundRisk) {
    blockedReasons.push("Priority queue includes prepare_outreach missions — outbound risk gate required.")
    return {
      activationStatus: "blocked_outbound_risk",
      blockedReasons,
      recommendedActivationPath: [
        ...path.slice(0, 3),
        "Retire or archive outbound missions before scheduler preview.",
        ...path.slice(3),
      ],
    }
  }

  const disabledAgents = input.agentWakeRules.filter((rule) => {
    const def = getGrowthAgentDefinition(rule.agentKind)
    return def?.status === "disabled"
  })
  if (disabledAgents.length === GROWTH_AGENT_KINDS.length) {
    blockedReasons.push("All agents remain disabled in GE-AIOS-GROWTH-4A — permissions not elevated.")
    return {
      activationStatus: "blocked_missing_agent_permissions",
      blockedReasons,
      recommendedActivationPath: path,
    }
  }

  return {
    activationStatus: "ready_for_manual_activation",
    blockedReasons: [],
    recommendedActivationPath: path,
  }
}

export function buildSchedulerReadinessRecord(input: {
  organizationId: string
  missionPriority: GrowthMissionPriorityReadModel
  generatedAt: string
}): GrowthSchedulerReadinessRecord {
  const budgetLimits = buildSchedulerBudgetLimits()
  const throttleRules = buildSchedulerThrottleRules()
  const killSwitchStatus = buildKillSwitchStatus()
  const agentWakeRules = buildAgentWakeRules()
  const priorityQueue = buildSchedulerPriorityQueueSnapshot(input.missionPriority)

  const { activationStatus, blockedReasons, recommendedActivationPath } = resolveActivationStatus({
    priorityQueue,
    budgetLimits,
    killSwitchStatus,
    agentWakeRules,
    missionPriority: input.missionPriority,
  })

  const schedulerMode: GrowthSchedulerMode = "disabled"
  const enabledAgents: GrowthAgentKind[] = []

  return {
    schedulerReadinessId: `growth-scheduler-readiness:${input.organizationId}:${input.generatedAt.slice(0, 10)}`,
    schedulerMode,
    activationStatus,
    enabledAgents,
    eligibleMissionQueues: priorityQueue.eligibleQueues,
    prioritySource: "GE-AIOS-GROWTH-4F",
    capacityLanes: [...GROWTH_MISSION_CAPACITY_KINDS],
    budgetLimits,
    throttleRules,
    killSwitchStatus,
    requiredApprovals: [
      "operator_scheduler_mode_change",
      "revenue_operator_budget_review",
      "runtime_pilot_signoff_for_execution_agent",
    ],
    blockedReasons,
    recommendedActivationPath,
  }
}

export function buildSchedulerReadinessReadModel(input: {
  organizationId: string
  missionPriority: GrowthMissionPriorityReadModel
  generatedAt: string
}): GrowthSchedulerReadinessReadModel {
  const agentWakeRules = buildAgentWakeRules()
  const priorityQueue = buildSchedulerPriorityQueueSnapshot(input.missionPriority)
  const readiness = buildSchedulerReadinessRecord(input)

  return {
    qaMarker: GROWTH_SCHEDULER_READINESS_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_SCHEDULER_READINESS_RULE,
    schedulerActive: false,
    phaseAllowedModes: GROWTH_SCHEDULER_PHASE_ALLOWED_MODES,
    readiness,
    priorityQueue,
    agentWakeRules,
    summary: {
      activationStatus: readiness.activationStatus,
      schedulerMode: readiness.schedulerMode,
      wakeRulesDefined: agentWakeRules.length,
      blockedReasonCount: readiness.blockedReasons.length,
      starvationWarningCount: priorityQueue.starvationWarnings.length,
    },
  }
}

export function buildSchedulerReadinessPlanContext(input: {
  leadId: string
  missionPriority: GrowthMissionPriorityReadModel
  readiness: GrowthSchedulerReadinessReadModel
}): GrowthSchedulerReadinessPlanContext | null {
  const leadMission = input.missionPriority.rankedMissions.find((row) => row.leadId === input.leadId)
  if (!leadMission) return null

  const matchingRule = input.readiness.agentWakeRules.find((rule) =>
    rule.requiredMissionTypes.includes(leadMission.missionType),
  )

  const blockedReasons = [
    ...input.readiness.readiness.blockedReasons,
    ...(leadMission.allocationStatus === "blocked" ? leadMission.blockers : []),
  ]

  const eligibility: GrowthSchedulerReadinessPlanContext["schedulerEligibility"] =
    input.readiness.readiness.activationStatus === "ready_for_manual_activation"
      ? "eligible_preview"
      : blockedReasons.length > 0
        ? "blocked"
        : "not_applicable"

  const budget = input.readiness.readiness.budgetLimits
  const rule = matchingRule

  return {
    schedulerEligibility: eligibility,
    queueSource: `${leadMission.queueBucket} queue · GE-AIOS-GROWTH-4F priority ${leadMission.priority.overallPriority}`,
    wakeRecommendation: rule
      ? `Preview-only — ${rule.agentName} would wake for ${leadMission.missionType.replaceAll("_", " ")} in priority_queue_preview mode (not enabled in 5A).`
      : "No matching agent wake rule — Revenue Operator review only.",
    blockedReasons: blockedReasons.slice(0, 4),
    cooldownBudgetSummary: rule
      ? `Cooldown ${rule.cooldownMinutes}m · max ${rule.maxRunsPerPeriod}/${rule.periodHours}h · previews ${budget.maxAgentPreviewsPerHour}/hr · runtime candidates ${budget.maxInternalRuntimeCandidatesPerDay}/day.`
      : `Previews ${budget.maxAgentPreviewsPerHour}/hr · spend cap $${budget.maxEstimatedSpendPerDay}/day.`,
  }
}

export function isSchedulerReadinessActive(): false {
  return isAgentSchedulerActive()
}

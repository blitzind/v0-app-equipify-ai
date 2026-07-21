/** GE-AIOS-CONSOLIDATION-1C — Autonomy policy synthesizer (client-safe, deterministic). */

import type { GrowthAgentKind, GrowthAgentPermissionProfile } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import { GROWTH_AGENT_KINDS } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthAgentFrameworkReadModel } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthAutonomousMeetingPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import { GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { GrowthAutonomousExecutionPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import { GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import type { GrowthAutonomousPlanningPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import { GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import type { GrowthAutonomousQualificationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import type { GrowthAutonomousResearchPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import type {
  GrowthSchedulerBudgetLimits,
  GrowthSchedulerKillSwitchStatus,
  GrowthSchedulerMode,
  GrowthSchedulerReadinessReadModel,
  GrowthSchedulerThrottleRules,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"
import type {
  RevenueOperatorOrchestrationRecord,
  RevenueOperatorReadModel,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import {
  GROWTH_AUTONOMY_BUDGET_LABELS,
  GROWTH_AUTONOMY_MASTER_MODE_LABELS,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import type {
  GrowthAiOsAgentAutonomyPolicyState,
  GrowthAiOsAutonomyPolicyEvaluationContext,
  GrowthAiOsAutonomyPolicyIntegrationSummary,
  GrowthAiOsAutonomyPolicyReadModel,
  GrowthAiOsAutonomyPolicyRuntimeGate,
  GrowthAiOsRevenueOperatorPolicyAwareness,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import {
  GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH,
  GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyMasterMode,
  GrowthAutonomySettingsSnapshot,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export type GrowthAiOsAutonomyPolicyBuildInput = {
  organizationId: string
  generatedAt: string
  settings: GrowthAutonomySettingsSnapshot
  runtimeEnabled: boolean
  runtimePilotEnabled: boolean
  researchPilotTelemetry?: {
    budgetConsumptionHour: number
    budgetConsumptionDay: number
  }
  qualificationPilotTelemetry?: {
    budgetConsumptionHour: number
    budgetConsumptionDay: number
  }
  planningPilotTelemetry?: {
    budgetConsumptionHour: number
    budgetConsumptionDay: number
  }
  executionPilotTelemetry?: {
    budgetConsumptionHour: number
    budgetConsumptionDay: number
  }
  outreachPreparationPilotTelemetry?: {
    budgetConsumptionHour: number
    budgetConsumptionDay: number
  }
  meetingPilotTelemetry?: {
    budgetConsumptionHour: number
    budgetConsumptionDay: number
  }
  budgetRemaining?: Record<string, { cap: number; remaining: number; exceeded: boolean }>
}

const AGENT_CAPABILITY_MAP: Record<GrowthAgentKind, GrowthAutonomyCapability | null> = {
  research_agent: "research",
  qualification_agent: "enrichment",
  planning_agent: "recommendations",
  execution_agent: "task_creation",
  outreach_agent: "email_execution",
  meeting_agent: "task_creation",
  revenue_operator_agent: "recommendations",
}

const AGENT_PERMISSION_PROFILES: Record<GrowthAgentKind, GrowthAgentPermissionProfile[]> = {
  research_agent: ["read_only", "internal_mutation"],
  qualification_agent: ["read_only", "planning_only"],
  planning_agent: ["read_only", "planning_only"],
  execution_agent: ["internal_mutation"],
  outreach_agent: ["outbound_requires_approval"],
  meeting_agent: ["planning_only"],
  revenue_operator_agent: ["supervisor"],
}

export function resolveSchedulerModeFromOperatingMode(
  masterMode: GrowthAutonomyMasterMode,
  autonomyEnabled: boolean,
): GrowthSchedulerMode {
  if (!autonomyEnabled || masterMode === "manual") return "disabled"
  if (masterMode === "assisted") return "manual_review"
  if (masterMode === "guardrailed") return "priority_queue_preview"
  if (masterMode === "channel") return "controlled_agent_wake"
  if (masterMode === "objective") return "autonomous"
  return "disabled"
}

export function buildSchedulerKillSwitchStatusFromPolicy(
  policy: Pick<GrowthAiOsAutonomyPolicyReadModel, "emergencyStopActive" | "autonomyEnabled">,
): GrowthSchedulerKillSwitchStatus {
  return {
    emergencyStop: policy.emergencyStopActive ? "armed" : "missing",
    autonomyDisabled: !policy.autonomyEnabled ? "armed" : "missing",
    schedulerActive: false,
  }
}

export function buildSchedulerBudgetLimitsFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthSchedulerBudgetLimits {
  const researchDaily =
    policy.dailyBudgets.find((row) => row.resourceKey === "autonomous_research_runs")?.dailyCap ?? 100
  return {
    maxAgentPreviewsPerHour: policy.hourlyBudgets.researchRunsPerHour,
    maxInternalRuntimeCandidatesPerDay: Math.max(1, researchDaily),
    maxOutboundCandidatesPerDay: policy.outboundEnabled ? 0 : 0,
    maxEstimatedSpendPerDay: 50,
    maxFailedAttemptsPerMission: 3,
    cooldownAfterBlockMinutes: 30,
    cooldownAfterFailureMinutes: 60,
  }
}

export function buildSchedulerThrottleRulesFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthSchedulerThrottleRules {
  const budgets = buildSchedulerBudgetLimitsFromPolicy(policy)
  return {
    previewThrottlePerHour: budgets.maxAgentPreviewsPerHour,
    runtimeCandidateThrottlePerDay: budgets.maxInternalRuntimeCandidatesPerDay,
    outboundCandidateThrottlePerDay: budgets.maxOutboundCandidatesPerDay,
    spendThrottlePerDay: budgets.maxEstimatedSpendPerDay,
    failureRetryCooldownMinutes: budgets.cooldownAfterFailureMinutes,
    blockCooldownMinutes: budgets.cooldownAfterBlockMinutes,
  }
}

export function buildCommandCenterSafeModeFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
): {
  emergencyStopActive: boolean
  objectiveModeEnabled: boolean
  autonomyEnabled: boolean
  killSwitches: Record<string, boolean>
} {
  return {
    emergencyStopActive: policy.emergencyStopActive,
    objectiveModeEnabled: policy.killSwitches.autonomyObjectiveModeEnabled,
    autonomyEnabled: policy.autonomyEnabled,
    killSwitches: {
      autonomy_enabled: policy.killSwitches.autonomyEnabled,
      autonomy_outbound_enabled: policy.killSwitches.autonomyOutboundEnabled,
      autonomy_generation_enabled: policy.killSwitches.autonomyGenerationEnabled,
      autonomy_objective_mode_enabled: policy.killSwitches.autonomyObjectiveModeEnabled,
    },
  }
}

function resolveAgentPolicyBlocks(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  agentKind: GrowthAgentKind,
): { policyBlockReasons: string[]; policyEvaluationKeys: string[] } {
  const state = policy.agentStates.find((row) => row.agentKind === agentKind)
  if (!state || state.enabled) {
    return { policyBlockReasons: [], policyEvaluationKeys: [] }
  }
  return {
    policyBlockReasons: [state.disabledReason ?? "Agent blocked by autonomy policy."],
    policyEvaluationKeys: [state.policyEvaluation],
  }
}

function annotateOrchestrationWithPolicy(
  record: RevenueOperatorOrchestrationRecord,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): RevenueOperatorOrchestrationRecord {
  const globalBlocks: string[] = []
  const globalKeys: string[] = []

  if (policy.emergencyStopActive) {
    globalBlocks.push("Emergency stop active — configure in Growth Autonomy.")
    globalKeys.push("emergency_stop")
  } else if (!policy.autonomyEnabled) {
    globalBlocks.push("Autonomy disabled by platform policy.")
    globalKeys.push("autonomy_disabled")
  }

  const agentBlocks = resolveAgentPolicyBlocks(policy, record.recommendedNextAgent)

  if (
    record.currentLifecycleStage === "execution" &&
    !policy.runtimeEnabled &&
    record.recommendedNextAgent === "execution_agent"
  ) {
    globalBlocks.push("Execution runtime disabled by autonomy policy.")
    globalKeys.push("runtime_disabled")
  }

  const policyBlockReasons = [...new Set([...globalBlocks, ...agentBlocks.policyBlockReasons])]
  const policyEvaluationKeys = [...new Set([...globalKeys, ...agentBlocks.policyEvaluationKeys])]

  if (policyBlockReasons.length === 0) {
    return record
  }

  return {
    ...record,
    policyBlockReasons,
    policyEvaluationKeys,
    blockedReasons: [...new Set([...record.blockedReasons, ...policyBlockReasons])],
  }
}

function evaluateAgentPolicyState(input: {
  agentKind: GrowthAgentKind
  settings: GrowthAutonomySettingsSnapshot
}): GrowthAiOsAgentAutonomyPolicyState {
  const capability = AGENT_CAPABILITY_MAP[input.agentKind]
  const permissions = AGENT_PERMISSION_PROFILES[input.agentKind]
  const kill = input.settings.killSwitches

  if (!kill.autonomyEnabled) {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: "Autonomy disabled by platform kill switch.",
      policyEvaluation: "blocked:autonomy_kill_switch",
      effectivePermissions: ["read_only"],
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  if (input.settings.masterMode === "manual") {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: "Manual operating mode — agent wake requires operator action.",
      policyEvaluation: "blocked:manual_mode",
      effectivePermissions: ["read_only"],
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  if (input.agentKind === "outreach_agent" && !kill.autonomyGenerationEnabled) {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: "Generation kill switch off — outreach preparation blocked.",
      policyEvaluation: "blocked:generation_kill_switch",
      effectivePermissions: ["read_only"],
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  if (input.agentKind === "meeting_agent" && !kill.autonomyGenerationEnabled) {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: "Generation kill switch off — meeting preparation blocked.",
      policyEvaluation: "blocked:generation_kill_switch",
      effectivePermissions: ["read_only"],
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  if (capability && !input.settings.capabilityToggles[capability]) {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: `${capability.replaceAll("_", " ")} capability toggle is off.`,
      policyEvaluation: `blocked:capability_${capability}`,
      effectivePermissions: ["read_only"],
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  if (
    capability &&
    ["page_generation", "video_generation"].includes(capability) &&
    !kill.autonomyGenerationEnabled
  ) {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: "Generation kill switch is off.",
      policyEvaluation: "blocked:generation_kill_switch",
      effectivePermissions: ["read_only"],
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  if (input.settings.masterMode === "objective" && !kill.autonomyObjectiveModeEnabled) {
    return {
      agentKind: input.agentKind,
      enabled: false,
      disabledReason: "Objective mode requires objective mode kill switch.",
      policyEvaluation: "blocked:objective_kill_switch",
      effectivePermissions: permissions,
      linkedCapability: capability,
      requiresHumanApproval: true,
    }
  }

  return {
    agentKind: input.agentKind,
    enabled: true,
    disabledReason: null,
    policyEvaluation: `allowed:${input.settings.masterMode}`,
    effectivePermissions: permissions,
    linkedCapability: capability,
    requiresHumanApproval: input.settings.masterMode !== "objective",
  }
}

export function buildGrowthAiOsAutonomyPolicyReadModel(
  input: GrowthAiOsAutonomyPolicyBuildInput,
): GrowthAiOsAutonomyPolicyReadModel {
  const kill = input.settings.killSwitches
  const autonomyEnabled = kill.autonomyEnabled
  const emergencyStopActive = !autonomyEnabled
  const agentStates = GROWTH_AGENT_KINDS.map((agentKind) =>
    evaluateAgentPolicyState({ agentKind, settings: input.settings }),
  )
  const enabledAgents = agentStates.filter((state) => state.enabled).map((state) => state.agentKind)
  const researchAutonomyEnabled = agentStates.find((s) => s.agentKind === "research_agent")?.enabled ?? false
  const qualificationAutonomyEnabled =
    agentStates.find((s) => s.agentKind === "qualification_agent")?.enabled ?? false
  const planningAutonomyEnabled = agentStates.find((s) => s.agentKind === "planning_agent")?.enabled ?? false
  const executionAgentEnabled = agentStates.find((s) => s.agentKind === "execution_agent")?.enabled ?? false
  const executionAutonomyEnabled =
    executionAgentEnabled && input.runtimeEnabled && input.runtimePilotEnabled && autonomyEnabled
  const outreachAgentEnabled = agentStates.find((s) => s.agentKind === "outreach_agent")?.enabled ?? false
  const outreachAutonomyEnabled =
    outreachAgentEnabled && autonomyEnabled && kill.autonomyGenerationEnabled
  const meetingAgentEnabled = agentStates.find((s) => s.agentKind === "meeting_agent")?.enabled ?? false
  const meetingAutonomyEnabled =
    meetingAgentEnabled && autonomyEnabled && kill.autonomyGenerationEnabled

  const activeAutonomousAgents = enabledAgents.filter((kind) =>
    [
      "research_agent",
      "qualification_agent",
      "planning_agent",
      "execution_agent",
      "outreach_agent",
      "meeting_agent",
      "revenue_operator_agent",
    ].includes(kind),
  )

  const dailyBudgets = Object.entries(input.budgetRemaining ?? {}).map(([resourceKey, snapshot]) => ({
    resourceKey,
    label: GROWTH_AUTONOMY_BUDGET_LABELS[resourceKey as keyof typeof GROWTH_AUTONOMY_BUDGET_LABELS] ?? resourceKey,
    dailyCap: snapshot.cap,
    remaining: snapshot.remaining,
    exceeded: snapshot.exceeded,
  }))

  const telemetry = input.researchPilotTelemetry ?? {
    budgetConsumptionHour: 0,
    budgetConsumptionDay: 0,
  }
  const qualificationTelemetry = input.qualificationPilotTelemetry ?? {
    budgetConsumptionHour: 0,
    budgetConsumptionDay: 0,
  }
  const planningTelemetry = input.planningPilotTelemetry ?? {
    budgetConsumptionHour: 0,
    budgetConsumptionDay: 0,
  }
  const executionTelemetry = input.executionPilotTelemetry ?? {
    budgetConsumptionHour: 0,
    budgetConsumptionDay: 0,
  }
  const outreachTelemetry = input.outreachPreparationPilotTelemetry ?? {
    budgetConsumptionHour: 0,
    budgetConsumptionDay: 0,
  }
  const meetingTelemetry = input.meetingPilotTelemetry ?? {
    budgetConsumptionHour: 0,
    budgetConsumptionDay: 0,
  }

  return {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER,
    generatedAt: input.generatedAt,
    organizationId: input.organizationId,
    controlPlaneHref: GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH,
    operatingMode: input.settings.masterMode,
    operatingModeLabel: GROWTH_AUTONOMY_MASTER_MODE_LABELS[input.settings.masterMode],
    schedulerMode: resolveSchedulerModeFromOperatingMode(input.settings.masterMode, autonomyEnabled),
    emergencyStopActive,
    safeModeActive: emergencyStopActive || !autonomyEnabled,
    shadowModeEnabled: input.settings.outboundControls.shadowModeEnabled,
    runtimeEnabled: input.runtimeEnabled && autonomyEnabled,
    runtimePilotEnabled: input.runtimePilotEnabled && autonomyEnabled,
    outboundEnabled: kill.autonomyOutboundEnabled,
    researchAutonomyEnabled,
    qualificationAutonomyEnabled,
    planningAutonomyEnabled,
    executionAutonomyEnabled,
    outreachAutonomyEnabled,
    meetingAutonomyEnabled,
    autonomyEnabled,
    humanApprovalRequired: input.settings.masterMode !== "objective",
    killSwitches: kill,
    enabledAgents,
    activeAutonomousAgents,
    agentStates,
    dailyBudgets,
    hourlyBudgets: {
      researchRunsPerHour: GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour,
      researchRunsPerDay: GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerDay,
      researchHourlyConsumed: telemetry.budgetConsumptionHour,
      researchDailyConsumed: telemetry.budgetConsumptionDay,
      qualificationRunsPerHour: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour,
      qualificationRunsPerDay: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerDay,
      qualificationHourlyConsumed: qualificationTelemetry.budgetConsumptionHour,
      qualificationDailyConsumed: qualificationTelemetry.budgetConsumptionDay,
      planningRunsPerHour: GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour,
      planningRunsPerDay: GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerDay,
      planningHourlyConsumed: planningTelemetry.budgetConsumptionHour,
      planningDailyConsumed: planningTelemetry.budgetConsumptionDay,
      executionRunsPerHour: GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour,
      executionRunsPerDay: GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerDay,
      executionHourlyConsumed: executionTelemetry.budgetConsumptionHour,
      executionDailyConsumed: executionTelemetry.budgetConsumptionDay,
      outreachRunsPerHour: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour,
      outreachRunsPerDay: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerDay,
      outreachHourlyConsumed: outreachTelemetry.budgetConsumptionHour,
      outreachDailyConsumed: outreachTelemetry.budgetConsumptionDay,
      meetingRunsPerHour: GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerHour,
      meetingRunsPerDay: GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerDay,
      meetingHourlyConsumed: meetingTelemetry.budgetConsumptionHour,
      meetingDailyConsumed: meetingTelemetry.budgetConsumptionDay,
    },
    throttleSummary: `${GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour}/hr · ${GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerDay}/day research · ${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerHour}/hr · ${GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET.maxRunsPerDay}/day qualification · ${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerHour}/hr · ${GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET.maxRunsPerDay}/day planning · ${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerHour}/hr · ${GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET.maxRunsPerDay}/day execution · ${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour}/hr · ${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerDay}/day outreach prep`,
    cooldownSummary: "Scheduler cooldown rules derived from 5A readiness plan (inactive in this phase).",
    approvalSummary: input.settings.masterMode === "objective"
      ? "Objective mode — conditional approvals apply."
      : "Human approval required for execution plans and Work Orders.",
  }
}

export function enrichAgentFrameworkWithAutonomyPolicy(
  framework: GrowthAgentFrameworkReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAgentFrameworkReadModel {
  return {
    ...framework,
    agentAutonomyPolicy: policy.agentStates,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function enrichSchedulerReadinessWithAutonomyPolicy(
  readiness: GrowthSchedulerReadinessReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthSchedulerReadinessReadModel {
  const killSwitchStatus = buildSchedulerKillSwitchStatusFromPolicy(policy)
  const budgetLimits = buildSchedulerBudgetLimitsFromPolicy(policy)
  const throttleRules = buildSchedulerThrottleRulesFromPolicy(policy)
  const policyBlockedReasons = [
    ...readiness.readiness.blockedReasons,
    ...(policy.emergencyStopActive ? ["Emergency stop active — configure in Growth Autonomy."] : []),
    ...(!policy.autonomyEnabled ? ["Autonomy disabled — enable in Growth Autonomy."] : []),
    ...(policy.schedulerMode === "disabled"
      ? [`Operating mode ${policy.operatingModeLabel} — scheduler remains inactive.`]
      : []),
  ]

  return {
    ...readiness,
    autonomyPolicySource: policy.qaMarker,
    policySchedulerMode: policy.schedulerMode,
    readiness: {
      ...readiness.readiness,
      schedulerMode: policy.schedulerMode,
      killSwitchStatus,
      budgetLimits,
      throttleRules,
      blockedReasons: [...new Set(policyBlockedReasons)],
      enabledAgents: policy.enabledAgents.filter((agent) =>
        readiness.agentWakeRules.some((rule) => rule.agentKind === agent),
      ),
    },
    summary: {
      ...readiness.summary,
      schedulerMode: policy.schedulerMode,
      blockedReasonCount: [...new Set(policyBlockedReasons)].length,
    },
  }
}

export function deriveResearchPilotControlFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  storedControlState: GrowthAutonomousResearchPilotReadModel["controlState"],
): GrowthAutonomousResearchPilotReadModel["controlState"] {
  if (!policy.researchAutonomyEnabled || policy.emergencyStopActive) return "disabled"
  if (storedControlState === "paused") return "paused"
  return "active"
}

export function enrichAutonomousResearchPilotWithAutonomyPolicy(
  pilot: GrowthAutonomousResearchPilotReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAutonomousResearchPilotReadModel {
  const effectiveControlState = deriveResearchPilotControlFromPolicy(policy, pilot.controlState)
  const enabled = effectiveControlState === "active"

  return {
    ...pilot,
    controlState: effectiveControlState,
    enabled,
    policyDerived: true,
    configureHref: policy.controlPlaneHref,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function buildRevenueOperatorPolicyAwareness(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  orchestrations: RevenueOperatorOrchestrationRecord[],
): GrowthAiOsRevenueOperatorPolicyAwareness {
  const blockedByPolicyCount = orchestrations.filter(
    (row) =>
      row.orchestrationDecision === "blocked" ||
      row.orchestrationDecision === "human_review_required" ||
      row.blockedReasons.length > 0,
  ).length

  const suggestions: GrowthAiOsRevenueOperatorPolicyAwareness["policySuggestions"] = []

  if (!policy.autonomyEnabled) {
    suggestions.push({
      id: "enable-autonomy",
      summary: "Enable autonomy in Growth Autonomy to allow Revenue Operator handoffs.",
      configureHref: policy.controlPlaneHref,
    })
  }

  if (!policy.researchAutonomyEnabled) {
    suggestions.push({
      id: "enable-research",
      summary: "Turn on the research capability to unblock Research Agent orchestration.",
      configureHref: policy.controlPlaneHref,
    })
  }

  if (policy.shadowModeEnabled) {
    suggestions.push({
      id: "shadow-mode",
      summary: "Shadow mode is on — outbound actions log only until send is enabled.",
      configureHref: policy.controlPlaneHref,
    })
  }

  return {
    policySourceQaMarker: policy.qaMarker,
    operatingMode: policy.operatingMode,
    autonomyEnabled: policy.autonomyEnabled,
    blockedByPolicyCount,
    policySuggestions: suggestions,
  }
}

export function enrichRevenueOperatorWithAutonomyPolicy(
  model: RevenueOperatorReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): RevenueOperatorReadModel {
  const orchestrations = model.orchestrations.map((row) => annotateOrchestrationWithPolicy(row, policy))
  return {
    ...model,
    autonomyPolicySource: policy.qaMarker,
    orchestrations,
    autonomyPolicyAwareness: buildRevenueOperatorPolicyAwareness(policy, orchestrations),
  }
}

export function evaluateRuntimeAutonomyPolicyGate(
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  if (policy.emergencyStopActive) {
    return {
      allowed: false,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      policyKey: "emergency_stop",
    }
  }

  if (!policy.autonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Autonomy disabled by platform policy.",
      policyKey: "autonomy_disabled",
    }
  }

  if (!policy.runtimeEnabled) {
    return {
      allowed: false,
      blockReason: "Execution runtime disabled by autonomy policy.",
      policyKey: "runtime_disabled",
    }
  }

  const executionAgent = policy.agentStates.find((state) => state.agentKind === "execution_agent")
  if (executionAgent && !executionAgent.enabled) {
    return {
      allowed: false,
      blockReason: executionAgent.disabledReason ?? "Execution agent blocked by policy.",
      policyKey: executionAgent.policyEvaluation,
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function evaluateQualificationPilotAutonomyPolicyGate(
  context: GrowthAiOsAutonomyPolicyEvaluationContext,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  const { policy } = context

  if (policy.emergencyStopActive) {
    return {
      allowed: false,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      policyKey: "emergency_stop",
    }
  }

  if (!policy.autonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Autonomy disabled by platform policy.",
      policyKey: "autonomy_disabled",
    }
  }

  if (!policy.qualificationAutonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Qualification autonomy disabled — enable enrichment capability in Growth Autonomy.",
      policyKey: "qualification_autonomy_disabled",
    }
  }

  const qualificationAgent = policy.agentStates.find((state) => state.agentKind === "qualification_agent")
  if (qualificationAgent && !qualificationAgent.enabled) {
    return {
      allowed: false,
      blockReason: qualificationAgent.disabledReason ?? "Qualification agent blocked by policy.",
      policyKey: qualificationAgent.policyEvaluation,
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function deriveQualificationPilotControlFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  storedControlState: GrowthAutonomousQualificationPilotReadModel["controlState"],
): GrowthAutonomousQualificationPilotReadModel["controlState"] {
  if (!policy.qualificationAutonomyEnabled || policy.emergencyStopActive) return "disabled"
  if (storedControlState === "paused") return "paused"
  return "active"
}

export function enrichAutonomousQualificationPilotWithAutonomyPolicy(
  pilot: GrowthAutonomousQualificationPilotReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAutonomousQualificationPilotReadModel {
  const effectiveControlState = deriveQualificationPilotControlFromPolicy(policy, pilot.controlState)
  const enabled = effectiveControlState === "active"

  return {
    ...pilot,
    controlState: effectiveControlState,
    enabled,
    policyDerived: true,
    configureHref: policy.controlPlaneHref,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function evaluatePlanningPilotAutonomyPolicyGate(
  context: GrowthAiOsAutonomyPolicyEvaluationContext,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  const { policy } = context

  if (policy.emergencyStopActive) {
    return {
      allowed: false,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      policyKey: "emergency_stop",
    }
  }

  if (!policy.autonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Autonomy disabled by platform policy.",
      policyKey: "autonomy_disabled",
    }
  }

  if (!policy.planningAutonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Planning autonomy disabled — enable recommendations capability in Growth Autonomy.",
      policyKey: "planning_autonomy_disabled",
    }
  }

  const planningAgent = policy.agentStates.find((state) => state.agentKind === "planning_agent")
  if (planningAgent && !planningAgent.enabled) {
    return {
      allowed: false,
      blockReason: planningAgent.disabledReason ?? "Planning agent blocked by policy.",
      policyKey: planningAgent.policyEvaluation,
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function derivePlanningPilotControlFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  storedControlState: GrowthAutonomousPlanningPilotReadModel["controlState"],
): GrowthAutonomousPlanningPilotReadModel["controlState"] {
  if (!policy.planningAutonomyEnabled || policy.emergencyStopActive) return "disabled"
  if (storedControlState === "paused") return "paused"
  return "active"
}

export function enrichAutonomousPlanningPilotWithAutonomyPolicy(
  pilot: GrowthAutonomousPlanningPilotReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAutonomousPlanningPilotReadModel {
  const effectiveControlState = derivePlanningPilotControlFromPolicy(policy, pilot.controlState)
  const enabled = effectiveControlState === "active"

  return {
    ...pilot,
    controlState: effectiveControlState,
    enabled,
    policyDerived: true,
    configureHref: policy.controlPlaneHref,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function evaluateExecutionPilotAutonomyPolicyGate(
  context: GrowthAiOsAutonomyPolicyEvaluationContext,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  const { policy } = context
  const runtimeGate = evaluateRuntimeAutonomyPolicyGate(policy)

  if (!runtimeGate.allowed) {
    return runtimeGate
  }

  if (!policy.executionAutonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Execution autonomy disabled — enable task creation capability and runtime pilot in Growth Autonomy.",
      policyKey: "execution_autonomy_disabled",
    }
  }

  if (!policy.runtimePilotEnabled) {
    return {
      allowed: false,
      blockReason: "Runtime pilot disabled by autonomy policy.",
      policyKey: "runtime_pilot_disabled",
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function deriveExecutionPilotControlFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  storedControlState: GrowthAutonomousExecutionPilotReadModel["controlState"],
): GrowthAutonomousExecutionPilotReadModel["controlState"] {
  if (!policy.executionAutonomyEnabled || policy.emergencyStopActive) return "disabled"
  if (storedControlState === "paused") return "paused"
  return "active"
}

export function enrichAutonomousExecutionPilotWithAutonomyPolicy(
  pilot: GrowthAutonomousExecutionPilotReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAutonomousExecutionPilotReadModel {
  const effectiveControlState = deriveExecutionPilotControlFromPolicy(policy, pilot.controlState)
  const enabled = effectiveControlState === "active"

  return {
    ...pilot,
    controlState: effectiveControlState,
    enabled,
    policyDerived: true,
    configureHref: policy.controlPlaneHref,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function evaluateOutreachPreparationPilotAutonomyPolicyGate(
  context: GrowthAiOsAutonomyPolicyEvaluationContext,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  const { policy } = context

  if (policy.emergencyStopActive) {
    return {
      allowed: false,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      policyKey: "emergency_stop",
    }
  }

  if (!policy.autonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Autonomy disabled by platform policy.",
      policyKey: "autonomy_disabled",
    }
  }

  if (!policy.outreachAutonomyEnabled) {
    return {
      allowed: false,
      blockReason:
        "Outreach preparation autonomy disabled — enable email execution capability and generation in Growth Autonomy.",
      policyKey: "outreach_autonomy_disabled",
    }
  }

  const outreachAgent = policy.agentStates.find((state) => state.agentKind === "outreach_agent")
  if (outreachAgent && !outreachAgent.enabled) {
    return {
      allowed: false,
      blockReason: outreachAgent.disabledReason ?? "Outreach agent blocked by policy.",
      policyKey: outreachAgent.policyEvaluation,
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function deriveOutreachPreparationPilotControlFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  storedControlState: GrowthAutonomousOutreachPreparationPilotReadModel["controlState"],
): GrowthAutonomousOutreachPreparationPilotReadModel["controlState"] {
  if (!policy.outreachAutonomyEnabled || policy.emergencyStopActive) return "disabled"
  if (storedControlState === "paused") return "paused"
  return "active"
}

export function enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy(
  pilot: GrowthAutonomousOutreachPreparationPilotReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAutonomousOutreachPreparationPilotReadModel {
  const effectiveControlState = deriveOutreachPreparationPilotControlFromPolicy(policy, pilot.controlState)
  const enabled = effectiveControlState === "active"

  return {
    ...pilot,
    controlState: effectiveControlState,
    enabled,
    policyDerived: true,
    configureHref: policy.controlPlaneHref,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function evaluateMeetingPilotAutonomyPolicyGate(
  context: GrowthAiOsAutonomyPolicyEvaluationContext,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  const { policy } = context

  if (policy.emergencyStopActive) {
    return {
      allowed: false,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      policyKey: "emergency_stop",
    }
  }

  if (!policy.autonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Autonomy disabled by platform policy.",
      policyKey: "autonomy_disabled",
    }
  }

  if (!policy.meetingAutonomyEnabled) {
    return {
      allowed: false,
      blockReason:
        "Meeting preparation autonomy disabled — enable task creation capability and generation in Growth Autonomy.",
      policyKey: "meeting_autonomy_disabled",
    }
  }

  const meetingAgent = policy.agentStates.find((state) => state.agentKind === "meeting_agent")
  if (meetingAgent && !meetingAgent.enabled) {
    return {
      allowed: false,
      blockReason: meetingAgent.disabledReason ?? "Meeting agent blocked by policy.",
      policyKey: meetingAgent.policyEvaluation,
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function deriveMeetingPilotControlFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  storedControlState: GrowthAutonomousMeetingPilotReadModel["controlState"],
): GrowthAutonomousMeetingPilotReadModel["controlState"] {
  if (!policy.meetingAutonomyEnabled || policy.emergencyStopActive) return "disabled"
  if (storedControlState === "paused") return "paused"
  return "active"
}

export function enrichAutonomousMeetingPilotWithAutonomyPolicy(
  pilot: GrowthAutonomousMeetingPilotReadModel,
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAutonomousMeetingPilotReadModel {
  const effectiveControlState = deriveMeetingPilotControlFromPolicy(policy, pilot.controlState)
  const enabled = effectiveControlState === "active"

  return {
    ...pilot,
    controlState: effectiveControlState,
    enabled,
    policyDerived: true,
    configureHref: policy.controlPlaneHref,
    autonomyPolicySource: policy.qaMarker,
  }
}

export function evaluateResearchPilotAutonomyPolicyGate(
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAiOsAutonomyPolicyRuntimeGate {
  if (policy.emergencyStopActive) {
    return {
      allowed: false,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      policyKey: "emergency_stop",
    }
  }

  if (!policy.autonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Autonomy disabled by platform policy.",
      policyKey: "autonomy_disabled",
    }
  }

  if (!policy.researchAutonomyEnabled) {
    return {
      allowed: false,
      blockReason: "Research autonomy disabled — enable research capability in Growth Autonomy.",
      policyKey: "research_autonomy_disabled",
    }
  }

  const researchAgent = policy.agentStates.find((state) => state.agentKind === "research_agent")
  if (researchAgent && !researchAgent.enabled) {
    return {
      allowed: false,
      blockReason: researchAgent.disabledReason ?? "Research agent blocked by policy.",
      policyKey: researchAgent.policyEvaluation,
    }
  }

  return { allowed: true, blockReason: null, policyKey: null }
}

export function buildAutonomyPolicyIntegrationSummary(
  policy: GrowthAiOsAutonomyPolicyReadModel,
): GrowthAiOsAutonomyPolicyIntegrationSummary {
  return {
    schedulerReadinessLabel: `${policy.schedulerMode.replaceAll("_", " ")} · ${policy.enabledAgents.length} agent(s) enabled`,
    agentFrameworkLabel: `${policy.enabledAgents.length}/${policy.agentStates.length} agents policy-enabled`,
    researchPilotLabel: policy.researchAutonomyEnabled ? "Research autonomy allowed" : "Research autonomy blocked",
    qualificationPilotLabel: policy.qualificationAutonomyEnabled
      ? "Qualification autonomy allowed"
      : "Qualification autonomy blocked",
    planningPilotLabel: policy.planningAutonomyEnabled
      ? "Planning autonomy allowed"
      : "Planning autonomy blocked",
    executionPilotLabel: policy.executionAutonomyEnabled
      ? "Execution autonomy allowed"
      : "Execution autonomy blocked",
    outreachPilotLabel: policy.outreachAutonomyEnabled
      ? "Outreach preparation allowed"
      : "Outreach preparation blocked",
    meetingPilotLabel: policy.meetingAutonomyEnabled
      ? "Meeting preparation allowed"
      : "Meeting preparation blocked",
    activeAutonomousAgentCount: policy.activeAutonomousAgents.length,
    operationsDashboardHref: "/growth/os",
  }
}

export function resolveEffectiveResearchCapabilityEnabled(
  settings: GrowthAutonomySettingsSnapshot,
): boolean {
  return evaluateAgentPolicyState({ agentKind: "research_agent", settings }).enabled
}

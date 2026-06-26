/** GE-AIOS-CONSOLIDATION-1C — Unified AI OS Autonomy Policy types (client-safe). */

import type { GrowthAgentKind, GrowthAgentPermissionProfile } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyMasterMode,
  GrowthAutonomySettingsSnapshot,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export const GROWTH_AIOS_CONSOLIDATION_1C_PHASE = "GE-AIOS-CONSOLIDATION-1C" as const

export const GROWTH_AIOS_CONSOLIDATION_1E_PHASE = "GE-AIOS-CONSOLIDATION-1E" as const

export const GROWTH_AI_OS_AUTONOMY_POLICY_EVALUATION_RULE =
  "All autonomous policy decisions evaluate through fetchGrowthAiOsAutonomyPolicyEvaluationContext — legacy evaluators are compatibility wrappers only." as const

export const GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER =
  "growth-aios-consolidation-1c-autonomy-policy-v1" as const

export const GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH = "/growth/settings/autonomy" as const

export const GROWTH_AI_OS_AUTONOMY_POLICY_RULE =
  "Growth Autonomy is the canonical AI control plane — all autonomous subsystems evaluate this read-through policy layer before acting. No duplicate configuration surfaces." as const

export type GrowthAiOsAutonomyPolicyBudgetSnapshot = {
  resourceKey: string
  label: string
  dailyCap: number
  remaining: number
  exceeded: boolean
}

export type GrowthAiOsAgentAutonomyPolicyState = {
  agentKind: GrowthAgentKind
  enabled: boolean
  disabledReason: string | null
  policyEvaluation: string
  effectivePermissions: GrowthAgentPermissionProfile[]
  linkedCapability: GrowthAutonomyCapability | null
  requiresHumanApproval: boolean
}

export type GrowthAiOsAutonomyPolicyReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER
  generatedAt: string
  organizationId: string
  controlPlaneHref: typeof GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH
  operatingMode: GrowthAutonomyMasterMode
  operatingModeLabel: string
  schedulerMode: GrowthSchedulerMode
  emergencyStopActive: boolean
  safeModeActive: boolean
  shadowModeEnabled: boolean
  runtimeEnabled: boolean
  runtimePilotEnabled: boolean
  outboundEnabled: boolean
  researchAutonomyEnabled: boolean
  autonomyEnabled: boolean
  humanApprovalRequired: boolean
  killSwitches: {
    autonomyEnabled: boolean
    autonomyOutboundEnabled: boolean
    autonomyGenerationEnabled: boolean
    autonomyObjectiveModeEnabled: boolean
  }
  enabledAgents: GrowthAgentKind[]
  activeAutonomousAgents: GrowthAgentKind[]
  agentStates: GrowthAiOsAgentAutonomyPolicyState[]
  dailyBudgets: GrowthAiOsAutonomyPolicyBudgetSnapshot[]
  hourlyBudgets: {
    researchRunsPerHour: number
    researchRunsPerDay: number
    researchHourlyConsumed: number
    researchDailyConsumed: number
  }
  throttleSummary: string
  cooldownSummary: string
  approvalSummary: string
}

export type GrowthAiOsAutonomyPolicyRuntimeGate = {
  allowed: boolean
  blockReason: string | null
  policyKey: string | null
}

export type GrowthAiOsRevenueOperatorPolicyAwareness = {
  policySourceQaMarker: typeof GROWTH_AI_OS_AUTONOMY_POLICY_QA_MARKER
  operatingMode: GrowthAutonomyMasterMode
  autonomyEnabled: boolean
  blockedByPolicyCount: number
  policySuggestions: Array<{
    id: string
    summary: string
    configureHref: typeof GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH
  }>
}

export type GrowthAiOsAutonomyPolicyIntegrationSummary = {
  schedulerReadinessLabel: string
  agentFrameworkLabel: string
  researchPilotLabel: string
  activeAutonomousAgentCount: number
  operationsDashboardHref: string
}

/** Server evaluation bundle — settings snapshot used to build policy (GE-AIOS-CONSOLIDATION-1E). */
export type GrowthAiOsAutonomyPolicyEvaluationContext = {
  policy: GrowthAiOsAutonomyPolicyReadModel
  settings: GrowthAutonomySettingsSnapshot
}

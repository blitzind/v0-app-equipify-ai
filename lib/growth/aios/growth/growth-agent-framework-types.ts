/** GE-AIOS-GROWTH-4A — Growth Agent Framework types (client-safe). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthAiOsAgentAutonomyPolicyState } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"

export const GROWTH_AIOS_GROWTH_4A_PHASE = "GE-AIOS-GROWTH-4A" as const

export const GROWTH_AGENT_FRAMEWORK_QA_MARKER = "growth-aios-growth-4a-agent-framework-v1" as const

export const GROWTH_AGENT_FRAMEWORK_RULE =
  "Agent framework is read-only in 4A — agents decide what should happen; execution runtime decides whether it is allowed. No autonomous execution, outbound, providers, Work Orders, or Core mutations." as const

export const GROWTH_AGENT_KINDS = [
  "research_agent",
  "qualification_agent",
  "planning_agent",
  "execution_agent",
  "outreach_agent",
  "meeting_agent",
  "revenue_operator_agent",
] as const

export type GrowthAgentKind = (typeof GROWTH_AGENT_KINDS)[number]

export const GROWTH_AGENT_STATUSES = [
  "disabled",
  "idle",
  "scheduled",
  "running",
  "paused",
  "blocked",
  "failed",
] as const

export type GrowthAgentStatus = (typeof GROWTH_AGENT_STATUSES)[number]

export const GROWTH_AGENT_PERMISSION_PROFILES = [
  "read_only",
  "planning_only",
  "internal_mutation",
  "outbound_requires_approval",
  "core_requires_explicit_approval",
  "supervisor",
] as const

export type GrowthAgentPermissionProfile = (typeof GROWTH_AGENT_PERMISSION_PROFILES)[number]

export const GROWTH_AGENT_SCHEDULER_MODES = [
  "manual",
  "hourly",
  "daily",
  "event_driven",
  "disabled",
] as const

export type GrowthAgentSchedulerMode = (typeof GROWTH_AGENT_SCHEDULER_MODES)[number]

export const GROWTH_AGENT_RUN_STATUSES = [
  "run_preview",
  "run_blocked",
  "run_ready_for_dry_run",
  "run_ready_for_internal_runtime",
  "run_not_allowed",
] as const

export type GrowthAgentRunStatus = (typeof GROWTH_AGENT_RUN_STATUSES)[number]

export const GROWTH_AGENT_REQUIRED_GATES = [
  "approval",
  "readiness",
  "handoff",
  "preflight",
  "boundary",
  "dry_run",
  "runtime_pilot",
  "operator_approval",
] as const

export type GrowthAgentRequiredGate = (typeof GROWTH_AGENT_REQUIRED_GATES)[number]

export type GrowthAgentCapabilityFlags = {
  definitionOnly: boolean
  dryRunEligible: boolean
  internalRuntimeEligible: boolean
  outboundBlocked: boolean
  coreMutationBlocked: boolean
  directExecutionAllowed: boolean
}

export type GrowthAgentBudgetProfile = {
  profileId: string
  dailyTokenCap: number | null
  perRunTokenCap: number | null
  requiresApprovalAbove: number | null
}

export type GrowthAgentTelemetry = {
  runCount: number
  lastRunAt: string | null
  lastStatus: GrowthAgentRunStatus | null
  blockedCount: number
  failureCount: number
  averageConfidence: number | null
  estimatedCost: number
  approvalCount: number
  outboundAttemptedCount: number
  providerCallCount: number
  coreMutationCount: number
}

export type GrowthAgentDefinition = {
  agentId: string
  agentKind: GrowthAgentKind
  agentName: string
  description: string
  status: GrowthAgentStatus
  allowedWorkflowTypes: GrowthLeadResearchCanonicalWorkflowType[]
  permissionProfile: GrowthAgentPermissionProfile
  runtimeBoundaryRequirements: string[]
  requiredFeatureFlags: string[]
  requiredKillSwitches: string[]
  budgetProfile: GrowthAgentBudgetProfile
  approvalRequirements: string[]
  schedulerMode: GrowthAgentSchedulerMode
  capabilities: GrowthAgentCapabilityFlags
  blockedCapabilities: string[]
  lastRunSummary: string | null
  healthStatus: "healthy" | "degraded" | "offline"
  telemetry: GrowthAgentTelemetry
}

export type GrowthAgentRunContract = {
  runId: string
  agentId: string
  agentKind: GrowthAgentKind
  requestedAction: string
  targetLeadId: string | null
  targetCompanyName: string | null
  targetWorkflowType: GrowthLeadResearchCanonicalWorkflowType | null
  inputContext: Record<string, unknown>
  permissionProfile: GrowthAgentPermissionProfile
  requiredGates: GrowthAgentRequiredGate[]
  expectedOutputs: string[]
  blockedReasons: string[]
  runStatus: GrowthAgentRunStatus
  generatedAt: string
}

export type GrowthAgentFrameworkReadModel = {
  qaMarker: typeof GROWTH_AGENT_FRAMEWORK_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AGENT_FRAMEWORK_RULE
  schedulerActive: false
  agents: GrowthAgentDefinition[]
  summary: {
    totalAgents: number
    disabledAgents: number
    definitionOnlyAgents: number
    dryRunEligibleAgents: number
    internalRuntimeEligibleAgents: number
    outboundBlockedAgents: number
    coreMutationBlockedAgents: number
  }
  agentAutonomyPolicy?: GrowthAiOsAgentAutonomyPolicyState[]
  autonomyPolicySource?: string
}

export type GrowthAgentPlanContext = {
  owningAgentKind: GrowthAgentKind
  owningAgentName: string
  agentAllowed: boolean
  agentSummary: string
  requiredGates: GrowthAgentRequiredGate[]
  blockedReasons: string[]
  permissionProfile: GrowthAgentPermissionProfile
  runContractPreview: Pick<
    GrowthAgentRunContract,
    "runStatus" | "blockedReasons" | "requiredGates" | "requestedAction"
  >
}

export const ZERO_AGENT_TELEMETRY: GrowthAgentTelemetry = {
  runCount: 0,
  lastRunAt: null,
  lastStatus: null,
  blockedCount: 0,
  failureCount: 0,
  averageConfidence: null,
  estimatedCost: 0,
  approvalCount: 0,
  outboundAttemptedCount: 0,
  providerCallCount: 0,
  coreMutationCount: 0,
}

export function isGrowthAgentKind(value: string): value is GrowthAgentKind {
  return GROWTH_AGENT_KINDS.includes(value as GrowthAgentKind)
}

export function agentKindToAgentId(kind: GrowthAgentKind): string {
  return `growth-agent:${kind}`
}

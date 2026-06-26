/** GE-AIOS-GROWTH-4A — Deterministic Growth Agent registry (client-safe, read-only). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import {
  agentKindToAgentId,
  type GrowthAgentBudgetProfile,
  type GrowthAgentCapabilityFlags,
  type GrowthAgentDefinition,
  type GrowthAgentKind,
  type GrowthAgentPermissionProfile,
  type GrowthAgentSchedulerMode,
  ZERO_AGENT_TELEMETRY,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"

const DEFAULT_BUDGET: GrowthAgentBudgetProfile = {
  profileId: "growth-agent-default",
  dailyTokenCap: null,
  perRunTokenCap: null,
  requiresApprovalAbove: null,
}

const DEFINITION_ONLY_CAPABILITIES: GrowthAgentCapabilityFlags = {
  definitionOnly: true,
  dryRunEligible: false,
  internalRuntimeEligible: false,
  outboundBlocked: true,
  coreMutationBlocked: true,
  directExecutionAllowed: false,
}

function buildAgentDefinition(input: {
  agentKind: GrowthAgentKind
  agentName: string
  description: string
  allowedWorkflowTypes: GrowthLeadResearchCanonicalWorkflowType[]
  permissionProfile: GrowthAgentPermissionProfile
  runtimeBoundaryRequirements: string[]
  requiredFeatureFlags: string[]
  schedulerMode?: GrowthAgentSchedulerMode
  capabilities: GrowthAgentCapabilityFlags
  blockedCapabilities: string[]
  approvalRequirements: string[]
  lastRunSummary?: string | null
}): GrowthAgentDefinition {
  return {
    agentId: agentKindToAgentId(input.agentKind),
    agentKind: input.agentKind,
    agentName: input.agentName,
    description: input.description,
    status: "disabled",
    allowedWorkflowTypes: input.allowedWorkflowTypes,
    permissionProfile: input.permissionProfile,
    runtimeBoundaryRequirements: input.runtimeBoundaryRequirements,
    requiredFeatureFlags: input.requiredFeatureFlags,
    requiredKillSwitches: ["emergency_stop", "autonomy_disabled"],
    budgetProfile: DEFAULT_BUDGET,
    approvalRequirements: input.approvalRequirements,
    schedulerMode: input.schedulerMode ?? "disabled",
    capabilities: input.capabilities,
    blockedCapabilities: input.blockedCapabilities,
    lastRunSummary: input.lastRunSummary ?? "No agent runs in GE-AIOS-GROWTH-4A — framework definitions only.",
    healthStatus: "healthy",
    telemetry: { ...ZERO_AGENT_TELEMETRY },
  }
}

/** Read-only deterministic registry — all agents disabled by default in 4A. */
export const GROWTH_AGENT_REGISTRY: readonly GrowthAgentDefinition[] = [
  buildAgentDefinition({
    agentKind: "research_agent",
    agentName: "Research Agent",
    description: "Enriches company and contact intelligence for lead research workflows.",
    allowedWorkflowTypes: ["research_company", "monitoring"],
    permissionProfile: "read_only",
    runtimeBoundaryRequirements: ["internal_mutation_only", "no_outbound"],
    requiredFeatureFlags: [],
    capabilities: {
      ...DEFINITION_ONLY_CAPABILITIES,
      dryRunEligible: true,
    },
    blockedCapabilities: ["outbound_send", "core_mutation", "work_order_creation"],
    approvalRequirements: ["operator_execution_plan_approval"],
  }),
  buildAgentDefinition({
    agentKind: "qualification_agent",
    agentName: "Qualification Agent",
    description: "Qualifies leads and verifies contact readiness.",
    allowedWorkflowTypes: ["verify_email", "buying_committee"],
    permissionProfile: "planning_only",
    runtimeBoundaryRequirements: ["internal_mutation_only", "no_outbound"],
    requiredFeatureFlags: [],
    capabilities: {
      ...DEFINITION_ONLY_CAPABILITIES,
      dryRunEligible: true,
    },
    blockedCapabilities: ["outbound_send", "core_mutation", "work_order_creation"],
    approvalRequirements: ["operator_execution_plan_approval"],
  }),
  buildAgentDefinition({
    agentKind: "planning_agent",
    agentName: "Planning Agent",
    description: "Builds execution plans and coordinates next-best-action selection.",
    allowedWorkflowTypes: ["approval"],
    permissionProfile: "planning_only",
    runtimeBoundaryRequirements: ["planning_only", "no_execution"],
    requiredFeatureFlags: [],
    capabilities: DEFINITION_ONLY_CAPABILITIES,
    blockedCapabilities: ["direct_execution", "outbound_send", "core_mutation"],
    approvalRequirements: ["mission_planning_review"],
  }),
  buildAgentDefinition({
    agentKind: "execution_agent",
    agentName: "Execution Agent",
    description: "Coordinates internal runtime execution — bound to GE-AIOS-GROWTH-3C research_company pilot only.",
    allowedWorkflowTypes: [GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW],
    permissionProfile: "internal_mutation",
    runtimeBoundaryRequirements: [
      "runtime_pilot_enabled",
      "dry_run_passed",
      "approval",
      "readiness",
      "handoff",
      "preflight",
      "boundary",
    ],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_EXECUTION_RUNTIME_PILOT_ENABLED"],
    capabilities: {
      definitionOnly: true,
      dryRunEligible: true,
      internalRuntimeEligible: true,
      outboundBlocked: true,
      coreMutationBlocked: true,
      directExecutionAllowed: false,
    },
    blockedCapabilities: [
      "outbound_send",
      "core_mutation",
      "work_order_creation",
      "non_pilot_workflows",
    ],
    approvalRequirements: ["operator_execution_plan_approval", "dry_run_passed"],
    lastRunSummary: "Execution Agent references 3C pilot — research_company only after dry-run pass.",
  }),
  buildAgentDefinition({
    agentKind: "outreach_agent",
    agentName: "Outreach Agent",
    description: "Drafts and coordinates outbound sequences — not executable in 4A.",
    allowedWorkflowTypes: ["outreach_generation"],
    permissionProfile: "outbound_requires_approval",
    runtimeBoundaryRequirements: ["outbound_requires_human_approval", "no_autonomous_send"],
    requiredFeatureFlags: [],
    capabilities: {
      ...DEFINITION_ONLY_CAPABILITIES,
      outboundBlocked: true,
    },
    blockedCapabilities: ["execution", "outbound_send", "provider_calls", "core_mutation"],
    approvalRequirements: ["operator_outbound_approval", "human_send_gate"],
    lastRunSummary: "Outreach Agent is definition-only — outbound execution blocked.",
  }),
  buildAgentDefinition({
    agentKind: "meeting_agent",
    agentName: "Meeting Agent",
    description: "Prepares meeting briefs and follow-up context.",
    allowedWorkflowTypes: ["meeting_preparation"],
    permissionProfile: "planning_only",
    runtimeBoundaryRequirements: ["internal_mutation_only", "no_outbound"],
    requiredFeatureFlags: [],
    capabilities: DEFINITION_ONLY_CAPABILITIES,
    blockedCapabilities: ["outbound_send", "core_mutation", "direct_execution"],
    approvalRequirements: ["operator_execution_plan_approval"],
  }),
  buildAgentDefinition({
    agentKind: "revenue_operator_agent",
    agentName: "Revenue Operator / Supervisor",
    description: "Supervises Growth AI OS — recommendations and coordination only, no direct execution.",
    allowedWorkflowTypes: ["approval", "close", "monitoring"],
    permissionProfile: "supervisor",
    runtimeBoundaryRequirements: ["supervisor_read_only", "no_direct_execution"],
    requiredFeatureFlags: [],
    capabilities: {
      ...DEFINITION_ONLY_CAPABILITIES,
      directExecutionAllowed: false,
    },
    blockedCapabilities: ["direct_execution", "outbound_send", "core_mutation", "work_order_creation"],
    approvalRequirements: ["supervisor_recommendation_only"],
    lastRunSummary: "Revenue Operator coordinates recommendations — cannot execute workflows directly.",
  }),
] as const

export function getGrowthAgentDefinition(agentKind: GrowthAgentKind): GrowthAgentDefinition | null {
  return GROWTH_AGENT_REGISTRY.find((agent) => agent.agentKind === agentKind) ?? null
}

export function listGrowthAgentDefinitions(): GrowthAgentDefinition[] {
  return GROWTH_AGENT_REGISTRY.map((agent) => ({ ...agent, telemetry: { ...agent.telemetry } }))
}

export function resolveOwningAgentForWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): GrowthAgentKind {
  switch (workflowType) {
    case "research_company":
      return "research_agent"
    case "verify_email":
    case "buying_committee":
      return "qualification_agent"
    case "outreach_generation":
      return "outreach_agent"
    case "meeting_preparation":
      return "meeting_agent"
    case "approval":
    case "close":
      return "revenue_operator_agent"
    case "monitoring":
      return "research_agent"
    default:
      return "planning_agent"
  }
}

export function resolveExecutionAgentForWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): GrowthAgentKind | null {
  if (workflowType === GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW) {
    return "execution_agent"
  }
  return null
}

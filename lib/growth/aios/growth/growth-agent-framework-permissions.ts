/** GE-AIOS-GROWTH-4A — Agent permission model + run contracts (client-safe). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { isRuntimePilotWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import {
  getGrowthAgentDefinition,
  resolveExecutionAgentForWorkflow,
  resolveOwningAgentForWorkflow,
} from "@/lib/growth/aios/growth/growth-agent-framework-registry"
import {
  agentKindToAgentId,
  type GrowthAgentKind,
  type GrowthAgentPermissionProfile,
  type GrowthAgentPlanContext,
  type GrowthAgentRequiredGate,
  type GrowthAgentRunContract,
  type GrowthAgentRunStatus,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"

export const GROWTH_AGENT_PERMISSION_RULES: Record<
  GrowthAgentPermissionProfile,
  { summary: string; allowsOutbound: boolean; allowsCoreMutation: boolean; allowsDirectExecution: boolean }
> = {
  read_only: {
    summary: "Read and analyze only — no mutations.",
    allowsOutbound: false,
    allowsCoreMutation: false,
    allowsDirectExecution: false,
  },
  planning_only: {
    summary: "Planning and recommendations only — no execution.",
    allowsOutbound: false,
    allowsCoreMutation: false,
    allowsDirectExecution: false,
  },
  internal_mutation: {
    summary: "Internal mutation via gated runtime only — no outbound or Core.",
    allowsOutbound: false,
    allowsCoreMutation: false,
    allowsDirectExecution: false,
  },
  outbound_requires_approval: {
    summary: "Outbound blocked until explicit human approval.",
    allowsOutbound: false,
    allowsCoreMutation: false,
    allowsDirectExecution: false,
  },
  core_requires_explicit_approval: {
    summary: "Equipify Core mutations require explicit operator approval.",
    allowsOutbound: false,
    allowsCoreMutation: false,
    allowsDirectExecution: false,
  },
  supervisor: {
    summary: "Supervisor coordination — recommendations only, no direct execution.",
    allowsOutbound: false,
    allowsCoreMutation: false,
    allowsDirectExecution: false,
  },
}

export const GROWTH_AGENT_KIND_PERMISSION_MAP: Record<GrowthAgentKind, GrowthAgentPermissionProfile> = {
  research_agent: "read_only",
  qualification_agent: "planning_only",
  planning_agent: "planning_only",
  execution_agent: "internal_mutation",
  outreach_agent: "outbound_requires_approval",
  meeting_agent: "planning_only",
  revenue_operator_agent: "supervisor",
}

export function assertAgentPermissionProfile(
  agentKind: GrowthAgentKind,
): GrowthAgentPermissionProfile {
  return GROWTH_AGENT_KIND_PERMISSION_MAP[agentKind]
}

export function agentMayExecuteWorkflow(input: {
  agentKind: GrowthAgentKind
  workflowType: GrowthLeadResearchCanonicalWorkflowType
}): { allowed: boolean; blockedReasons: string[] } {
  const definition = getGrowthAgentDefinition(input.agentKind)
  if (!definition) {
    return { allowed: false, blockedReasons: ["Agent definition not found."] }
  }

  const blockedReasons: string[] = []

  if (definition.status === "disabled") {
    blockedReasons.push("Agent is disabled in GE-AIOS-GROWTH-4A framework.")
  }

  if (!definition.allowedWorkflowTypes.includes(input.workflowType)) {
    blockedReasons.push(`Workflow ${input.workflowType} is not in ${definition.agentName} allowlist.`)
  }

  if (input.agentKind === "outreach_agent") {
    blockedReasons.push("Outreach Agent is not executable in 4A — outbound blocked.")
  }

  if (input.agentKind === "revenue_operator_agent") {
    blockedReasons.push("Revenue Operator cannot execute workflows directly — recommendations only.")
  }

  if (input.agentKind === "execution_agent") {
    if (!isRuntimePilotWorkflow(input.workflowType)) {
      blockedReasons.push("Execution Agent is bound to research_company pilot (GE-AIOS-GROWTH-3C) only.")
    }
    blockedReasons.push("Execution Agent cannot bypass boundary, preflight, readiness, handoff, approval, or dry-run gates.")
  }

  const permission = GROWTH_AGENT_PERMISSION_RULES[definition.permissionProfile]
  if (!permission.allowsDirectExecution) {
    blockedReasons.push(`${definition.permissionProfile.replaceAll("_", " ")} — direct agent execution not enabled in 4A.`)
  }

  return { allowed: blockedReasons.length === 0, blockedReasons }
}

function baseRequiredGates(workflowType: GrowthLeadResearchCanonicalWorkflowType): GrowthAgentRequiredGate[] {
  const gates: GrowthAgentRequiredGate[] = ["approval", "readiness", "handoff", "preflight", "boundary"]
  if (workflowType !== "approval" && workflowType !== "close") {
    gates.push("dry_run")
  }
  if (isRuntimePilotWorkflow(workflowType)) {
    gates.push("runtime_pilot")
  }
  if (workflowType === "outreach_generation") {
    gates.push("operator_approval")
  }
  return gates
}

export function buildAgentRunContractPreview(input: {
  agentKind: GrowthAgentKind
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  leadId?: string | null
  companyName?: string | null
  generatedAt?: string
}): GrowthAgentRunContract {
  const definition = getGrowthAgentDefinition(input.agentKind)
  const permissionProfile = assertAgentPermissionProfile(input.agentKind)
  const executionCheck = agentMayExecuteWorkflow({
    agentKind: input.agentKind,
    workflowType: input.workflowType,
  })

  let runStatus: GrowthAgentRunStatus = "run_not_allowed"
  if (executionCheck.allowed) {
    if (input.agentKind === "execution_agent" && isRuntimePilotWorkflow(input.workflowType)) {
      runStatus = "run_ready_for_internal_runtime"
    } else if (definition?.capabilities.dryRunEligible) {
      runStatus = "run_ready_for_dry_run"
    } else {
      runStatus = "run_preview"
    }
  } else if (executionCheck.blockedReasons.length > 0) {
    runStatus = "run_blocked"
  }

  return {
    runId: `growth-agent-run:${input.agentKind}:${input.workflowType}:${input.generatedAt ?? "preview"}`,
    agentId: agentKindToAgentId(input.agentKind),
    agentKind: input.agentKind,
    requestedAction: `Coordinate ${input.workflowType.replaceAll("_", " ")} via ${definition?.agentName ?? input.agentKind}`,
    targetLeadId: input.leadId ?? null,
    targetCompanyName: input.companyName ?? null,
    targetWorkflowType: input.workflowType,
    inputContext: {
      frameworkPhase: "GE-AIOS-GROWTH-4A",
      readOnly: true,
      schedulerActive: false,
    },
    permissionProfile,
    requiredGates: baseRequiredGates(input.workflowType),
    expectedOutputs: [`${input.workflowType} planning or gated runtime observation`],
    blockedReasons: executionCheck.blockedReasons,
    runStatus,
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
  }
}

export function buildAgentPlanContext(input: {
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  leadId?: string | null
  companyName?: string | null
  generatedAt?: string
}): GrowthAgentPlanContext {
  const owningAgentKind = resolveOwningAgentForWorkflow(input.workflowType)
  const executionAgentKind = resolveExecutionAgentForWorkflow(input.workflowType)
  const primaryAgentKind = executionAgentKind ?? owningAgentKind
  const definition = getGrowthAgentDefinition(primaryAgentKind)
  const runContractPreview = buildAgentRunContractPreview({
    agentKind: primaryAgentKind,
    workflowType: input.workflowType,
    leadId: input.leadId,
    companyName: input.companyName,
    generatedAt: input.generatedAt,
  })

  return {
    owningAgentKind: primaryAgentKind,
    owningAgentName: definition?.agentName ?? primaryAgentKind.replaceAll("_", " "),
    agentAllowed: runContractPreview.runStatus !== "run_not_allowed" && runContractPreview.runStatus !== "run_blocked",
    agentSummary: runContractPreview.blockedReasons[0] ?? `${definition?.agentName ?? "Agent"} owns this workflow in the Growth agent framework.`,
    requiredGates: runContractPreview.requiredGates,
    blockedReasons: runContractPreview.blockedReasons,
    permissionProfile: assertAgentPermissionProfile(primaryAgentKind),
    runContractPreview: {
      runStatus: runContractPreview.runStatus,
      blockedReasons: runContractPreview.blockedReasons,
      requiredGates: runContractPreview.requiredGates,
      requestedAction: runContractPreview.requestedAction,
    },
  }
}

/** Scheduler placeholder — never starts jobs in 4A. */
export const GROWTH_AGENT_SCHEDULER_RULE =
  "Agent scheduler definitions exist for manual, hourly, daily, and event_driven modes — all agents default to disabled with no background jobs, cron, or queue workers in GE-AIOS-GROWTH-4A." as const

export function isAgentSchedulerActive(): false {
  return false
}

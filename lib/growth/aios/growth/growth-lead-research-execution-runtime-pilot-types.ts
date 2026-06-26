/** GE-AIOS-GROWTH-3C — Execution Runtime Pilot (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchExecutionDryRunStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import type {
  GrowthLeadResearchExecutionAuditEntry,
  GrowthLeadResearchExecutionRuntimeValidationResult,
  GrowthLeadResearchInternalMutationRuntimeWorkflow,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export const GROWTH_AIOS_GROWTH_3C_PHASE = "GE-AIOS-GROWTH-3C" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER =
  "growth-aios-growth-3c-execution-runtime-pilot-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_FEATURE_FLAG =
  "GROWTH_AIOS_GROWTH_EXECUTION_RUNTIME_PILOT_ENABLED" as const

/** Pilot disabled by default — requires explicit operator configuration. */
export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_DEFAULT_ENABLED = false as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW =
  "research_company" as const

export type GrowthLeadResearchExecutionRuntimePilotWorkflow =
  typeof GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_BLOCK_CODES = [
  "pilot_disabled",
  "pilot_workflow_not_allowed",
  "dry_run_required",
  "dry_run_not_passed",
] as const

export type GrowthLeadResearchExecutionRuntimePilotBlockCode =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_BLOCK_CODES)[number]

export type GrowthLeadResearchExecutionRuntimePilotEnqueueValidation = {
  allowed: boolean
  blockCode:
    | GrowthLeadResearchExecutionRuntimePilotBlockCode
    | GrowthLeadResearchExecutionRuntimeValidationResult["blockCode"]
    | null
  blockReason: string | null
  pilotEnabled: boolean
  runtimeEnabled: boolean
  dryRunRequired: boolean
  dryRunPassed: boolean
  gateValidation: GrowthLeadResearchExecutionRuntimeValidationResult
}

export type GrowthLeadResearchExecutionRuntimePilotPlanItem = {
  planId: string
  leadId: string
  companyName: string | null
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow | string
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  confidence: number | null
  executionPlan: GrowthLeadResearchExecutionPlan
  observationHref: string | null
  dryRunRequired: true
  latestDryRunStatus: GrowthLeadResearchExecutionDryRunStatus | null
  enqueueAllowed: boolean
  blockReason: string | null
}

export type GrowthLeadResearchExecutionRuntimePilotSummary = {
  pilotEnabled: boolean
  runtimeEnabled: boolean
  effectiveRuntimeEnabled: boolean
  pilotWorkflow: GrowthLeadResearchExecutionRuntimePilotWorkflow
  headline: string
}

export type GrowthLeadResearchExecutionRuntimeAuditSummary = {
  executionId: string
  entries: GrowthLeadResearchExecutionAuditEntry[]
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_RULE =
  "Runtime pilot enables real execution for research_company only — after dry_run_passed, with persisted lifecycle events. No outbound, providers, Work Orders, or Core mutations." as const

export function isRuntimePilotWorkflow(
  workflowType: string,
): workflowType is GrowthLeadResearchExecutionRuntimePilotWorkflow {
  return workflowType === GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW
}

export function resolveExecutionRuntimePilotEnabledFromEnv(): boolean {
  if (typeof process === "undefined" || !process.env) return false
  return process.env[GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_FEATURE_FLAG] === "true"
}

export function validateExecutionRuntimePilotEnqueue(input: {
  pilotEnabled: boolean
  runtimeEnabled: boolean
  workflowType: string
  gateValidation: GrowthLeadResearchExecutionRuntimeValidationResult
  dryRunStatus: GrowthLeadResearchExecutionDryRunStatus | null
}): GrowthLeadResearchExecutionRuntimePilotEnqueueValidation {
  const dryRunRequired = true
  const dryRunPassed = input.dryRunStatus === "dry_run_passed"

  if (!input.pilotEnabled) {
    return buildPilotEnqueueResult(input, {
      allowed: false,
      blockCode: "pilot_disabled",
      blockReason: "Execution runtime pilot is disabled.",
      dryRunRequired,
      dryRunPassed,
    })
  }

  if (!input.runtimeEnabled) {
    return buildPilotEnqueueResult(input, {
      allowed: false,
      blockCode: "runtime_disabled",
      blockReason: "Execution runtime is disabled.",
      dryRunRequired,
      dryRunPassed,
    })
  }

  if (!isRuntimePilotWorkflow(input.workflowType)) {
    return buildPilotEnqueueResult(input, {
      allowed: false,
      blockCode: "pilot_workflow_not_allowed",
      blockReason: `Workflow ${input.workflowType} is not enabled in the research_company pilot.`,
      dryRunRequired,
      dryRunPassed,
    })
  }

  if (!input.gateValidation.allowed) {
    return buildPilotEnqueueResult(input, {
      allowed: false,
      blockCode: input.gateValidation.blockCode,
      blockReason: input.gateValidation.blockReason,
      dryRunRequired,
      dryRunPassed,
    })
  }

  if (dryRunRequired && input.dryRunStatus == null) {
    return buildPilotEnqueueResult(input, {
      allowed: false,
      blockCode: "dry_run_required",
      blockReason: "Dry-run must pass before enqueue is allowed.",
      dryRunRequired,
      dryRunPassed,
    })
  }

  if (dryRunRequired && !dryRunPassed) {
    return buildPilotEnqueueResult(input, {
      allowed: false,
      blockCode: "dry_run_not_passed",
      blockReason: `Latest dry-run status is ${input.dryRunStatus?.replaceAll("_", " ") ?? "missing"}.`,
      dryRunRequired,
      dryRunPassed,
    })
  }

  return buildPilotEnqueueResult(input, {
    allowed: true,
    blockCode: null,
    blockReason: null,
    dryRunRequired,
    dryRunPassed,
  })
}

function buildPilotEnqueueResult(
  input: {
    pilotEnabled: boolean
    runtimeEnabled: boolean
    gateValidation: GrowthLeadResearchExecutionRuntimeValidationResult
  },
  result: {
    allowed: boolean
    blockCode: GrowthLeadResearchExecutionRuntimePilotEnqueueValidation["blockCode"]
    blockReason: string | null
    dryRunRequired: boolean
    dryRunPassed: boolean
  },
): GrowthLeadResearchExecutionRuntimePilotEnqueueValidation {
  return {
    allowed: result.allowed,
    blockCode: result.blockCode,
    blockReason: result.blockReason,
    pilotEnabled: input.pilotEnabled,
    runtimeEnabled: input.runtimeEnabled,
    dryRunRequired: result.dryRunRequired,
    dryRunPassed: result.dryRunPassed,
    gateValidation: input.gateValidation,
  }
}

export function buildExecutionRuntimePilotSummary(input: {
  pilotEnabled: boolean
  runtimeEnabled: boolean
}): GrowthLeadResearchExecutionRuntimePilotSummary {
  const effectiveRuntimeEnabled = input.pilotEnabled && input.runtimeEnabled
  return {
    pilotEnabled: input.pilotEnabled,
    runtimeEnabled: input.runtimeEnabled,
    effectiveRuntimeEnabled,
    pilotWorkflow: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW,
    headline: effectiveRuntimeEnabled
      ? "Runtime pilot active — research_company enqueue enabled after dry-run pass."
      : input.pilotEnabled
        ? "Pilot flag on — enable global runtime to allow research_company enqueue."
        : "Runtime pilot disabled — dry-run only until pilot flag is enabled.",
  }
}

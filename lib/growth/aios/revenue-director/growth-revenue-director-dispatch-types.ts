/** GE-AI-3C — Revenue Director active orchestration dispatch types (client-safe). */

import type { GrowthRevenueDirectorWorkflowRequestType } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

export const GROWTH_AIOS_GE_AI_3C_PHASE = "GE-AI-3C" as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER =
  "growth-ge-ai-3c-revenue-director-active-orchestration-v1" as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE =
  "Revenue Director active orchestration dispatches accepted workflow requests to existing Workflow Agents through gated, idempotent adapters — never sends transport, never bypasses Growth Autonomy or Human Approval." as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCHABLE_REQUEST_TYPES = [
  "run_research",
  "rerun_qualification",
  "request_communication_plan",
  "generate_outreach",
  "review_approval_queue",
] as const

export type GrowthRevenueDirectorDispatchableRequestType =
  (typeof GROWTH_REVENUE_DIRECTOR_DISPATCHABLE_REQUEST_TYPES)[number]

export const GROWTH_REVENUE_DIRECTOR_ADVISORY_ONLY_REQUEST_TYPES = [
  "pause_objective",
  "allocate_more_budget",
  "escalate_human",
  "wait",
] as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_TARGET_AGENTS = [
  "research_agent",
  "qualification_agent",
  "communication_engine",
  "outreach_preparation",
  "human_approval_center",
] as const

export type GrowthRevenueDirectorDispatchTargetAgent =
  (typeof GROWTH_REVENUE_DIRECTOR_DISPATCH_TARGET_AGENTS)[number]

export type GrowthRevenueDirectorDispatchResultReference = {
  kind: string
  id: string
  label?: string
  route?: string | null
}

export type GrowthRevenueDirectorDispatchAdapterResult = {
  ok: true
  targetAgent: GrowthRevenueDirectorDispatchTargetAgent
  requestType: GrowthRevenueDirectorDispatchableRequestType
  references: GrowthRevenueDirectorDispatchResultReference[]
  completed: boolean
  sendOccurred: false
  transportBlocked: true
  summary: string
}

export type GrowthRevenueDirectorDispatchBlockedResult = {
  ok: false
  error: string
  blockReason: string
  gateId?: string
  sendOccurred: false
}

export type GrowthRevenueDirectorDispatchOutcome =
  | GrowthRevenueDirectorDispatchAdapterResult
  | GrowthRevenueDirectorDispatchBlockedResult

export type GrowthRevenueDirectorDispatchEligibility = {
  eligible: boolean
  blockReason: string | null
  targetAgent: GrowthRevenueDirectorDispatchTargetAgent | null
  requestType: GrowthRevenueDirectorWorkflowRequestType
  advisoryOnly: boolean
}

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES = {
  dispatchRequested: "growth.revenue_director.workflow_request_dispatch_requested",
  dispatched: "growth.revenue_director.workflow_request_dispatched",
  dispatchBlocked: "growth.revenue_director.workflow_request_dispatch_blocked",
  dispatchFailed: "growth.revenue_director.workflow_request_dispatch_failed",
  completed: "growth.revenue_director.workflow_request_completed",
} as const

export function buildRevenueDirectorDispatchIdempotencyKey(workflowRequestId: string): string {
  return `rev-dir-dispatch:${workflowRequestId}`
}

export function isRevenueDirectorDispatchableRequestType(
  value: GrowthRevenueDirectorWorkflowRequestType,
): value is GrowthRevenueDirectorDispatchableRequestType {
  return (GROWTH_REVENUE_DIRECTOR_DISPATCHABLE_REQUEST_TYPES as readonly string[]).includes(value)
}

export function isRevenueDirectorAdvisoryOnlyRequestType(
  value: GrowthRevenueDirectorWorkflowRequestType,
): boolean {
  return (GROWTH_REVENUE_DIRECTOR_ADVISORY_ONLY_REQUEST_TYPES as readonly string[]).includes(value)
}

export function resolveDispatchTargetAgent(
  requestType: GrowthRevenueDirectorWorkflowRequestType,
): GrowthRevenueDirectorDispatchTargetAgent | null {
  switch (requestType) {
    case "run_research":
      return "research_agent"
    case "rerun_qualification":
      return "qualification_agent"
    case "request_communication_plan":
      return "communication_engine"
    case "generate_outreach":
      return "outreach_preparation"
    case "review_approval_queue":
      return "human_approval_center"
    default:
      return null
  }
}

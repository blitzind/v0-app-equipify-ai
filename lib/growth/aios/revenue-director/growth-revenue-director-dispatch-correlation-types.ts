/** GE-AI-3C-PROD-1 — Revenue Director dispatch completion correlation types (client-safe). */

import type { GrowthRevenueDirectorWorkflowRequestType } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"

export const GROWTH_AIOS_GE_AI_3C_PROD_1_PHASE = "GE-AI-3C-PROD-1" as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_QA_MARKER =
  "growth-ge-ai-3c-prod-1-dispatch-completion-correlation-v1" as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_RULE =
  "Revenue Director dispatch completion correlation observes canonical Event Bus outcomes and updates the Decision Ledger — no polling, no scheduler, no transport, no Core mutations." as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID =
  "revenue_director_dispatch_correlation_observer" as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_STATUSES = [
  "pending",
  "matched",
  "completed",
  "failed",
  "stale",
  "unmatched",
] as const

export type GrowthRevenueDirectorDispatchCorrelationStatus =
  (typeof GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_STATUSES)[number]

export type GrowthRevenueDirectorDispatchCorrelationResultReference = {
  type: string
  id?: string
  route?: string
}

export type GrowthRevenueDirectorDispatchCorrelation = {
  id: string
  organizationId: string
  workflowRequestId: string
  dispatchIdempotencyKey: string
  targetWorkflowAgent:
    | "research"
    | "qualification"
    | "planning"
    | "execution"
    | "outreach_preparation"
    | "meeting_preparation"
    | "revenue_operator"
    | "communication_engine"
    | "human_approval_center"
  status: GrowthRevenueDirectorDispatchCorrelationStatus
  eventType: string
  eventId?: string
  resultReference?: GrowthRevenueDirectorDispatchCorrelationResultReference
  evidence: Array<{
    source: string
    label: string
    value?: string | number | boolean
  }>
  createdAt: string
}

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_EVENT_TYPES = {
  matched: "growth.revenue_director.workflow_request_correlation_matched",
  completed: "growth.revenue_director.workflow_request_correlation_completed",
  failed: "growth.revenue_director.workflow_request_correlation_failed",
} as const

export const GROWTH_REVENUE_DIRECTOR_DISPATCH_STALE_AFTER_MS = 24 * 60 * 60 * 1000

export type GrowthRevenueDirectorDispatchCorrelationEventResolution = {
  outcome: "completed" | "failed"
  requestTypes: GrowthRevenueDirectorWorkflowRequestType[]
  lifecycleAlias: string | null
  targetAgent:
    | GrowthRevenueDirectorDispatchCorrelation["targetWorkflowAgent"]
    | null
}

const RESEARCH_COMPLETE_STATUSES = new Set([
  "research_complete",
  "assessed",
  "qualified",
  "blocked",
])

export function buildRevenueDirectorDispatchCorrelationId(workflowRequestId: string, eventId: string): string {
  return `rev-dir-corr:${workflowRequestId}:${eventId}`
}

export function resolveRevenueDirectorDispatchCorrelationFromEvent(input: {
  eventType: string
  payload?: Record<string, unknown>
}): GrowthRevenueDirectorDispatchCorrelationEventResolution | null {
  const payload = input.payload ?? {}

  if (input.eventType === GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT) {
    const workflowStatus = String(payload.workflow_status ?? "")
    if (!RESEARCH_COMPLETE_STATUSES.has(workflowStatus)) return null
    const failed = workflowStatus === "blocked" || workflowStatus === "failed"
    return {
      outcome: failed ? "failed" : "completed",
      requestTypes: ["run_research"],
      lifecycleAlias: "ResearchCompleted",
      targetAgent: "research",
    }
  }

  if (input.eventType === GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT) {
    const qualificationStatus = String(payload.qualification_status ?? "")
    const failed = qualificationStatus === "failed" || qualificationStatus === "blocked"
    return {
      outcome: failed ? "failed" : "completed",
      requestTypes: ["rerun_qualification"],
      lifecycleAlias: "QualificationCompleted",
      targetAgent: "qualification",
    }
  }

  if (input.eventType === GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT) {
    return {
      outcome: "completed",
      requestTypes: ["generate_outreach"],
      lifecycleAlias: "OutreachPrepared",
      targetAgent: "outreach_preparation",
    }
  }

  if (input.eventType === GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated) {
    return {
      outcome: "completed",
      requestTypes: ["request_communication_plan"],
      lifecycleAlias: "CommunicationPlanGenerated",
      targetAgent: "communication_engine",
    }
  }

  if (input.eventType === "agent.failed") {
    return {
      outcome: "failed",
      requestTypes: ["run_research", "rerun_qualification", "generate_outreach"],
      lifecycleAlias: "AgentFailed",
      targetAgent: null,
    }
  }

  if (input.eventType === "growth.revenue_director.workflow_request_dispatch_failed") {
    return {
      outcome: "failed",
      requestTypes: [
        "run_research",
        "rerun_qualification",
        "generate_outreach",
        "request_communication_plan",
      ],
      lifecycleAlias: null,
      targetAgent: null,
    }
  }

  return null
}

export function extractRevenueDirectorDispatchCorrelationResultReference(input: {
  eventType: string
  entityId: string | null
  payload?: Record<string, unknown>
}): GrowthRevenueDirectorDispatchCorrelationResultReference | undefined {
  const payload = input.payload ?? {}

  if (input.eventType === GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated) {
    const planId = typeof payload.planId === "string" ? payload.planId : null
    return planId ? { type: "communication_plan", id: planId } : undefined
  }

  if (input.eventType === GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT) {
    const packageId = typeof payload.package_id === "string" ? payload.package_id : null
    return packageId
      ? { type: "outreach_preparation_package", id: packageId }
      : input.entityId
        ? { type: "lead", id: input.entityId }
        : undefined
  }

  if (input.entityId) {
    return { type: "lead", id: input.entityId }
  }

  const workflowRequestId =
    typeof payload.workflowRequestId === "string" ? payload.workflowRequestId : null
  if (workflowRequestId) {
    return { type: "workflow_request", id: workflowRequestId }
  }

  return undefined
}

export function matchRevenueDirectorDispatchedWorkflowRequest(input: {
  requests: Array<{
    id: string
    requestType: GrowthRevenueDirectorWorkflowRequestType
    leadId: string | null
    objectiveId: string | null
    missionId: string | null
    dispatchedAt: string | null
  }>
  resolution: GrowthRevenueDirectorDispatchCorrelationEventResolution
  event: {
    eventType: string
    entityId: string | null
    payload?: Record<string, unknown>
  }
}): (typeof input.requests)[number] | null {
  const candidates = input.requests
    .filter((row) => input.resolution.requestTypes.includes(row.requestType))
    .filter((row) => {
      if (input.event.entityId && row.leadId) {
        return row.leadId === input.event.entityId
      }
      if (input.event.eventType === GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated) {
        const planId = input.event.payload?.planId
        const subjectId = row.leadId ?? row.objectiveId ?? row.missionId
        return subjectId && (planId ? String(planId).includes(subjectId) || subjectId : true)
      }
      if (input.event.payload?.workflowRequestId) {
        return row.id === input.event.payload.workflowRequestId
      }
      return !input.event.entityId
    })
    .sort((left, right) => {
      const leftTs = Date.parse(left.dispatchedAt ?? "")
      const rightTs = Date.parse(right.dispatchedAt ?? "")
      return rightTs - leftTs
    })

  return candidates[0] ?? null
}

export function resolveRevenueDirectorDispatchCorrelationReadStatus(input: {
  workflowRequestStatus: string
  dispatchedAt: string | null
  generatedAt: string
}): GrowthRevenueDirectorDispatchCorrelationStatus {
  if (input.workflowRequestStatus === "completed") return "completed"
  if (input.workflowRequestStatus === "failed") return "failed"
  if (input.workflowRequestStatus === "dispatched" && input.dispatchedAt) {
    const ageMs = Date.parse(input.generatedAt) - Date.parse(input.dispatchedAt)
    if (Number.isFinite(ageMs) && ageMs > GROWTH_REVENUE_DIRECTOR_DISPATCH_STALE_AFTER_MS) {
      return "stale"
    }
    return "pending"
  }
  return "unmatched"
}

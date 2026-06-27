/** GE-AI-3C — Revenue Director dispatch guardrails (client-safe static checks). */

import type { GrowthRevenueDirectorWorkflowRequestRecord } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import type { GrowthRevenueDirectorWorkflowRequestType } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import {
  isRevenueDirectorAdvisoryOnlyRequestType,
  isRevenueDirectorDispatchableRequestType,
  resolveDispatchTargetAgent,
  type GrowthRevenueDirectorDispatchEligibility,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"

const TERMINAL_STATUSES = new Set(["dispatched", "completed", "cancelled", "superseded", "expired", "failed"])

export function validateRevenueDirectorDispatchRequestStatus(
  request: Pick<GrowthRevenueDirectorWorkflowRequestRecord, "status">,
): { allowed: boolean; blockReason: string | null } {
  if (request.status === "accepted") {
    return { allowed: true, blockReason: null }
  }
  if (request.status === "dispatched") {
    return { allowed: false, blockReason: "Request already dispatched — idempotent replay only." }
  }
  if (TERMINAL_STATUSES.has(request.status)) {
    return { allowed: false, blockReason: `Cannot dispatch request in status ${request.status}.` }
  }
  return { allowed: false, blockReason: `Only accepted requests can dispatch (current: ${request.status}).` }
}

export function validateRevenueDirectorDispatchRequestType(
  requestType: GrowthRevenueDirectorWorkflowRequestType,
): { allowed: boolean; blockReason: string | null; advisoryOnly: boolean } {
  if (isRevenueDirectorAdvisoryOnlyRequestType(requestType)) {
    return {
      allowed: false,
      blockReason: `${requestType} is advisory-only in GE-AI-3C.`,
      advisoryOnly: true,
    }
  }
  if (!isRevenueDirectorDispatchableRequestType(requestType)) {
    return {
      allowed: false,
      blockReason: `Unknown or blocked request type: ${requestType}.`,
      advisoryOnly: false,
    }
  }
  return { allowed: true, blockReason: null, advisoryOnly: false }
}

export function validateRevenueDirectorDispatchSubject(input: {
  requestType: GrowthRevenueDirectorWorkflowRequestType
  leadId: string | null
  objectiveId: string | null
  missionId: string | null
}): { allowed: boolean; blockReason: string | null } {
  if (input.requestType === "review_approval_queue") {
    return { allowed: true, blockReason: null }
  }
  if (input.requestType === "request_communication_plan") {
    if (input.leadId || input.objectiveId || input.missionId) {
      return { allowed: true, blockReason: null }
    }
    return { allowed: false, blockReason: "Communication plan dispatch requires a subject." }
  }
  if (!input.leadId) {
    return { allowed: false, blockReason: "Lead subject is required for this workflow request." }
  }
  return { allowed: true, blockReason: null }
}

export function synthesizeRevenueDirectorDispatchEligibility(input: {
  request: GrowthRevenueDirectorWorkflowRequestRecord
}): GrowthRevenueDirectorDispatchEligibility {
  const requestType = input.request.requestType
  const typeGate = validateRevenueDirectorDispatchRequestType(requestType)
  const statusGate = validateRevenueDirectorDispatchRequestStatus(input.request)
  const subjectGate = validateRevenueDirectorDispatchSubject({
    requestType,
    leadId: input.request.leadId,
    objectiveId: input.request.objectiveId,
    missionId: input.request.missionId,
  })

  const blockReason =
    typeGate.blockReason ?? statusGate.blockReason ?? subjectGate.blockReason ?? null

  return {
    eligible: !blockReason && typeGate.allowed && statusGate.allowed && subjectGate.allowed,
    blockReason,
    targetAgent: resolveDispatchTargetAgent(requestType),
    requestType,
    advisoryOnly: typeGate.advisoryOnly,
  }
}

export const REVENUE_DIRECTOR_DISPATCH_FORBIDDEN_TOKENS = [
  "runSequenceExecutionJob",
  "sendSms",
  "sendEmail",
  "sendVoiceDrop",
  "submitOperatorAutonomousOutboundScopeActivation",
  "mutateCore",
  "public.invoices",
  "public.contacts",
] as const

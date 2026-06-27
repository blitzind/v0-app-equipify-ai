/** GE-AI-3B — Revenue Director decision ledger helpers (client-safe). */

import type { GrowthRevenueDirectorWorkflowRequest } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import type {
  GrowthRevenueDirectorDecisionLedgerReadModel,
  GrowthRevenueDirectorDecisionStatus,
  GrowthRevenueDirectorLedgerWorkflowVisibility,
  GrowthRevenueDirectorWorkflowRequestStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import {
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER as QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE as LEDGER_RULE,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"

export function stableLedgerHash(parts: Array<string | number | null | undefined>): string {
  const fingerprint = parts.map((part) => String(part ?? "")).join("|")
  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function computeRevenueDirectorSnapshotHash(input: {
  organizationId: string
  generatedAt: string
  revenueHealth: string
  workflowRequestIds: string[]
}): string {
  const sortedIds = [...input.workflowRequestIds].sort()
  return `snap-${stableLedgerHash([
    input.organizationId,
    input.generatedAt.slice(0, 13),
    input.revenueHealth,
    sortedIds.join(","),
  ])}`
}

export function buildRevenueDirectorWorkflowRequestIdempotencyKey(input: {
  organizationId: string
  advisoryRequestId: string
}): string {
  return `rev-dir-req:${input.organizationId}:${input.advisoryRequestId}`
}

export function resolveLedgerWorkflowVisibility(input: {
  idempotencyKey: string
  existingStatusByKey: Map<string, GrowthRevenueDirectorWorkflowRequestStatus>
}): GrowthRevenueDirectorLedgerWorkflowVisibility {
  const status = input.existingStatusByKey.get(input.idempotencyKey)
  if (!status) return "new"
  if (status === "accepted") return "accepted"
  if (status === "dispatched") return "dispatched"
  if (status === "completed") return "completed"
  if (status === "failed") return "cancelled"
  if (status === "superseded") return "superseded"
  if (status === "cancelled") return "cancelled"
  return "proposed"
}

export function mapAdvisoryRequestToLedgerSubject(request: GrowthRevenueDirectorWorkflowRequest): {
  subjectType: string | null
  subjectId: string | null
  leadId: string | null
  objectiveId: string | null
  missionId: string | null
} {
  return {
    subjectType: request.leadId ? "lead" : request.objectiveId ? "objective" : request.missionId ? "mission" : "system",
    subjectId: request.leadId ?? request.objectiveId ?? request.missionId ?? null,
    leadId: request.leadId ?? null,
    objectiveId: request.objectiveId ?? null,
    missionId: request.missionId ?? null,
  }
}

export function canTransitionDecisionStatus(
  from: GrowthRevenueDirectorDecisionStatus,
  to: GrowthRevenueDirectorDecisionStatus,
): boolean {
  if (from === to) return true
  if (from === "superseded" || from === "cancelled" || from === "completed") return false
  if (to === "accepted" && from === "proposed") return true
  if (to === "cancelled" && (from === "proposed" || from === "accepted")) return true
  if (to === "superseded" && from === "proposed") return true
  if (to === "completed" && from === "accepted") return true
  return false
}

export function canTransitionWorkflowRequestStatus(
  from: GrowthRevenueDirectorWorkflowRequestStatus,
  to: GrowthRevenueDirectorWorkflowRequestStatus,
): boolean {
  if (from === to) return true
  if (from === "superseded" || from === "cancelled" || from === "completed" || from === "expired") {
    return false
  }
  if (to === "accepted" && from === "proposed") return true
  if (to === "dispatched" && from === "accepted") return true
  if (to === "cancelled" && (from === "proposed" || from === "accepted")) return true
  if (to === "superseded" && from === "proposed") return true
  if (to === "completed" && (from === "accepted" || from === "dispatched")) return true
  return false
}

export function synthesizeEmptyDecisionLedgerReadModel(input: {
  generatedAt: string
  schemaReady: boolean
}): GrowthRevenueDirectorDecisionLedgerReadModel {
  return {
    readOnly: true,
    qaMarker: QA_MARKER,
    generatedAt: input.generatedAt,
    rule: LEDGER_RULE,
    schemaReady: input.schemaReady,
    summary: {
      pendingDecisions: 0,
      pendingRequests: 0,
      acceptedRequests: 0,
      completedCount: 0,
      supersededCount: 0,
      cancelledCount: 0,
      topRecommendedRequestTitle: null,
      topRecommendedRequestType: null,
    },
    decisions: [],
    workflowRequests: [],
    recentEvents: [],
  }
}

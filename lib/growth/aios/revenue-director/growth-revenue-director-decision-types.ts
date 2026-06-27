/** GE-AI-3B — Revenue Director Decision Ledger types (client-safe). */

import type { GrowthRevenueDirectorWorkflowRequestType } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

export const GROWTH_AIOS_GE_AI_3B_PHASE = "GE-AI-3B" as const

export const GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER =
  "growth-ge-ai-3b-revenue-director-decision-ledger-v1" as const

export const GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_MIGRATION =
  "20271001220000_growth_ai_3b_revenue_director_decision_ledger.sql" as const

export const GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE =
  "Revenue Director Decision Ledger persists advisory decisions and workflow requests with idempotent deduplication — no auto-dispatch, no transport, no Core mutations." as const

export const GROWTH_REVENUE_DIRECTOR_DECISION_TYPES = [
  "executive_orchestration_snapshot",
  "workflow_request_batch",
] as const

export type GrowthRevenueDirectorDecisionType = (typeof GROWTH_REVENUE_DIRECTOR_DECISION_TYPES)[number]

export const GROWTH_REVENUE_DIRECTOR_DECISION_STATUSES = [
  "proposed",
  "accepted",
  "superseded",
  "cancelled",
  "completed",
] as const

export type GrowthRevenueDirectorDecisionStatus = (typeof GROWTH_REVENUE_DIRECTOR_DECISION_STATUSES)[number]

export const GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_STATUSES = [
  "proposed",
  "accepted",
  "dispatched",
  "completed",
  "failed",
  "cancelled",
  "superseded",
  "expired",
] as const

export type GrowthRevenueDirectorWorkflowRequestStatus =
  (typeof GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_STATUSES)[number]

export const GROWTH_REVENUE_DIRECTOR_DECISION_EVENT_TYPES = [
  "proposed",
  "accepted",
  "dispatched",
  "completed",
  "failed",
  "cancelled",
  "superseded",
  "expired",
] as const

export type GrowthRevenueDirectorDecisionEventType =
  (typeof GROWTH_REVENUE_DIRECTOR_DECISION_EVENT_TYPES)[number]

export const GROWTH_REVENUE_DIRECTOR_LEDGER_WORKFLOW_VISIBILITY = [
  "new",
  "proposed",
  "accepted",
  "dispatched",
  "completed",
  "superseded",
  "cancelled",
] as const

export type GrowthRevenueDirectorLedgerWorkflowVisibility =
  (typeof GROWTH_REVENUE_DIRECTOR_LEDGER_WORKFLOW_VISIBILITY)[number]

export type GrowthRevenueDirectorDecisionEvidence = {
  source: string
  label: string
  value?: string | number | boolean
}

export type GrowthRevenueDirectorDecisionRecord = {
  id: string
  organizationId: string
  snapshotHash: string
  decisionType: GrowthRevenueDirectorDecisionType
  status: GrowthRevenueDirectorDecisionStatus
  title: string
  summary: string
  confidence: number
  priorityScore: number
  evidence: GrowthRevenueDirectorDecisionEvidence[]
  risks: Array<{ label: string; severity: string; summary: string }>
  createdAt: string
  updatedAt: string
  supersededAt: string | null
}

export type GrowthRevenueDirectorWorkflowRequestRecord = {
  id: string
  organizationId: string
  decisionId: string
  requestType: GrowthRevenueDirectorWorkflowRequestType
  targetWorkflowAgent: string
  status: GrowthRevenueDirectorWorkflowRequestStatus
  advisory: true
  subjectType: string | null
  subjectId: string | null
  objectiveId: string | null
  missionId: string | null
  leadId: string | null
  title: string
  summary: string
  priorityScore: number
  requiresHumanApproval: boolean
  idempotencyKey: string
  correlationId: string
  evidence: GrowthRevenueDirectorDecisionEvidence[]
  route: string | null
  createdAt: string
  updatedAt: string
  acceptedAt: string | null
  dispatchedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  supersededAt: string | null
}

export type GrowthRevenueDirectorDecisionEventRecord = {
  id: string
  organizationId: string
  decisionId: string | null
  workflowRequestId: string | null
  eventType: GrowthRevenueDirectorDecisionEventType
  payload: Record<string, unknown>
  createdAt: string
}

export type GrowthRevenueDirectorDecisionLedgerReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_RULE
  schemaReady: boolean
  summary: {
    pendingDecisions: number
    pendingRequests: number
    acceptedRequests: number
    completedCount: number
    supersededCount: number
    cancelledCount: number
    topRecommendedRequestTitle: string | null
    topRecommendedRequestType: GrowthRevenueDirectorWorkflowRequestType | null
  }
  decisions: GrowthRevenueDirectorDecisionRecord[]
  workflowRequests: GrowthRevenueDirectorWorkflowRequestRecord[]
  recentEvents: GrowthRevenueDirectorDecisionEventRecord[]
}

export const GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_EVENT_TYPES = {
  decisionProposed: "growth.revenue_director.decision_proposed",
  decisionAccepted: "growth.revenue_director.decision_accepted",
  decisionCancelled: "growth.revenue_director.decision_cancelled",
  decisionSuperseded: "growth.revenue_director.decision_superseded",
  workflowRequestProposed: "growth.revenue_director.workflow_request_proposed",
  workflowRequestAccepted: "growth.revenue_director.workflow_request_accepted",
  workflowRequestCompleted: "growth.revenue_director.workflow_request_completed",
} as const

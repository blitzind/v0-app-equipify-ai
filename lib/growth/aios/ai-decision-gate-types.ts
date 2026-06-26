/** GE-AIOS-2E — Decision Gate types (client-safe). Constitutional §17 Invariant 12. */

import type { AiDecisionRecord } from "@/lib/growth/aios/ai-decision-record-types"
import type { AiWorkOrder, AiWorkOrderStatus } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2E_PHASE = "GE-AIOS-2E" as const

export const GROWTH_AI_DECISION_GATE_QA_MARKER = "growth-aios-2e-decision-gate-v1" as const

export const AI_DECISION_GATE_BLOCK_REASONS = [
  "missing_decision_records",
  "decision_record_not_found",
  "cross_organization",
  "mission_mismatch",
  "work_order_mismatch",
  "entity_mismatch",
] as const

export type AiDecisionGateBlockReason = (typeof AI_DECISION_GATE_BLOCK_REASONS)[number]

export type AiDecisionGateViolation = {
  decisionRecordId?: string
  reason: AiDecisionGateBlockReason
  detail: string
}

export type AiDecisionGateValidationInput = {
  workOrder: Pick<
    AiWorkOrder,
    "id" | "organizationId" | "missionId" | "entityType" | "entityId" | "decisionRecordIds"
  >
  decisionRecords: AiDecisionRecord[]
}

export type AiDecisionGateValidationResult =
  | {
      passed: true
      decisionRecordIds: string[]
      decisionRecords: AiDecisionRecord[]
    }
  | {
      passed: false
      blockReason: AiDecisionGateBlockReason
      detail: string
      violations: AiDecisionGateViolation[]
    }

export type AiDecisionGateEvaluateInput = {
  organizationId: string
  workOrderId: string
  actingAgent?: string | null
  source?: string
}

/** Status to transition to when execution is blocked — null means remain at current status. */
export function resolveDecisionGateBlockedWorkOrderStatus(
  currentStatus: AiWorkOrderStatus,
): AiWorkOrderStatus | null {
  switch (currentStatus) {
    case "awaiting_decision":
    case "issued":
    case "planning":
    case "escalated":
      return null
    case "awaiting_approval":
      return "awaiting_decision"
    case "waiting":
    case "monitoring":
      return "escalated"
    default:
      return null
  }
}

/** Decision gate validates records; it does not create or infer decisions. */
export const AI_DECISION_GATE_RUNTIME_RULE =
  "Decision Gate validates Decision Records before Work Order execution — it does not invoke AI, providers, or create records." as const

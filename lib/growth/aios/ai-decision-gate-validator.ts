/** GE-AIOS-2E — Decision Gate validator (client-safe, pure). Constitutional §17 Invariant 12. */

import type {
  AiDecisionGateBlockReason,
  AiDecisionGateValidationInput,
  AiDecisionGateValidationResult,
  AiDecisionGateViolation,
} from "@/lib/growth/aios/ai-decision-gate-types"

function blocked(
  blockReason: AiDecisionGateBlockReason,
  detail: string,
  violations: AiDecisionGateViolation[],
): AiDecisionGateValidationResult {
  return { passed: false, blockReason, detail, violations }
}

export function validateAiWorkOrderDecisionGate(
  input: AiDecisionGateValidationInput,
): AiDecisionGateValidationResult {
  const { workOrder, decisionRecords } = input
  const violations: AiDecisionGateViolation[] = []

  if (!workOrder.decisionRecordIds.length) {
    return blocked(
      "missing_decision_records",
      "Work Order has no linked Decision Records",
      [{ reason: "missing_decision_records", detail: "decision_record_ids is empty" }],
    )
  }

  const recordsById = new Map(decisionRecords.map((record) => [record.id, record]))

  for (const decisionRecordId of workOrder.decisionRecordIds) {
    const record = recordsById.get(decisionRecordId)
    if (!record) {
      violations.push({
        decisionRecordId,
        reason: "decision_record_not_found",
        detail: `Decision Record ${decisionRecordId} not found for organization`,
      })
      continue
    }

    if (record.organizationId !== workOrder.organizationId) {
      violations.push({
        decisionRecordId,
        reason: "cross_organization",
        detail: `Decision Record belongs to organization ${record.organizationId}`,
      })
    }

    if (record.missionId !== workOrder.missionId) {
      violations.push({
        decisionRecordId,
        reason: "mission_mismatch",
        detail: `Decision Record mission ${record.missionId} does not match Work Order mission ${workOrder.missionId}`,
      })
    }

    if (record.workOrderId && record.workOrderId !== workOrder.id) {
      violations.push({
        decisionRecordId,
        reason: "work_order_mismatch",
        detail: `Decision Record work order ${record.workOrderId} does not match Work Order ${workOrder.id}`,
      })
    }

    if (
      record.entityType &&
      workOrder.entityType &&
      record.entityType !== workOrder.entityType
    ) {
      violations.push({
        decisionRecordId,
        reason: "entity_mismatch",
        detail: `Decision Record entity type ${record.entityType} does not match Work Order entity type ${workOrder.entityType}`,
      })
    }

    if (record.entityId && workOrder.entityId && record.entityId !== workOrder.entityId) {
      violations.push({
        decisionRecordId,
        reason: "entity_mismatch",
        detail: `Decision Record entity id ${record.entityId} does not match Work Order entity id ${workOrder.entityId}`,
      })
    }
  }

  if (violations.length > 0) {
    const primaryReason = violations[0]?.reason ?? "decision_record_not_found"
    return blocked(primaryReason, violations[0]?.detail ?? "Decision Gate validation failed", violations)
  }

  const matchedRecords = workOrder.decisionRecordIds
    .map((id) => recordsById.get(id))
    .filter((record): record is NonNullable<typeof record> => Boolean(record))

  return {
    passed: true,
    decisionRecordIds: workOrder.decisionRecordIds,
    decisionRecords: matchedRecords,
  }
}

export function isAiDecisionGateBlockReason(value: unknown): value is AiDecisionGateBlockReason {
  return (
    typeof value === "string" &&
    [
      "missing_decision_records",
      "decision_record_not_found",
      "cross_organization",
      "mission_mismatch",
      "work_order_mismatch",
      "entity_mismatch",
    ].includes(value)
  )
}

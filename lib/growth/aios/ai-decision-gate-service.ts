/** GE-AIOS-2E — Decision Gate service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiDecisionRecordsByIds, insertAiDecisionRecordAuditEvent } from "@/lib/growth/aios/ai-decision-record-repository"
import type { AiDecisionRecord } from "@/lib/growth/aios/ai-decision-record-types"
import {
  resolveDecisionGateBlockedWorkOrderStatus,
  type AiDecisionGateEvaluateInput,
  type AiDecisionGateValidationResult,
} from "@/lib/growth/aios/ai-decision-gate-types"
import { validateAiWorkOrderDecisionGate } from "@/lib/growth/aios/ai-decision-gate-validator"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  canTransitionAiWorkOrderStatus,
} from "@/lib/growth/aios/ai-work-order-status-machine"
import {
  fetchAiWorkOrderById,
  insertAiWorkOrderEvent,
  updateAiWorkOrderRow,
} from "@/lib/growth/aios/ai-work-order-repository"
import type { AiWorkOrder, AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

export type AiDecisionGateEvaluation = AiDecisionGateValidationResult & {
  workOrder: AiWorkOrder
}

async function publishDecisionGateEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: "decision.gate_passed" | "decision.gate_blocked"
    workOrder: AiWorkOrder
    actingAgent?: string | null
    source?: string
    payload: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "decision",
    producer: "ai_decision_gate",
    source: input.source ?? "ai_decision_gate_service",
    missionId: input.workOrder.missionId,
    workOrderId: input.workOrder.id,
    agentOwner: (input.actingAgent as AiWorkOrderAgent | undefined) ?? input.workOrder.assignedAgent,
    entityType: input.workOrder.entityType,
    entityId: input.workOrder.entityId,
    correlationId: input.workOrder.id,
    payload: input.payload,
    metadata: {
      work_order_status: input.workOrder.status,
    },
  })
}

export async function evaluateAiWorkOrderDecisionGate(
  admin: SupabaseClient,
  input: AiDecisionGateEvaluateInput,
): Promise<AiDecisionGateEvaluation> {
  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  const decisionRecords = await fetchAiDecisionRecordsByIds(admin, {
    organizationId: input.organizationId,
    decisionRecordIds: workOrder.decisionRecordIds,
  })

  const validation = validateAiWorkOrderDecisionGate({ workOrder, decisionRecords })
  return { ...validation, workOrder }
}

async function recordGatePassedAudit(
  admin: SupabaseClient,
  input: {
    workOrder: AiWorkOrder
    decisionRecords: AiDecisionRecord[]
    actingAgent?: string | null
    source?: string
  },
): Promise<void> {
  await insertAiWorkOrderEvent(admin, {
    workOrderId: input.workOrder.id,
    organizationId: input.workOrder.organizationId,
    eventType: "work_order.decision_gate_passed",
    fromStatus: input.workOrder.status,
    toStatus: input.workOrder.status,
    title: "Decision Gate passed",
    description: `${input.decisionRecords.length} Decision Record(s) validated`,
    metadata: {
      acting_agent: input.actingAgent ?? null,
      source: input.source ?? "ai_decision_gate_service",
      decision_record_ids: input.decisionRecords.map((record) => record.id),
    },
  })

  for (const decisionRecord of input.decisionRecords) {
    await insertAiDecisionRecordAuditEvent(admin, {
      decisionRecordId: decisionRecord.id,
      organizationId: decisionRecord.organizationId,
      eventType: "referenced",
      workOrderId: input.workOrder.id,
      metadata: {
        gate: "passed",
        work_order_status: input.workOrder.status,
      },
    })
  }
}

async function recordGateBlockedAudit(
  admin: SupabaseClient,
  input: {
    workOrder: AiWorkOrder
    validation: Extract<AiDecisionGateValidationResult, { passed: false }>
    actingAgent?: string | null
    source?: string
    blockedToStatus?: AiWorkOrder["status"] | null
  },
): Promise<AiWorkOrder> {
  let currentWorkOrder = input.workOrder

  await insertAiWorkOrderEvent(admin, {
    workOrderId: currentWorkOrder.id,
    organizationId: currentWorkOrder.organizationId,
    eventType: "work_order.decision_gate_blocked",
    fromStatus: currentWorkOrder.status,
    toStatus: input.blockedToStatus ?? currentWorkOrder.status,
    severity: "high",
    title: "Decision Gate blocked execution",
    description: input.validation.detail,
    metadata: {
      acting_agent: input.actingAgent ?? null,
      source: input.source ?? "ai_decision_gate_service",
      block_reason: input.validation.blockReason,
      violations: input.validation.violations,
      decision_record_ids: currentWorkOrder.decisionRecordIds,
    },
  })

  if (
    input.blockedToStatus &&
    input.blockedToStatus !== currentWorkOrder.status &&
    canTransitionAiWorkOrderStatus(currentWorkOrder.status, input.blockedToStatus)
  ) {
    currentWorkOrder = await updateAiWorkOrderRow(admin, {
      organizationId: currentWorkOrder.organizationId,
      workOrderId: currentWorkOrder.id,
      patch: { status: input.blockedToStatus },
    })

    await insertAiWorkOrderEvent(admin, {
      workOrderId: currentWorkOrder.id,
      organizationId: currentWorkOrder.organizationId,
      eventType: "work_order.status_changed",
      fromStatus: input.workOrder.status,
      toStatus: input.blockedToStatus,
      severity: "medium",
      title: `Status ${input.workOrder.status} → ${input.blockedToStatus}`,
      description: "Decision Gate blocked execution",
      metadata: {
        acting_agent: input.actingAgent ?? null,
        decision_gate_blocked: true,
        block_reason: input.validation.blockReason,
      },
    })
  }

  return currentWorkOrder
}

export async function assertAiWorkOrderDecisionGateForExecution(
  admin: SupabaseClient,
  input: AiDecisionGateEvaluateInput,
): Promise<{ workOrder: AiWorkOrder; decisionRecords: AiDecisionRecord[] }> {
  const evaluation = await evaluateAiWorkOrderDecisionGate(admin, input)

  if (!evaluation.passed) {
    const blockedToStatus = resolveDecisionGateBlockedWorkOrderStatus(evaluation.workOrder.status)
    const workOrder = await recordGateBlockedAudit(admin, {
      workOrder: evaluation.workOrder,
      validation: evaluation,
      actingAgent: input.actingAgent,
      source: input.source,
      blockedToStatus,
    })

    await publishDecisionGateEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.gate_blocked",
      workOrder,
      actingAgent: input.actingAgent,
      source: input.source,
      payload: {
        block_reason: evaluation.blockReason,
        detail: evaluation.detail,
        violations: evaluation.violations,
        decision_record_ids: workOrder.decisionRecordIds,
        blocked_to_status: blockedToStatus,
      },
    })

    throw new Error(`ai_decision_gate_blocked: ${evaluation.blockReason}`)
  }

  await recordGatePassedAudit(admin, {
    workOrder: evaluation.workOrder,
    decisionRecords: evaluation.decisionRecords,
    actingAgent: input.actingAgent,
    source: input.source,
  })

  await publishDecisionGateEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.gate_passed",
    workOrder: evaluation.workOrder,
    actingAgent: input.actingAgent,
    source: input.source,
    payload: {
      decision_record_ids: evaluation.decisionRecords.map((record) => record.id),
      decision_count: evaluation.decisionRecords.length,
    },
  })

  return {
    workOrder: evaluation.workOrder,
    decisionRecords: evaluation.decisionRecords,
  }
}

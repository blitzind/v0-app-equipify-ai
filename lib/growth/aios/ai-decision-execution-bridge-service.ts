/** GE-AIOS-2I — Decision Engine execution bridge (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertAiWorkOrderDecisionGateForExecution,
  evaluateAiWorkOrderDecisionGate,
} from "@/lib/growth/aios/ai-decision-gate-service"
import { resolveDecisionGateBlockedWorkOrderStatus } from "@/lib/growth/aios/ai-decision-gate-types"
import {
  fetchAiDecisionEngineRuntime,
  runAiDecisionEngineForWorkOrder,
} from "@/lib/growth/aios/ai-decision-engine-service"
import type { AiDecisionExecutionBridgeInput } from "@/lib/growth/aios/ai-decision-execution-bridge-types"
import {
  hasExecutableDecisionRecords,
  shouldBlockForInsufficientExistingRecords,
  shouldInvokeDecisionEngineForGateResult,
} from "@/lib/growth/aios/ai-decision-execution-bridge-types"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  canTransitionAiWorkOrderStatus,
} from "@/lib/growth/aios/ai-work-order-status-machine"
import {
  insertAiWorkOrderEvent,
  updateAiWorkOrderRow,
} from "@/lib/growth/aios/ai-work-order-repository"
import type { AiWorkOrder, AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

async function publishBridgeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    workOrder: AiWorkOrder
    actingAgent?: string | null
    source?: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "decision",
    producer: "ai_decision_execution_bridge",
    source: input.source ?? "ai_decision_execution_bridge_service",
    missionId: input.workOrder.missionId,
    workOrderId: input.workOrder.id,
    agentOwner: (input.actingAgent as AiWorkOrderAgent | undefined) ?? input.workOrder.assignedAgent,
    entityType: input.workOrder.entityType,
    entityId: input.workOrder.entityId,
    correlationId: input.workOrder.id,
    payload: input.payload ?? {},
  })
}

async function blockExecutionViaBridge(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workOrder: AiWorkOrder
    actingAgent?: string | null
    source?: string
    blockReason: string
    detail: string
    decisionRecordId?: string | null
  },
): Promise<AiWorkOrder> {
  const blockedToStatus = resolveDecisionGateBlockedWorkOrderStatus(input.workOrder.status)
  let currentWorkOrder = input.workOrder

  await insertAiWorkOrderEvent(admin, {
    workOrderId: currentWorkOrder.id,
    organizationId: currentWorkOrder.organizationId,
    eventType: "work_order.decision_engine_bridge_blocked",
    fromStatus: currentWorkOrder.status,
    toStatus: blockedToStatus ?? currentWorkOrder.status,
    severity: "high",
    title: "Decision Engine bridge blocked execution",
    description: input.detail,
    metadata: {
      acting_agent: input.actingAgent ?? null,
      block_reason: input.blockReason,
      decision_record_id: input.decisionRecordId ?? null,
    },
  })

  if (
    blockedToStatus &&
    blockedToStatus !== currentWorkOrder.status &&
    canTransitionAiWorkOrderStatus(currentWorkOrder.status, blockedToStatus)
  ) {
    currentWorkOrder = await updateAiWorkOrderRow(admin, {
      organizationId: currentWorkOrder.organizationId,
      workOrderId: currentWorkOrder.id,
      patch: { status: blockedToStatus },
    })
  }

  await publishBridgeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.engine_blocked_execution",
    workOrder: currentWorkOrder,
    actingAgent: input.actingAgent,
    source: input.source,
    payload: {
      block_reason: input.blockReason,
      detail: input.detail,
      decision_record_id: input.decisionRecordId ?? null,
      blocked_to_status: blockedToStatus,
    },
  })

  return currentWorkOrder
}

export async function prepareAiWorkOrderForExecutionViaDecisionBridge(
  admin: SupabaseClient,
  input: AiDecisionExecutionBridgeInput,
) {
  let engineInvoked = false
  let skippedExistingRecord = false

  let gateEvaluation = await evaluateAiWorkOrderDecisionGate(admin, input)
  let workOrder = gateEvaluation.workOrder

  if (gateEvaluation.passed && hasExecutableDecisionRecords(gateEvaluation.decisionRecords)) {
    skippedExistingRecord = true
    await publishBridgeEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.engine_skipped_existing_record",
      workOrder,
      actingAgent: input.actingAgent,
      source: input.source,
      payload: {
        decision_record_ids: gateEvaluation.decisionRecords.map((record) => record.id),
      },
    })
  } else if (gateEvaluation.passed && shouldBlockForInsufficientExistingRecords(gateEvaluation)) {
    await blockExecutionViaBridge(admin, {
      organizationId: input.organizationId,
      workOrder,
      actingAgent: input.actingAgent,
      source: input.source,
      blockReason: "insufficient_evidence",
      detail: "Linked Decision Records are insufficient for execution",
      decisionRecordId: gateEvaluation.decisionRecords[0]?.id ?? null,
    })
    throw new Error("ai_decision_engine_bridge_blocked: insufficient_evidence")
  } else if (shouldInvokeDecisionEngineForGateResult(gateEvaluation)) {
    const runtime = await fetchAiDecisionEngineRuntime(admin, {
      organizationId: input.organizationId,
    })
    if (runtime?.degraded) {
      await blockExecutionViaBridge(admin, {
        organizationId: input.organizationId,
        workOrder,
        actingAgent: input.actingAgent,
        source: input.source,
        blockReason: "decision_engine_degraded",
        detail: runtime.degradedReason ?? "Decision Engine is in degraded mode",
      })
      throw new Error("ai_decision_engine_bridge_blocked: decision_engine_degraded")
    }

    await publishBridgeEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.engine_invoked",
      workOrder,
      actingAgent: input.actingAgent,
      source: input.source,
      payload: { work_order_type: workOrder.workOrderType },
    })

    engineInvoked = true
    const engineResult = await runAiDecisionEngineForWorkOrder(admin, {
      organizationId: input.organizationId,
      workOrderId: input.workOrderId,
    })

    workOrder = engineResult.workOrder

    if (
      engineResult.evaluation.requestStatus === "insufficient_evidence" ||
      engineResult.decisionRecord.decisionKey === "insufficient_evidence" ||
      !engineResult.evaluation.recommendation.proceed
    ) {
      await blockExecutionViaBridge(admin, {
        organizationId: input.organizationId,
        workOrder,
        actingAgent: input.actingAgent,
        source: input.source,
        blockReason: "insufficient_evidence",
        detail: engineResult.evaluation.recommendation.explanation,
        decisionRecordId: engineResult.decisionRecord.id,
      })
      throw new Error("ai_decision_engine_bridge_blocked: insufficient_evidence")
    }

    gateEvaluation = await evaluateAiWorkOrderDecisionGate(admin, input)
    workOrder = gateEvaluation.workOrder

    if (!gateEvaluation.passed || !hasExecutableDecisionRecords(
      gateEvaluation.passed ? gateEvaluation.decisionRecords : [],
    )) {
      await blockExecutionViaBridge(admin, {
        organizationId: input.organizationId,
        workOrder,
        actingAgent: input.actingAgent,
        source: input.source,
        blockReason: "gate_validation_failed",
        detail: gateEvaluation.passed
          ? "Decision Record failed executable validation after engine run"
          : gateEvaluation.detail,
      })
      throw new Error("ai_decision_engine_bridge_blocked: gate_validation_failed")
    }
  }

  const gateResult = await assertAiWorkOrderDecisionGateForExecution(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    actingAgent: input.actingAgent ?? null,
    source: input.source ?? "ai_decision_execution_bridge_service",
  })

  await publishBridgeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.execution_bridge_completed",
    workOrder: gateResult.workOrder,
    actingAgent: input.actingAgent,
    source: input.source,
    payload: {
      decision_record_ids: gateResult.decisionRecords.map((record) => record.id),
      engine_invoked: engineInvoked,
      skipped_existing_record: skippedExistingRecord,
    },
  })

  return {
    ...gateResult,
    bridge: {
      engineInvoked,
      skippedExistingRecord,
    },
  }
}

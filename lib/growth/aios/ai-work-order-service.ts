/** GE-AIOS-2A — AI Work Order service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertAiWorkOrderTransitionAllowed,
  canArchiveAiWorkOrderStatus,
  canCancelAiWorkOrderStatus,
  canRetryAiWorkOrder,
} from "@/lib/growth/aios/ai-work-order-status-machine"
import {
  fetchAiWorkOrderById,
  insertAiWorkOrder,
  insertAiWorkOrderEvent,
  listAiWorkOrderEvents,
  listAiWorkOrders,
  updateAiWorkOrderRow,
} from "@/lib/growth/aios/ai-work-order-repository"
import type {
  AiWorkOrder,
  AiWorkOrderArchiveInput,
  AiWorkOrderCancelInput,
  AiWorkOrderCreateInput,
  AiWorkOrderEvent,
  AiWorkOrderListFilter,
  AiWorkOrderRetryInput,
  AiWorkOrderStatus,
  AiWorkOrderTransitionInput,
} from "@/lib/growth/aios/ai-work-order-types"

function nowIso(): string {
  return new Date().toISOString()
}

function executionTimestampPatch(
  from: AiWorkOrderStatus,
  to: AiWorkOrderStatus,
  workOrder: AiWorkOrder,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: to }

  if (to === "executing" && !workOrder.startedAt) {
    patch.started_at = nowIso()
  }
  if (to === "completed") {
    patch.completed_at = nowIso()
    if (patch.result === undefined && workOrder.result) {
      patch.result = workOrder.result
    }
  }
  if (to === "cancelled") {
    patch.cancelled_at = nowIso()
  }
  if (to === "failed" && from !== "failed") {
    patch.completed_at = null
  }
  if (to === "issued" && from === "failed") {
    patch.failure_reason = null
    patch.completed_at = null
    patch.cancelled_at = null
  }

  return patch
}

export async function createAiWorkOrder(
  admin: SupabaseClient,
  input: AiWorkOrderCreateInput,
): Promise<{ workOrder: AiWorkOrder; event: AiWorkOrderEvent }> {
  const workOrder = await insertAiWorkOrder(admin, input)
  const event = await insertAiWorkOrderEvent(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    eventType: "work_order.created",
    toStatus: workOrder.status,
    title: "AI Work Order created",
    description: `${workOrder.workOrderType} issued to ${workOrder.assignedAgent}`,
    metadata: {
      owner_agent: workOrder.ownerAgent,
      assigned_agent: workOrder.assignedAgent,
      mission_id: workOrder.missionId,
      priority: workOrder.priority,
    },
  })
  try {
    const { bridgeAiWorkOrderAuditToEventBus } = await import(
      "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
    )
    await bridgeAiWorkOrderAuditToEventBus(admin, { workOrder, workOrderEvent: event })
  } catch {
    // Bridge failure must not block work order lifecycle.
  }
  return { workOrder, event }
}

export async function getAiWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string },
): Promise<AiWorkOrder | null> {
  return fetchAiWorkOrderById(admin, input)
}

export async function queryAiWorkOrders(
  admin: SupabaseClient,
  filter: AiWorkOrderListFilter,
): Promise<AiWorkOrder[]> {
  return listAiWorkOrders(admin, filter)
}

export async function transitionAiWorkOrder(
  admin: SupabaseClient,
  input: AiWorkOrderTransitionInput,
): Promise<{ workOrder: AiWorkOrder; event: AiWorkOrderEvent }> {
  const existing = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!existing) throw new Error("ai_work_order_not_found")

  assertAiWorkOrderTransitionAllowed(existing.status, input.toStatus)

  if (input.toStatus === "executing") {
    const { prepareAiWorkOrderForExecutionViaDecisionBridge } = await import(
      "@/lib/growth/aios/ai-decision-execution-bridge-service"
    )
    await prepareAiWorkOrderForExecutionViaDecisionBridge(admin, {
      organizationId: input.organizationId,
      workOrderId: input.workOrderId,
      actingAgent: input.actingAgent ?? null,
      source: "ai_work_order_service",
    })
  }

  const patch = executionTimestampPatch(existing.status, input.toStatus, existing)
  if (input.result !== undefined) patch.result = input.result
  if (input.failureReason !== undefined) patch.failure_reason = input.failureReason
  if (input.checkpoint !== undefined) patch.checkpoint = input.checkpoint

  const workOrder = await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    patch,
  })

  const event = await insertAiWorkOrderEvent(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    eventType: "work_order.status_changed",
    fromStatus: existing.status,
    toStatus: input.toStatus,
    title: `Status ${existing.status} → ${input.toStatus}`,
    description: input.reason ?? "",
    metadata: {
      acting_agent: input.actingAgent ?? null,
      ...(input.metadata ?? {}),
    },
  })

  try {
    const { bridgeAiWorkOrderAuditToEventBus } = await import(
      "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
    )
    await bridgeAiWorkOrderAuditToEventBus(admin, { workOrder, workOrderEvent: event })
  } catch {
    // Bridge failure must not block work order lifecycle.
  }

  return { workOrder, event }
}

export async function cancelAiWorkOrder(
  admin: SupabaseClient,
  input: AiWorkOrderCancelInput,
): Promise<{ workOrder: AiWorkOrder; event: AiWorkOrderEvent }> {
  const existing = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!existing) throw new Error("ai_work_order_not_found")
  if (!canCancelAiWorkOrderStatus(existing.status)) {
    throw new Error(`ai_work_order_not_cancellable: ${existing.status}`)
  }

  return transitionAiWorkOrder(admin, {
    workOrderId: input.workOrderId,
    organizationId: input.organizationId,
    toStatus: "cancelled",
    reason: input.reason ?? "cancelled",
    metadata: { requested_by: input.requestedBy ?? null },
  })
}

export async function retryAiWorkOrder(
  admin: SupabaseClient,
  input: AiWorkOrderRetryInput,
): Promise<{ workOrder: AiWorkOrder; event: AiWorkOrderEvent }> {
  const existing = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!existing) throw new Error("ai_work_order_not_found")
  if (!canRetryAiWorkOrder(existing)) {
    throw new Error("ai_work_order_retry_not_allowed")
  }

  const workOrder = await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    patch: {
      status: "issued",
      retry_count: existing.retryCount + 1,
      failure_reason: null,
      completed_at: null,
      cancelled_at: null,
    },
  })

  const event = await insertAiWorkOrderEvent(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    eventType: "work_order.retrying",
    fromStatus: existing.status,
    toStatus: "issued",
    severity: "medium",
    title: "AI Work Order retry",
    description: input.reason ?? `Retry ${workOrder.retryCount}/${workOrder.maxRetries}`,
    metadata: {
      requested_by: input.requestedBy ?? null,
      retry_count: workOrder.retryCount,
    },
  })

  try {
    const { bridgeAiWorkOrderAuditToEventBus } = await import(
      "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
    )
    await bridgeAiWorkOrderAuditToEventBus(admin, { workOrder, workOrderEvent: event })
  } catch {
    // Bridge failure must not block work order lifecycle.
  }

  return { workOrder, event }
}

export async function archiveAiWorkOrder(
  admin: SupabaseClient,
  input: AiWorkOrderArchiveInput,
): Promise<{ workOrder: AiWorkOrder; event: AiWorkOrderEvent }> {
  const existing = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!existing) throw new Error("ai_work_order_not_found")
  if (!canArchiveAiWorkOrderStatus(existing.status)) {
    throw new Error(`ai_work_order_not_archivable: ${existing.status}`)
  }
  if (existing.archivedAt) {
    throw new Error("ai_work_order_already_archived")
  }

  const workOrder = await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    patch: { archived_at: nowIso() },
  })

  const event = await insertAiWorkOrderEvent(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    eventType: "work_order.archived",
    fromStatus: existing.status,
    toStatus: existing.status,
    title: "AI Work Order archived",
    description: input.reason ?? "",
    metadata: {},
  })

  try {
    const { bridgeAiWorkOrderAuditToEventBus } = await import(
      "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
    )
    await bridgeAiWorkOrderAuditToEventBus(admin, { workOrder, workOrderEvent: event })
  } catch {
    // Bridge failure must not block work order lifecycle.
  }

  return { workOrder, event }
}

export async function getAiWorkOrderAuditTrail(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; limit?: number },
): Promise<AiWorkOrderEvent[]> {
  return listAiWorkOrderEvents(admin, input)
}

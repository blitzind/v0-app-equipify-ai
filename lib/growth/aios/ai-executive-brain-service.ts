/** GE-AIOS-2G — Executive Brain service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureExecutiveBrainEventHandlerRegistered } from "@/lib/growth/aios/ai-executive-brain-event-handler"
import {
  fetchAiExecutiveBrainRuntime,
  fetchAiExecutiveDelegationById,
  insertAiExecutiveDelegation,
  insertAiExecutiveHeartbeatEvent,
  listAiExecutiveDelegationsForMission,
  updateAiExecutiveBrainRuntime,
  updateAiExecutiveDelegation,
  upsertAiExecutiveBrainRuntime,
  upsertAiExecutiveMissionState,
} from "@/lib/growth/aios/ai-executive-brain-repository"
import type {
  AiExecutiveBrainHeartbeatInput,
  AiExecutiveBrainStartInput,
  AiExecutiveCompleteMissionInput,
  AiExecutiveDelegateWorkOrderInput,
  AiExecutiveEscalateDelegationInput,
  AiExecutiveMonitorMissionInput,
} from "@/lib/growth/aios/ai-executive-brain-types"
import {
  AI_EXECUTIVE_BRAIN_EVENT_CATEGORIES,
  AI_EXECUTIVE_BRAIN_EVENT_PREFIXES,
  AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID,
} from "@/lib/growth/aios/ai-executive-brain-types"
import {
  classifyExecutiveWorkOrderCounts,
  executiveWorkOrderDispatchPlan,
  isExecutiveMissionComplete,
} from "@/lib/growth/aios/ai-executive-work-order-dispatcher"
import { registerAiOsEventSubscription, publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { createAiWorkOrder, transitionAiWorkOrder } from "@/lib/growth/aios/ai-work-order-service"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishExecutiveEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId?: string | null
    workOrderId?: string | null
    correlationId?: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "executive",
    producer: "executive_brain",
    source: "ai_executive_brain_service",
    agentOwner: "executive_brain",
    missionId: input.missionId ?? null,
    workOrderId: input.workOrderId ?? null,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
  })
}

export async function registerExecutiveBrainEventSubscriptions(
  admin: SupabaseClient,
  input: { organizationId: string; executiveRuntimeId: string },
) {
  return registerAiOsEventSubscription(admin, {
    organizationId: input.organizationId,
    subscriberId: AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID,
    subscriberKind: "internal",
    categories: [...AI_EXECUTIVE_BRAIN_EVENT_CATEGORIES],
    eventTypePrefixes: [...AI_EXECUTIVE_BRAIN_EVENT_PREFIXES],
    enabled: true,
    metadata: {
      executive_runtime_id: input.executiveRuntimeId,
    },
  })
}

export async function startAiExecutiveBrainRuntime(
  admin: SupabaseClient,
  input: AiExecutiveBrainStartInput,
) {
  const runtime = await upsertAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    instanceId: input.instanceId,
    runtimeStatus: "planning",
    metadata: input.metadata ?? {},
  })

  await registerExecutiveBrainEventSubscriptions(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
  })

  ensureExecutiveBrainEventHandlerRegistered(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
  })

  await publishExecutiveEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.started",
    correlationId: runtime.id,
    payload: {
      instance_id: input.instanceId,
      executive_runtime_id: runtime.id,
    },
  })

  const updated = await updateAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
    patch: { runtime_status: "idle", last_tick_at: nowIso() },
  })

  return updated
}

export async function heartbeatAiExecutiveBrainRuntime(
  admin: SupabaseClient,
  input: AiExecutiveBrainHeartbeatInput,
) {
  const runtime = await fetchAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })
  if (!runtime) throw new Error("ai_executive_brain_runtime_not_found")

  const runtimeStatus = input.runtimeStatus ?? runtime.runtimeStatus
  const healthStatus = input.healthStatus ?? runtime.healthStatus
  const lastHeartbeatAt = nowIso()

  const updated = await updateAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
    patch: {
      runtime_status: runtimeStatus,
      health_status: healthStatus,
      last_heartbeat_at: lastHeartbeatAt,
    },
  })

  const heartbeat = await insertAiExecutiveHeartbeatEvent(admin, {
    executiveRuntimeId: runtime.id,
    organizationId: runtime.organizationId,
    runtimeStatus,
    healthStatus,
    metadata: input.metadata ?? {},
  })

  return { runtime: updated, heartbeat }
}

export async function delegateAiExecutiveWorkOrder(
  admin: SupabaseClient,
  input: AiExecutiveDelegateWorkOrderInput,
) {
  const runtime = await fetchAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })
  if (!runtime) throw new Error("ai_executive_brain_runtime_not_found")

  const dispatch = executiveWorkOrderDispatchPlan({
    workOrderType: input.workOrderType,
    assignedAgent: input.assignedAgent,
  })

  const { workOrder } = await createAiWorkOrder(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    ownerAgent: dispatch.ownerAgent,
    assignedAgent: dispatch.assignedAgent,
    workOrderType: input.workOrderType,
    entityType: input.entityType,
    entityId: input.entityId,
    priority: input.priority,
    payload: input.payload ?? {},
    requestedBy: runtime.id,
    auditMetadata: {
      executive_runtime_id: runtime.id,
      delegated: true,
      ...(input.metadata ?? {}),
    },
  })

  const delegation = await insertAiExecutiveDelegation(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
    workOrderId: workOrder.id,
    assignedAgent: dispatch.assignedAgent,
    metadata: input.metadata ?? {},
  })

  await upsertAiExecutiveMissionState(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
    patch: {
      mission_status: "active",
      last_delegated_at: nowIso(),
      last_tick_at: nowIso(),
    },
  })

  await updateAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
    patch: {
      runtime_status: "delegating",
      active_delegation_count: runtime.activeDelegationCount + 1,
      last_tick_at: nowIso(),
    },
  })

  await publishExecutiveEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.delegated",
    missionId: input.missionId,
    workOrderId: workOrder.id,
    correlationId: delegation.id,
    payload: {
      assigned_agent: dispatch.assignedAgent,
      work_order_type: input.workOrderType,
      delegation_id: delegation.id,
      prepare_decision: input.prepareDecision ?? false,
    },
  })

  let decisionPreparation = null
  if (input.prepareDecision) {
    const { prepareExecutiveDecisionForWorkOrder } = await import(
      "@/lib/growth/aios/ai-executive-decision-preparation-service"
    )
    decisionPreparation = await prepareExecutiveDecisionForWorkOrder(admin, {
      organizationId: input.organizationId,
      executiveRuntimeId: runtime.id,
      missionId: input.missionId,
      workOrderId: workOrder.id,
      enableAiEvidence: input.enableAiEvidence,
      decisionKey: input.decisionKey,
      source: "ai_executive_brain_service",
    })

    if (decisionPreparation.prepared) {
      await updateAiExecutiveDelegation(admin, {
        organizationId: input.organizationId,
        delegationId: delegation.id,
        patch: {
          metadata: {
            ...(delegation.metadata ?? {}),
            decision_record_id: decisionPreparation.decisionRecordId,
            decision_key: decisionPreparation.decisionKey,
            decision_prepared: true,
          },
        },
      })
    }
  }

  return { runtime, workOrder, delegation, decisionPreparation }
}

export async function monitorAiExecutiveMission(
  admin: SupabaseClient,
  input: AiExecutiveMonitorMissionInput,
) {
  const runtime = await fetchAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })
  if (!runtime) throw new Error("ai_executive_brain_runtime_not_found")

  const workOrders = await listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
  })
  const counts = classifyExecutiveWorkOrderCounts({
    statuses: workOrders.map((row) => row.status),
  })

  const delegations = await listAiExecutiveDelegationsForMission(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
  })

  const missionState = await upsertAiExecutiveMissionState(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
    patch: {
      mission_status: counts.active > 0 ? "monitoring" : counts.pending > 0 ? "active" : "monitoring",
      pending_work_order_count: counts.pending,
      active_work_order_count: counts.active,
      completed_work_order_count: counts.completed,
      last_monitored_at: nowIso(),
      last_tick_at: nowIso(),
    },
  })

  await updateAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
    patch: {
      runtime_status: "monitoring",
      last_tick_at: nowIso(),
    },
  })

  await publishExecutiveEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.monitored",
    missionId: input.missionId,
    correlationId: missionState.id,
    payload: {
      pending_work_orders: counts.pending,
      active_work_orders: counts.active,
      completed_work_orders: counts.completed,
      delegation_count: delegations.length,
    },
  })

  return { runtime, missionState, counts }
}

export async function escalateAiExecutiveDelegation(
  admin: SupabaseClient,
  input: AiExecutiveEscalateDelegationInput,
) {
  const runtime = await fetchAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })
  if (!runtime) throw new Error("ai_executive_brain_runtime_not_found")

  const delegation = await fetchAiExecutiveDelegationById(admin, {
    organizationId: input.organizationId,
    delegationId: input.delegationId,
  })
  if (!delegation) throw new Error("ai_executive_delegation_not_found")

  const { workOrder } = await transitionAiWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: delegation.workOrderId,
    toStatus: "escalated",
    actingAgent: "executive_brain",
    reason: input.reason ?? "executive_escalation",
    metadata: { executive_runtime_id: runtime.id },
  })

  const updatedDelegation = await updateAiExecutiveDelegation(admin, {
    organizationId: input.organizationId,
    delegationId: delegation.id,
    patch: { delegation_status: "escalated" },
  })

  await upsertAiExecutiveMissionState(admin, {
    organizationId: input.organizationId,
    missionId: delegation.missionId,
    executiveRuntimeId: runtime.id,
    patch: { mission_status: "escalated", last_tick_at: nowIso() },
  })

  await updateAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
    patch: { runtime_status: "escalated", last_tick_at: nowIso() },
  })

  await publishExecutiveEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.escalated",
    missionId: delegation.missionId,
    workOrderId: delegation.workOrderId,
    correlationId: delegation.id,
    payload: {
      reason: input.reason ?? "executive_escalation",
      delegation_id: delegation.id,
    },
  })

  return { runtime, workOrder, delegation: updatedDelegation }
}

export async function completeAiExecutiveMission(
  admin: SupabaseClient,
  input: AiExecutiveCompleteMissionInput,
) {
  const runtime = await fetchAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })
  if (!runtime) throw new Error("ai_executive_brain_runtime_not_found")

  const workOrders = await listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
  })
  const counts = classifyExecutiveWorkOrderCounts({
    statuses: workOrders.map((row) => row.status),
  })
  const delegations = await listAiExecutiveDelegationsForMission(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
  })

  if (!isExecutiveMissionComplete({ ...counts, totalDelegations: delegations.length })) {
    throw new Error("ai_executive_mission_not_complete")
  }

  const missionState = await upsertAiExecutiveMissionState(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
    patch: {
      mission_status: "completed",
      pending_work_order_count: counts.pending,
      active_work_order_count: counts.active,
      completed_work_order_count: counts.completed,
      last_tick_at: nowIso(),
    },
  })

  const updatedRuntime = await updateAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: runtime.id,
    patch: { runtime_status: "completed", last_tick_at: nowIso() },
  })

  await publishExecutiveEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.completed",
    missionId: input.missionId,
    correlationId: missionState.id,
    payload: {
      completed_work_orders: counts.completed,
      delegation_count: delegations.length,
    },
  })

  return { runtime: updatedRuntime, missionState }
}

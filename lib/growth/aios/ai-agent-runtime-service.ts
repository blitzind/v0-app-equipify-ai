/** GE-AIOS-2C — AI Agent Runtime service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { defaultCapabilitiesForAgent } from "@/lib/growth/aios/ai-agent-runtime-capabilities"
import {
  fetchActiveAiOsAgentLeaseForWorkOrder,
  fetchAiOsAgentLeaseById,
  fetchAiOsAgentRegistration,
  insertAiOsAgentHeartbeatEvent,
  insertAiOsAgentLease,
  listAiOsAgentCapabilities,
  updateAiOsAgentLease,
  updateAiOsAgentRegistration,
  upsertAiOsAgentCapability,
  upsertAiOsAgentRegistration,
} from "@/lib/growth/aios/ai-agent-runtime-repository"
import type {
  AiOsAgentClaimWorkOrderInput,
  AiOsAgentEscalateLeaseInput,
  AiOsAgentFailLeaseInput,
  AiOsAgentHeartbeatInput,
  AiOsAgentRegisterInput,
  AiOsAgentReleaseLeaseInput,
  AiOsAgentRetryWorkOrderInput,
  AiOsAgentCapabilityInput,
} from "@/lib/growth/aios/ai-agent-runtime-types"
import {
  AI_OS_AGENT_DEFAULT_LEASE_TTL_MS,
  isAgentHeartbeatStale,
} from "@/lib/growth/aios/ai-agent-runtime-types"
import {
  buildClaimTransitionPath,
  canAgentRuntimeClaimWorkOrderStatus,
} from "@/lib/growth/aios/ai-agent-runtime-work-order"
import {
  fetchAiWorkOrderById,
} from "@/lib/growth/aios/ai-work-order-repository"
import { transitionAiWorkOrder } from "@/lib/growth/aios/ai-work-order-service"
import type { AiWorkOrder } from "@/lib/growth/aios/ai-work-order-types"

function nowIso(): string {
  return new Date().toISOString()
}

function leaseExpiresAt(ttlMs: number): string {
  return new Date(Date.now() + ttlMs).toISOString()
}

async function publishAgentRuntimeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    agentKey: string
    missionId?: string | null
    workOrderId?: string | null
    correlationId?: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "agent",
    producer: "ai_agent_runtime",
    source: "ai_agent_runtime_service",
    agentOwner: input.agentKey as AiWorkOrder["ownerAgent"],
    missionId: input.missionId ?? null,
    workOrderId: input.workOrderId ?? null,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
  })
}

async function advanceWorkOrderToExecuting(
  admin: SupabaseClient,
  workOrder: AiWorkOrder,
  actingAgent: string,
): Promise<AiWorkOrder> {
  const path = buildClaimTransitionPath(workOrder.status)
  if (path.length === 0 || path[path.length - 1] !== "executing") {
    throw new Error(`ai_agent_claim_invalid_status: ${workOrder.status}`)
  }

  let current = workOrder
  for (const toStatus of path) {
    const result = await transitionAiWorkOrder(admin, {
      workOrderId: current.id,
      organizationId: current.organizationId,
      toStatus,
      actingAgent: actingAgent as AiWorkOrder["ownerAgent"],
      reason: "agent_runtime_claim",
      metadata: { agent_runtime: true },
    })
    current = result.workOrder
  }
  return current
}

async function adjustActiveLeaseCount(
  admin: SupabaseClient,
  input: { organizationId: string; registrationId: string; delta: number },
): Promise<void> {
  const registration = await fetchAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: input.registrationId,
  })
  if (!registration) return

  await updateAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: input.registrationId,
    patch: {
      active_lease_count: Math.max(0, registration.activeLeaseCount + input.delta),
    },
  })
}

export async function registerAiOsAgentRuntime(
  admin: SupabaseClient,
  input: AiOsAgentRegisterInput,
) {
  const registration = await upsertAiOsAgentRegistration(admin, input)

  const capabilities = []
  if (input.seedDefaultCapabilities !== false) {
    for (const workOrderType of defaultCapabilitiesForAgent(input.agentKey)) {
      capabilities.push(
        await upsertAiOsAgentCapability(admin, {
          organizationId: input.organizationId,
          agentKey: input.agentKey,
          workOrderType,
        }),
      )
    }
  }

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.registered",
    agentKey: input.agentKey,
    correlationId: registration.id,
    payload: {
      instance_id: input.instanceId,
      registration_id: registration.id,
      capabilities_seeded: capabilities.length,
    },
  })

  return { registration, capabilities }
}

export async function advertiseAiOsAgentCapabilities(
  admin: SupabaseClient,
  input: AiOsAgentCapabilityInput,
) {
  return upsertAiOsAgentCapability(admin, input)
}

export async function heartbeatAiOsAgentRuntime(
  admin: SupabaseClient,
  input: AiOsAgentHeartbeatInput,
) {
  const registration = await fetchAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: input.agentRegistrationId,
  })
  if (!registration) throw new Error("ai_agent_registration_not_found")

  const runtimeStatus = input.runtimeStatus ?? registration.runtimeStatus
  const healthStatus = input.healthStatus ?? registration.healthStatus
  const lastHeartbeatAt = nowIso()

  const updated = await updateAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: input.agentRegistrationId,
    patch: {
      runtime_status: runtimeStatus,
      health_status: healthStatus,
      last_heartbeat_at: lastHeartbeatAt,
    },
  })

  const heartbeat = await insertAiOsAgentHeartbeatEvent(admin, {
    agentRegistrationId: registration.id,
    organizationId: registration.organizationId,
    agentKey: registration.agentKey,
    instanceId: registration.instanceId,
    runtimeStatus,
    healthStatus,
    metadata: input.metadata ?? {},
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.heartbeat",
    agentKey: registration.agentKey,
    correlationId: registration.id,
    payload: {
      runtime_status: runtimeStatus,
      health_status: healthStatus,
      active_lease_count: updated.activeLeaseCount,
    },
  })

  return { registration: updated, heartbeat }
}

export async function claimAiOsWorkOrder(
  admin: SupabaseClient,
  input: AiOsAgentClaimWorkOrderInput,
) {
  const registration = await fetchAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: input.agentRegistrationId,
  })
  if (!registration) throw new Error("ai_agent_registration_not_found")
  if (isAgentHeartbeatStale(registration.lastHeartbeatAt)) {
    throw new Error("ai_agent_heartbeat_stale")
  }
  if (registration.activeLeaseCount >= registration.maxConcurrentLeases) {
    throw new Error("ai_agent_lease_capacity_exceeded")
  }

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")
  if (!canAgentRuntimeClaimWorkOrderStatus(workOrder.status)) {
    throw new Error(`ai_agent_claim_invalid_status: ${workOrder.status}`)
  }
  if (workOrder.assignedAgent !== registration.agentKey) {
    throw new Error("ai_agent_not_assigned")
  }

  const capabilities = await listAiOsAgentCapabilities(admin, {
    organizationId: input.organizationId,
    agentKey: registration.agentKey,
    enabledOnly: true,
  })
  const canHandle = capabilities.some((cap) => cap.workOrderType === workOrder.workOrderType)
  if (!canHandle && workOrder.workOrderType !== "custom") {
    throw new Error("ai_agent_capability_missing")
  }

  const existingLease = await fetchActiveAiOsAgentLeaseForWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (existingLease) throw new Error("ai_work_order_already_leased")

  const executingWorkOrder = await advanceWorkOrderToExecuting(
    admin,
    workOrder,
    registration.agentKey,
  )

  const lease = await insertAiOsAgentLease(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    agentRegistrationId: registration.id,
    agentKey: registration.agentKey,
    instanceId: registration.instanceId,
    expiresAt: leaseExpiresAt(input.leaseTtlMs ?? AI_OS_AGENT_DEFAULT_LEASE_TTL_MS),
    metadata: input.metadata ?? {},
  })

  await updateAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: registration.id,
    patch: {
      runtime_status: "working",
      active_lease_count: registration.activeLeaseCount + 1,
    },
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.wake",
    agentKey: registration.agentKey,
    missionId: executingWorkOrder.missionId,
    workOrderId: executingWorkOrder.id,
    correlationId: executingWorkOrder.id,
    payload: { lease_id: lease.id },
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.lease_claimed",
    agentKey: registration.agentKey,
    missionId: executingWorkOrder.missionId,
    workOrderId: executingWorkOrder.id,
    correlationId: lease.id,
    payload: {
      lease_id: lease.id,
      expires_at: lease.expiresAt,
      work_order_type: executingWorkOrder.workOrderType,
    },
  })

  return { lease, workOrder: executingWorkOrder, registration }
}

export async function releaseAiOsWorkOrderLease(
  admin: SupabaseClient,
  input: AiOsAgentReleaseLeaseInput,
) {
  const lease = await fetchAiOsAgentLeaseById(admin, {
    organizationId: input.organizationId,
    leaseId: input.leaseId,
  })
  if (!lease) throw new Error("ai_agent_lease_not_found")
  if (lease.status !== "active") throw new Error("ai_agent_lease_not_active")

  const releaseTarget = input.releaseWorkOrderTo ?? "waiting"
  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: lease.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  await transitionAiWorkOrder(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    toStatus: releaseTarget,
    actingAgent: lease.agentKey,
    reason: input.reason ?? "agent_release",
  })

  const updatedLease = await updateAiOsAgentLease(admin, {
    organizationId: input.organizationId,
    leaseId: lease.id,
    patch: {
      status: "released",
      released_at: nowIso(),
      release_reason: input.reason ?? "released",
    },
  })

  await adjustActiveLeaseCount(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
    delta: -1,
  })

  await updateAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
    patch: { runtime_status: "idle" },
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.lease_released",
    agentKey: lease.agentKey,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    correlationId: lease.id,
    payload: { release_reason: input.reason ?? "released" },
  })

  return { lease: updatedLease, workOrder }
}

export async function failAiOsWorkOrderLease(
  admin: SupabaseClient,
  input: AiOsAgentFailLeaseInput,
) {
  const lease = await fetchAiOsAgentLeaseById(admin, {
    organizationId: input.organizationId,
    leaseId: input.leaseId,
  })
  if (!lease) throw new Error("ai_agent_lease_not_found")
  if (lease.status !== "active") throw new Error("ai_agent_lease_not_active")

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: lease.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  await transitionAiWorkOrder(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    toStatus: "failed",
    actingAgent: lease.agentKey,
    reason: input.failureReason ?? "agent_fail",
    failureReason: input.failureReason ?? "agent_fail",
  })

  const updatedLease = await updateAiOsAgentLease(admin, {
    organizationId: input.organizationId,
    leaseId: lease.id,
    patch: {
      status: "failed",
      released_at: nowIso(),
      release_reason: input.failureReason ?? "failed",
    },
  })

  await adjustActiveLeaseCount(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
    delta: -1,
  })

  await updateAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
    patch: { runtime_status: "recovery" },
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.failed",
    agentKey: lease.agentKey,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    correlationId: lease.id,
    payload: { failure_reason: input.failureReason ?? "failed" },
  })

  return { lease: updatedLease, workOrder }
}

export async function escalateAiOsWorkOrderLease(
  admin: SupabaseClient,
  input: AiOsAgentEscalateLeaseInput,
) {
  const lease = await fetchAiOsAgentLeaseById(admin, {
    organizationId: input.organizationId,
    leaseId: input.leaseId,
  })
  if (!lease) throw new Error("ai_agent_lease_not_found")
  if (lease.status !== "active") throw new Error("ai_agent_lease_not_active")

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: lease.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  await transitionAiWorkOrder(admin, {
    workOrderId: workOrder.id,
    organizationId: workOrder.organizationId,
    toStatus: "escalated",
    actingAgent: lease.agentKey,
    reason: input.reason ?? "agent_escalate",
  })

  const updatedLease = await updateAiOsAgentLease(admin, {
    organizationId: input.organizationId,
    leaseId: lease.id,
    patch: {
      status: "escalated",
      released_at: nowIso(),
      release_reason: input.reason ?? "escalated",
    },
  })

  await adjustActiveLeaseCount(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
    delta: -1,
  })

  await updateAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: lease.agentRegistrationId,
    patch: { runtime_status: "escalated" },
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.escalated",
    agentKey: lease.agentKey,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    correlationId: lease.id,
    payload: { reason: input.reason ?? "escalated" },
  })

  return { lease: updatedLease, workOrder }
}

export async function retryAiOsWorkOrderViaAgent(
  admin: SupabaseClient,
  input: AiOsAgentRetryWorkOrderInput,
) {
  const registration = await fetchAiOsAgentRegistration(admin, {
    organizationId: input.organizationId,
    registrationId: input.agentRegistrationId,
  })
  if (!registration) throw new Error("ai_agent_registration_not_found")

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  const { retryAiWorkOrder } = await import("@/lib/growth/aios/ai-work-order-service")
  const retryResult = await retryAiWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    reason: input.reason ?? "agent_retry_hook",
    requestedBy: registration.id,
  })

  await publishAgentRuntimeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "agent.retry_hook",
    agentKey: registration.agentKey,
    missionId: retryResult.workOrder.missionId,
    workOrderId: retryResult.workOrder.id,
    correlationId: retryResult.workOrder.id,
    payload: {
      retry_count: retryResult.workOrder.retryCount,
      reason: input.reason ?? "agent_retry_hook",
    },
  })

  return retryResult
}

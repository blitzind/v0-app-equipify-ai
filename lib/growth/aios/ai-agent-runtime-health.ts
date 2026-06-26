/** GE-AIOS-2C — AI Agent health monitor + stale lease recovery (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  listAiOsAgentRegistrations,
  listExpiredActiveAiOsAgentLeases,
  updateAiOsAgentLease,
  updateAiOsAgentRegistration,
} from "@/lib/growth/aios/ai-agent-runtime-repository"
import type { AiOsAgentHealthReport } from "@/lib/growth/aios/ai-agent-runtime-types"
import {
  AI_OS_AGENT_HEARTBEAT_STALE_MS,
  isAgentHeartbeatStale,
} from "@/lib/growth/aios/ai-agent-runtime-types"
import { transitionAiWorkOrder } from "@/lib/growth/aios/ai-work-order-service"
import { fetchAiWorkOrderById } from "@/lib/growth/aios/ai-work-order-repository"

function nowIso(): string {
  return new Date().toISOString()
}

export async function evaluateAiOsAgentHealth(
  admin: SupabaseClient,
  input: {
    organizationId: string
    staleThresholdMs?: number
  },
): Promise<AiOsAgentHealthReport> {
  const thresholdMs = input.staleThresholdMs ?? AI_OS_AGENT_HEARTBEAT_STALE_MS
  const registrations = await listAiOsAgentRegistrations(admin, {
    organizationId: input.organizationId,
  })

  const agents = registrations.map((registration) => {
    const stale = isAgentHeartbeatStale(registration.lastHeartbeatAt, thresholdMs)
    let healthStatus = registration.healthStatus
    if (stale && healthStatus === "healthy") healthStatus = "offline"

    return {
      registrationId: registration.id,
      agentKey: registration.agentKey,
      instanceId: registration.instanceId,
      healthStatus,
      lastHeartbeatAt: registration.lastHeartbeatAt,
      stale,
      activeLeaseCount: registration.activeLeaseCount,
    }
  })

  const expired = await listExpiredActiveAiOsAgentLeases(admin, {
    organizationId: input.organizationId,
  })

  return {
    organizationId: input.organizationId,
    evaluatedAt: nowIso(),
    staleThresholdMs: thresholdMs,
    agents,
    expiredLeases: expired.length,
  }
}

export async function expireStaleAiOsAgentLeases(
  admin: SupabaseClient,
  input?: { organizationId?: string },
): Promise<{ expired: number }> {
  const leases = await listExpiredActiveAiOsAgentLeases(admin, {
    organizationId: input?.organizationId,
  })

  for (const lease of leases) {
    const workOrder = await fetchAiWorkOrderById(admin, {
      organizationId: lease.organizationId,
      workOrderId: lease.workOrderId,
    })

    await updateAiOsAgentLease(admin, {
      organizationId: lease.organizationId,
      leaseId: lease.id,
      patch: {
        status: "expired",
        released_at: nowIso(),
        release_reason: "lease_expired",
      },
    })

    if (workOrder && workOrder.status === "executing") {
      await transitionAiWorkOrder(admin, {
        workOrderId: workOrder.id,
        organizationId: workOrder.organizationId,
        toStatus: "waiting",
        actingAgent: lease.agentKey,
        reason: "lease_expired",
      })
    }

    const registration = await listAiOsAgentRegistrations(admin, {
      organizationId: lease.organizationId,
    }).then((rows) => rows.find((row) => row.id === lease.agentRegistrationId))

    if (registration) {
      await updateAiOsAgentRegistration(admin, {
        organizationId: lease.organizationId,
        registrationId: registration.id,
        patch: {
          active_lease_count: Math.max(0, registration.activeLeaseCount - 1),
          runtime_status: "waiting",
        },
      })
    }

    await publishAiOsEvent(admin, {
      organizationId: lease.organizationId,
      eventType: "agent.lease_expired",
      category: "agent",
      producer: "ai_agent_health_monitor",
      source: "ai_agent_runtime_health",
      agentOwner: lease.agentKey,
      workOrderId: lease.workOrderId,
      missionId: workOrder?.missionId ?? null,
      correlationId: lease.id,
      payload: { lease_id: lease.id, expires_at: lease.expiresAt },
    })
  }

  return { expired: leases.length }
}

export async function markStaleAiOsAgentsUnhealthy(
  admin: SupabaseClient,
  input: { organizationId: string; staleThresholdMs?: number },
): Promise<{ marked: number }> {
  const report = await evaluateAiOsAgentHealth(admin, input)
  let marked = 0

  for (const agent of report.agents) {
    if (!agent.stale) continue

    await updateAiOsAgentRegistration(admin, {
      organizationId: input.organizationId,
      registrationId: agent.registrationId,
      patch: { health_status: "unhealthy" },
    })

    await publishAiOsEvent(admin, {
      organizationId: input.organizationId,
      eventType: "agent.unhealthy",
      category: "health",
      producer: "ai_agent_health_monitor",
      source: "ai_agent_runtime_health",
      agentOwner: agent.agentKey,
      correlationId: agent.registrationId,
      payload: {
        instance_id: agent.instanceId,
        last_heartbeat_at: agent.lastHeartbeatAt,
      },
    })

    marked += 1
  }

  return { marked }
}

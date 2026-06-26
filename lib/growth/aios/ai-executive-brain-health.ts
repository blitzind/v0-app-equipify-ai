/** GE-AIOS-2G — Executive Brain health monitor (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { listAiExecutiveBrainRuntimes } from "@/lib/growth/aios/ai-executive-brain-repository"
import type { AiExecutiveBrainHealthReport } from "@/lib/growth/aios/ai-executive-brain-types"
import {
  AI_EXECUTIVE_BRAIN_HEARTBEAT_STALE_MS,
  isExecutiveBrainHeartbeatStale,
} from "@/lib/growth/aios/ai-executive-brain-types"

function nowIso(): string {
  return new Date().toISOString()
}

export async function evaluateAiExecutiveBrainHealth(
  admin: SupabaseClient,
  input: {
    organizationId: string
    staleThresholdMs?: number
  },
): Promise<AiExecutiveBrainHealthReport> {
  const thresholdMs = input.staleThresholdMs ?? AI_EXECUTIVE_BRAIN_HEARTBEAT_STALE_MS
  const runtimes = await listAiExecutiveBrainRuntimes(admin, {
    organizationId: input.organizationId,
  })

  return {
    organizationId: input.organizationId,
    evaluatedAt: nowIso(),
    staleThresholdMs: thresholdMs,
    runtimes: runtimes.map((runtime) => {
      const stale = isExecutiveBrainHeartbeatStale(runtime.lastHeartbeatAt, thresholdMs)
      let healthStatus = runtime.healthStatus
      if (stale && healthStatus === "healthy") healthStatus = "offline"

      return {
        runtimeId: runtime.id,
        instanceId: runtime.instanceId,
        runtimeStatus: runtime.runtimeStatus,
        healthStatus,
        lastHeartbeatAt: runtime.lastHeartbeatAt,
        stale,
        activeMissionCount: runtime.activeMissionCount,
        activeDelegationCount: runtime.activeDelegationCount,
      }
    }),
  }
}

export async function publishExecutiveBrainUnhealthyEvents(
  admin: SupabaseClient,
  input: { organizationId: string; staleThresholdMs?: number },
): Promise<number> {
  const report = await evaluateAiExecutiveBrainHealth(admin, input)
  let published = 0

  for (const runtime of report.runtimes) {
    if (!runtime.stale) continue

    await publishAiOsEvent(admin, {
      organizationId: input.organizationId,
      eventType: "agent.unhealthy",
      category: "health",
      producer: "executive_brain",
      source: "ai_executive_brain_health",
      agentOwner: "executive_brain",
      correlationId: runtime.runtimeId,
      payload: {
        executive_runtime_id: runtime.runtimeId,
        instance_id: runtime.instanceId,
        last_heartbeat_at: runtime.lastHeartbeatAt,
        stale_threshold_ms: report.staleThresholdMs,
      },
    })
    published += 1
  }

  return published
}

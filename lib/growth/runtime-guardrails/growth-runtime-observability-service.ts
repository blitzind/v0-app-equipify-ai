import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listRecentGuardrailAudits } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import { getOrganizationBudgets } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import { listEventRetentionPolicies } from "@/lib/growth/runtime-guardrails/growth-event-retention-service"
import { getRuntimeHealthCounters } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { getRetentionBacklogSnapshot } from "@/lib/growth/runtime-guardrails/growth-runtime-retention-observability"
import {
  probeRuntimeGuardrailSchema,
  probeRuntimeTable,
  type GrowthRuntimeSchemaProbeResult,
  type GrowthRuntimeSchemaStatus,
} from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"
import { recordRuntimeHealthRead } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"
import { getWakeBatchState } from "@/lib/growth/runtime-guardrails/growth-wake-batch-state-repository"
import { getGrowthAudienceObservabilitySnapshot } from "@/lib/growth/audiences/growth-audience-observability"
import { getGrowthSendrObservabilitySnapshot } from "@/lib/growth/sendr/growth-sendr-observability"
import { GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export type GrowthRuntimeObservabilitySnapshot = {
  status: GrowthRuntimeSchemaStatus
  missingResources: string[]
  partialResources: string[]
  budgets: Awaited<ReturnType<typeof getOrganizationBudgets>> | null
  userBudgets: Array<{
    resourceType: string
    windowKind: string
    count: number
    cap: number
    remaining: number
  }> | null
  killSwitches: Awaited<ReturnType<typeof getRuntimeKillSwitchStates>>
  queues: {
    wakeBacklog: number
    liveWakeCount: number | null
    retention: Awaited<ReturnType<typeof getRetentionBacklogSnapshot>>
    retentionPolicies: Awaited<ReturnType<typeof listEventRetentionPolicies>>
    rollupRebuildAvailable: boolean
  }
  health: {
    runtimeReadsEstimate: number
    runtimeWritesEstimate: number
    runtimeThrottleCount: number
    runtimeFailureCount: number
    lastFailureAt: string | null
    lastFailureMessage: string | null
    recentThrottles: Awaited<ReturnType<typeof listRecentGuardrailAudits>>
    wakeBatch: Awaited<ReturnType<typeof getWakeBatchState>>
    timeoutWakeBatch: Awaited<ReturnType<typeof getWakeBatchState>>
  }
  audiences: Awaited<ReturnType<typeof getGrowthAudienceObservabilitySnapshot>> | null
  sendr: Awaited<ReturnType<typeof getGrowthSendrObservabilitySnapshot>> | null
}

const EMPTY_WAKE_BATCH = {
  processorKey: "sequence_event_wake",
  wakeCursor: null,
  processedCount: 0,
  remainingCount: 0,
  updatedAt: new Date().toISOString(),
} as const

const EMPTY_TIMEOUT_WAKE_BATCH = {
  processorKey: "sequence_wait_timeouts",
  wakeCursor: null,
  processedCount: 0,
  remainingCount: 0,
  updatedAt: new Date().toISOString(),
} as const

const EMPTY_RETENTION = {
  retentionRowsPending: 0,
  retentionBatchesRemaining: 0,
  lastRetentionRunAt: null,
  lastRetentionDeletedRows: 0,
  lastRetentionDurationMs: null,
  families: [],
} as const

/** Safe fallback when observability cannot load — pre-migration or unexpected failure. */
export function buildMissingRuntimeObservabilitySnapshot(
  input?: { message?: string | null },
): GrowthRuntimeObservabilitySnapshot {
  return {
    status: "MISSING",
    missingResources: ["growth.runtime_guardrails"],
    partialResources: input?.message ? [`runtime_observability:${input.message}`] : [],
    budgets: null,
    userBudgets: null,
    killSwitches: { ...GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES },
    queues: {
      wakeBacklog: 0,
      liveWakeCount: null,
      retention: EMPTY_RETENTION,
      retentionPolicies: [],
      rollupRebuildAvailable: false,
    },
    health: {
      runtimeReadsEstimate: 0,
      runtimeWritesEstimate: 0,
      runtimeThrottleCount: 0,
      runtimeFailureCount: 0,
      lastFailureAt: null,
      lastFailureMessage: input?.message ?? null,
      recentThrottles: [],
      wakeBatch: { ...EMPTY_WAKE_BATCH },
      timeoutWakeBatch: { ...EMPTY_TIMEOUT_WAKE_BATCH },
    },
    audiences: null,
    sendr: null,
  }
}

async function safeLoad<T>(
  probe: GrowthRuntimeSchemaProbeResult,
  table: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (probe.missingResources.includes(table)) return fallback
  try {
    return await loader()
  } catch {
    return fallback
  }
}

export async function getGrowthRuntimeObservabilitySnapshot(
  admin: SupabaseClient,
  input?: { organizationId?: string; userId?: string },
): Promise<GrowthRuntimeObservabilitySnapshot> {
  const probe = await probeRuntimeGuardrailSchema(admin)
  await recordRuntimeHealthRead(admin, 8)

  const killSwitches = await safeLoad(
    probe,
    "growth.runtime_guardrail_settings",
    () => getRuntimeKillSwitchStates(admin),
    {
      wake_execution_enabled: true,
      media_rollup_enabled: true,
      search_execution_enabled: true,
      retention_worker_enabled: true,
      cascade_budget_enforcement_enabled: true,
      audience_snapshot_enabled: true,
    },
  )

  const wakeBatch = await safeLoad(probe, "growth.runtime_wake_batch_state", () =>
    getWakeBatchState(admin, "sequence_event_wake"),
  {
    processorKey: "sequence_event_wake",
    wakeCursor: null,
    processedCount: 0,
    remainingCount: 0,
    updatedAt: new Date().toISOString(),
  })

  const timeoutWakeBatch = await safeLoad(probe, "growth.runtime_wake_batch_state", () =>
    getWakeBatchState(admin, "sequence_wait_timeouts"),
  {
    processorKey: "sequence_wait_timeouts",
    wakeCursor: null,
    processedCount: 0,
    remainingCount: 0,
    updatedAt: new Date().toISOString(),
  })

  const retentionPolicies = await safeLoad(probe, "growth.growth_event_retention_config", () =>
    listEventRetentionPolicies(admin),
  [])

  const retention = await getRetentionBacklogSnapshot(admin)

  const recentThrottles = await safeLoad(probe, "growth.runtime_guardrail_audit_log", () =>
    listRecentGuardrailAudits(admin, {
      organizationId: input?.organizationId,
      limit: 25,
    }),
  [])

  const healthCounters = await safeLoad(probe, "growth.runtime_health_counters", () =>
    getRuntimeHealthCounters(admin),
  {
    runtimeReadsEstimate: 0,
    runtimeWritesEstimate: 0,
    runtimeThrottleCount: 0,
    runtimeFailureCount: 0,
    lastFailureAt: null,
    lastFailureMessage: null,
    windowStart: new Date().toISOString(),
    updatedAt: null,
  })

  let budgets: Awaited<ReturnType<typeof getOrganizationBudgets>> | null = null
  if (input?.organizationId && !probe.missingResources.includes("growth.runtime_budgets")) {
    try {
      budgets = await getOrganizationBudgets(admin, input.organizationId)
    } catch {
      budgets = null
    }
  }

  let userBudgets: GrowthRuntimeObservabilitySnapshot["userBudgets"] = null
  if (input?.organizationId && input?.userId) {
    const userTableProbe = await probeRuntimeTable(admin, "runtime_user_budgets")
    if (!userTableProbe.missing) {
      try {
        const { getUserBudgetSnapshot } = await import(
          "@/lib/growth/runtime-guardrails/growth-runtime-user-budget-service"
        )
        userBudgets = await getUserBudgetSnapshot(admin, {
          organizationId: input.organizationId,
          userId: input.userId,
        })
      } catch {
        userBudgets = null
      }
    }
  }

  let liveWakeCount: number | null = null
  if (!probe.missingResources.includes("growth.sequence_enrollment_step_waits")) {
    try {
      liveWakeCount = await countPendingWakeBacklog(admin)
    } catch {
      liveWakeCount = null
    }
  }

  const wakeBacklog =
    liveWakeCount ?? wakeBatch.remainingCount + timeoutWakeBatch.remainingCount

  let audiences: GrowthRuntimeObservabilitySnapshot["audiences"] = null
  let sendr: GrowthRuntimeObservabilitySnapshot["sendr"] = null
  if (input?.organizationId) {
    try {
      audiences = await getGrowthAudienceObservabilitySnapshot(admin, {
        organizationId: input.organizationId,
      })
    } catch {
      audiences = null
    }
    try {
      sendr = await getGrowthSendrObservabilitySnapshot(admin, {
        organizationId: input.organizationId,
      })
    } catch {
      sendr = null
    }
  }

  return {
    status: probe.status,
    missingResources: probe.missingResources,
    partialResources: probe.partialResources,
    budgets,
    userBudgets,
    killSwitches,
    queues: {
      wakeBacklog,
      liveWakeCount,
      retention,
      retentionPolicies,
      rollupRebuildAvailable: probe.status !== "MISSING",
    },
    health: {
      runtimeReadsEstimate: healthCounters.runtimeReadsEstimate,
      runtimeWritesEstimate: healthCounters.runtimeWritesEstimate,
      runtimeThrottleCount: healthCounters.runtimeThrottleCount,
      runtimeFailureCount: healthCounters.runtimeFailureCount,
      lastFailureAt: healthCounters.lastFailureAt,
      lastFailureMessage: healthCounters.lastFailureMessage,
      recentThrottles,
      wakeBatch,
      timeoutWakeBatch,
    },
    audiences,
    sendr,
  }
}

export async function countPendingWakeBacklog(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "active"])

  if (error) throw new Error(error.message)
  return count ?? 0
}

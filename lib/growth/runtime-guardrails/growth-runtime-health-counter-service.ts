import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveBudgetWindowStart } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

const COUNTER_KEY = "platform"

export type RuntimeHealthCounterSnapshot = {
  runtimeReadsEstimate: number
  runtimeWritesEstimate: number
  runtimeThrottleCount: number
  runtimeFailureCount: number
  lastFailureAt: string | null
  lastFailureMessage: string | null
  windowStart: string
  updatedAt: string | null
}

const EMPTY_COUNTERS: RuntimeHealthCounterSnapshot = {
  runtimeReadsEstimate: 0,
  runtimeWritesEstimate: 0,
  runtimeThrottleCount: 0,
  runtimeFailureCount: 0,
  lastFailureAt: null,
  lastFailureMessage: null,
  windowStart: resolveBudgetWindowStart("daily"),
  updatedAt: null,
}

function countersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_health_counters")
}

function mapRow(row: Record<string, unknown>): RuntimeHealthCounterSnapshot {
  return {
    runtimeReadsEstimate: Number(row.runtime_reads_estimate ?? 0),
    runtimeWritesEstimate: Number(row.runtime_writes_estimate ?? 0),
    runtimeThrottleCount: Number(row.runtime_throttle_count ?? 0),
    runtimeFailureCount: Number(row.runtime_failure_count ?? 0),
    lastFailureAt: row.last_failure_at ? String(row.last_failure_at) : null,
    lastFailureMessage: row.last_failure_message ? String(row.last_failure_message) : null,
    windowStart: String(row.window_start ?? resolveBudgetWindowStart("daily")),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

export async function getRuntimeHealthCounters(
  admin: SupabaseClient,
): Promise<RuntimeHealthCounterSnapshot> {
  const { data, error } = await countersTable(admin)
    .select("*")
    .eq("counter_key", COUNTER_KEY)
    .maybeSingle()

  if (error || !data) return EMPTY_COUNTERS
  return mapRow(data as Record<string, unknown>)
}

async function incrementCounterField(
  admin: SupabaseClient,
  field: "runtime_reads_estimate" | "runtime_writes_estimate" | "runtime_throttle_count" | "runtime_failure_count",
  volume: number,
): Promise<void> {
  const windowStart = resolveBudgetWindowStart("daily")
  const existing = await getRuntimeHealthCounters(admin)
  const rolled = existing.windowStart !== windowStart

  const next = {
    counter_key: COUNTER_KEY,
    window_start: windowStart,
    runtime_reads_estimate:
      field === "runtime_reads_estimate"
        ? (rolled ? 0 : existing.runtimeReadsEstimate) + volume
        : rolled
          ? 0
          : existing.runtimeReadsEstimate,
    runtime_writes_estimate:
      field === "runtime_writes_estimate"
        ? (rolled ? 0 : existing.runtimeWritesEstimate) + volume
        : rolled
          ? 0
          : existing.runtimeWritesEstimate,
    runtime_throttle_count:
      field === "runtime_throttle_count"
        ? (rolled ? 0 : existing.runtimeThrottleCount) + volume
        : rolled
          ? 0
          : existing.runtimeThrottleCount,
    runtime_failure_count:
      field === "runtime_failure_count"
        ? (rolled ? 0 : existing.runtimeFailureCount) + volume
        : rolled
          ? 0
          : existing.runtimeFailureCount,
    last_failure_at: existing.lastFailureAt,
    last_failure_message: existing.lastFailureMessage,
    qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  await countersTable(admin).upsert(next, { onConflict: "counter_key" })
}

export async function recordRuntimeHealthRead(
  admin: SupabaseClient,
  volume = 1,
): Promise<void> {
  try {
    await incrementCounterField(admin, "runtime_reads_estimate", volume)
  } catch {
    // Non-blocking — observability must not fail on counter writes
  }
}

export async function recordRuntimeHealthWrite(
  admin: SupabaseClient,
  volume = 1,
): Promise<void> {
  try {
    await incrementCounterField(admin, "runtime_writes_estimate", volume)
  } catch {
    // Non-blocking
  }
}

export async function recordRuntimeHealthThrottle(
  admin: SupabaseClient,
  volume = 1,
): Promise<void> {
  try {
    await incrementCounterField(admin, "runtime_throttle_count", volume)
  } catch {
    // Non-blocking
  }
}

export async function recordRuntimeHealthFailure(
  admin: SupabaseClient,
  input: { message: string },
): Promise<void> {
  try {
    const windowStart = resolveBudgetWindowStart("daily")
    const existing = await getRuntimeHealthCounters(admin)
    const rolled = existing.windowStart !== windowStart
    await countersTable(admin).upsert(
      {
        counter_key: COUNTER_KEY,
        window_start: windowStart,
        runtime_reads_estimate: rolled ? 0 : existing.runtimeReadsEstimate,
        runtime_writes_estimate: rolled ? 0 : existing.runtimeWritesEstimate,
        runtime_throttle_count: rolled ? 0 : existing.runtimeThrottleCount,
        runtime_failure_count: (rolled ? 0 : existing.runtimeFailureCount) + 1,
        last_failure_at: new Date().toISOString(),
        last_failure_message: input.message.slice(0, 500),
        qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "counter_key" },
    )
  } catch {
    // Non-blocking
  }
}

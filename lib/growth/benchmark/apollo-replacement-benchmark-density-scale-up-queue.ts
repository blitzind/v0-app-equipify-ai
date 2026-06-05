/** Phase 7.PS-IM — Density scale-up verified email queue. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER,
  type DensityScaleUpQueueRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"

export const APOLLO_DENSITY_SCALE_UP_VERIFIED_EMAIL_QUEUE_REASON =
  "apollo_replacement_benchmark_density_scale_up_queue" as const

function queueSegmentKey(benchmark_id: string): string {
  return `apollo_benchmark_density_scale_up_queue:${benchmark_id}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function serializeDensityScaleUpQueue(record: DensityScaleUpQueueRecord): string {
  return JSON.stringify(record)
}

export function deserializeDensityScaleUpQueue(
  raw: string | null | undefined,
): DensityScaleUpQueueRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DensityScaleUpQueueRecord
    if (!parsed?.benchmark_id || !Array.isArray(parsed.candidates)) return null
    return parsed
  } catch {
    return null
  }
}

export async function persistDensityScaleUpQueue(
  admin: SupabaseClient,
  record: DensityScaleUpQueueRecord,
): Promise<void> {
  const nowIso = new Date().toISOString()
  const queue_status =
    record.status === "completed"
      ? "completed"
      : record.status === "failed"
        ? "failed"
        : record.status === "processing"
          ? "running"
          : "pending"

  const { error } = await admin.schema("growth").from("discovery_refresh_queue").upsert(
    {
      segment_key: queueSegmentKey(record.benchmark_id),
      reason: APOLLO_DENSITY_SCALE_UP_VERIFIED_EMAIL_QUEUE_REASON,
      status: queue_status,
      scheduled_for: nowIso,
      last_error: serializeDensityScaleUpQueue(record),
      updated_at: nowIso,
    },
    { onConflict: "segment_key,reason" },
  )
  if (error) throw new Error(`density_scale_up_queue_persist_failed: ${error.message}`)
}

export async function loadDensityScaleUpQueue(
  admin: SupabaseClient,
  benchmark_id: string = APOLLO_REPLACEMENT_BENCHMARK_ID,
): Promise<DensityScaleUpQueueRecord | null> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, updated_at")
    .eq("segment_key", queueSegmentKey(benchmark_id))
    .eq("reason", APOLLO_DENSITY_SCALE_UP_VERIFIED_EMAIL_QUEUE_REASON)
    .maybeSingle()

  const record = deserializeDensityScaleUpQueue(
    typeof data?.last_error === "string" ? data.last_error : null,
  )
  if (!record) return null
  if (!record.requested_at && data?.updated_at) {
    record.requested_at = String(data.updated_at)
  }
  return record
}

export async function waitForDensityScaleUpQueue(
  admin: SupabaseClient,
  input: {
    benchmark_id?: string
    poll_timeout_ms?: number
    poll_interval_ms?: number
  } = {},
): Promise<DensityScaleUpQueueRecord | null> {
  const benchmark_id = input.benchmark_id ?? APOLLO_REPLACEMENT_BENCHMARK_ID
  const deadline = Date.now() + (input.poll_timeout_ms ?? 300_000)
  const interval = input.poll_interval_ms ?? 3_000

  while (Date.now() < deadline) {
    const record = await loadDensityScaleUpQueue(admin, benchmark_id)
    if (record && (record.status === "completed" || record.status === "failed")) {
      return record
    }
    await sleep(interval)
  }
  return loadDensityScaleUpQueue(admin, benchmark_id)
}

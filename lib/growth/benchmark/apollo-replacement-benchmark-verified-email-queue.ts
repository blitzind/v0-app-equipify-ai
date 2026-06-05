/** Phase 7.PS-IL — Benchmark verified email queue (discovery_refresh_queue). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
  type BenchmarkVerifiedEmailCandidateRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"

export const APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QUEUE_REASON =
  "apollo_replacement_benchmark_verified_email_queue" as const

export type BenchmarkVerifiedEmailQueuePersonResult = {
  full_name: string
  email: string
  company_name: string
  person_id: string
  company_id: string
  verified: boolean
  promoted: boolean
  execution_channel: string
  messages: string[]
}

export type BenchmarkVerifiedEmailQueueRecord = {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER
  benchmark_id: string
  status: "scheduled" | "processing" | "completed" | "failed"
  requested_at: string
  completed_at: string | null
  candidates: BenchmarkVerifiedEmailCandidateRow[]
  person_results: BenchmarkVerifiedEmailQueuePersonResult[]
  error: string | null
}

function queueSegmentKey(benchmark_id: string): string {
  return `apollo_benchmark_verified_email_queue:${benchmark_id}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function serializeBenchmarkVerifiedEmailQueue(
  record: BenchmarkVerifiedEmailQueueRecord,
): string {
  return JSON.stringify(record)
}

export function deserializeBenchmarkVerifiedEmailQueue(
  raw: string | null | undefined,
): BenchmarkVerifiedEmailQueueRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as BenchmarkVerifiedEmailQueueRecord
    if (!parsed?.benchmark_id || !Array.isArray(parsed.candidates)) return null
    return parsed
  } catch {
    return null
  }
}

export async function persistBenchmarkVerifiedEmailQueue(
  admin: SupabaseClient,
  record: BenchmarkVerifiedEmailQueueRecord,
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
      reason: APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QUEUE_REASON,
      status: queue_status,
      scheduled_for: nowIso,
      last_error: serializeBenchmarkVerifiedEmailQueue(record),
      updated_at: nowIso,
    },
    { onConflict: "segment_key,reason" },
  )
  if (error) throw new Error(`benchmark_verified_email_queue_persist_failed: ${error.message}`)
}

export async function loadBenchmarkVerifiedEmailQueue(
  admin: SupabaseClient,
  benchmark_id: string = APOLLO_REPLACEMENT_BENCHMARK_ID,
): Promise<BenchmarkVerifiedEmailQueueRecord | null> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, updated_at")
    .eq("segment_key", queueSegmentKey(benchmark_id))
    .eq("reason", APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QUEUE_REASON)
    .maybeSingle()

  const record = deserializeBenchmarkVerifiedEmailQueue(
    typeof data?.last_error === "string" ? data.last_error : null,
  )
  if (!record) return null
  if (!record.requested_at && data?.updated_at) {
    record.requested_at = String(data.updated_at)
  }
  return record
}

export async function waitForBenchmarkVerifiedEmailQueue(
  admin: SupabaseClient,
  input: {
    benchmark_id?: string
    poll_timeout_ms?: number
    poll_interval_ms?: number
  } = {},
): Promise<BenchmarkVerifiedEmailQueueRecord | null> {
  const benchmark_id = input.benchmark_id ?? APOLLO_REPLACEMENT_BENCHMARK_ID
  const deadline = Date.now() + (input.poll_timeout_ms ?? 180_000)
  const interval = input.poll_interval_ms ?? 3_000

  while (Date.now() < deadline) {
    const record = await loadBenchmarkVerifiedEmailQueue(admin, benchmark_id)
    if (record && (record.status === "completed" || record.status === "failed")) {
      return record
    }
    await sleep(interval)
  }
  return loadBenchmarkVerifiedEmailQueue(admin, benchmark_id)
}

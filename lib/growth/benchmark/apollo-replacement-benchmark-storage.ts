/** Phase 7.PS-IJ — Apollo replacement benchmark persistence. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_REPLACEMENT_BENCHMARK_COHORT_QUEUE_REASON,
  APOLLO_REPLACEMENT_BENCHMARK_ID,
  APOLLO_REPLACEMENT_BENCHMARK_SNAPSHOT_QUEUE_REASON,
  type ApolloReplacementBenchmarkCohortRecord,
  type ApolloReplacementBenchmarkSnapshotRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function cohortSegmentKey(benchmark_id: string): string {
  return `apollo_benchmark_cohort:${benchmark_id}`
}

function snapshotSegmentKey(benchmark_id: string, phase_version: string): string {
  return `apollo_benchmark_snapshot:${benchmark_id}:${phase_version}`
}

export function serializeApolloReplacementBenchmarkCohort(
  cohort: ApolloReplacementBenchmarkCohortRecord,
): string {
  return JSON.stringify(cohort)
}

export function deserializeApolloReplacementBenchmarkCohort(
  raw: string | null | undefined,
): ApolloReplacementBenchmarkCohortRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ApolloReplacementBenchmarkCohortRecord
    if (!parsed?.benchmark_id || !Array.isArray(parsed.company_ids)) return null
    return parsed
  } catch {
    return null
  }
}

export function serializeApolloReplacementBenchmarkSnapshot(
  snapshot: ApolloReplacementBenchmarkSnapshotRecord,
): string {
  return JSON.stringify(snapshot)
}

export function deserializeApolloReplacementBenchmarkSnapshot(
  raw: string | null | undefined,
): ApolloReplacementBenchmarkSnapshotRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ApolloReplacementBenchmarkSnapshotRecord
    if (!parsed?.benchmark_id || !parsed.metrics) return null
    return parsed
  } catch {
    return null
  }
}

export async function loadApolloReplacementBenchmarkCohort(
  admin: SupabaseClient,
  benchmark_id: string = APOLLO_REPLACEMENT_BENCHMARK_ID,
): Promise<ApolloReplacementBenchmarkCohortRecord | null> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, updated_at")
    .eq("segment_key", cohortSegmentKey(benchmark_id))
    .eq("reason", APOLLO_REPLACEMENT_BENCHMARK_COHORT_QUEUE_REASON)
    .maybeSingle()

  const cohort = deserializeApolloReplacementBenchmarkCohort(asString(data?.last_error))
  if (!cohort) return null
  cohort.created_at = asString(data?.updated_at) || cohort.created_at
  return cohort
}

export async function persistApolloReplacementBenchmarkCohort(
  admin: SupabaseClient,
  cohort: ApolloReplacementBenchmarkCohortRecord,
): Promise<void> {
  const nowIso = new Date().toISOString()
  await admin.schema("growth").from("discovery_refresh_queue").upsert(
    {
      segment_key: cohortSegmentKey(cohort.benchmark_id),
      reason: APOLLO_REPLACEMENT_BENCHMARK_COHORT_QUEUE_REASON,
      status: "completed",
      scheduled_for: nowIso,
      last_error: serializeApolloReplacementBenchmarkCohort(cohort),
      updated_at: nowIso,
    },
    { onConflict: "segment_key,reason" },
  )
}

export async function loadApolloReplacementBenchmarkSnapshot(
  admin: SupabaseClient,
  input: { benchmark_id: string; phase_version: string },
): Promise<ApolloReplacementBenchmarkSnapshotRecord | null> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, updated_at")
    .eq("segment_key", snapshotSegmentKey(input.benchmark_id, input.phase_version))
    .eq("reason", APOLLO_REPLACEMENT_BENCHMARK_SNAPSHOT_QUEUE_REASON)
    .maybeSingle()

  const snapshot = deserializeApolloReplacementBenchmarkSnapshot(asString(data?.last_error))
  if (!snapshot) return null
  snapshot.captured_at = asString(data?.updated_at) || snapshot.captured_at
  return snapshot
}

export async function listApolloReplacementBenchmarkSnapshots(
  admin: SupabaseClient,
  benchmark_id: string = APOLLO_REPLACEMENT_BENCHMARK_ID,
): Promise<ApolloReplacementBenchmarkSnapshotRecord[]> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, updated_at")
    .eq("reason", APOLLO_REPLACEMENT_BENCHMARK_SNAPSHOT_QUEUE_REASON)
    .like("segment_key", `apollo_benchmark_snapshot:${benchmark_id}:%`)
    .order("updated_at", { ascending: true })

  const snapshots: ApolloReplacementBenchmarkSnapshotRecord[] = []
  for (const row of data ?? []) {
    const snapshot = deserializeApolloReplacementBenchmarkSnapshot(asString(row.last_error))
    if (!snapshot) continue
    snapshot.captured_at = asString(row.updated_at) || snapshot.captured_at
    snapshots.push(snapshot)
  }
  return snapshots
}

export async function persistApolloReplacementBenchmarkSnapshot(
  admin: SupabaseClient,
  snapshot: ApolloReplacementBenchmarkSnapshotRecord,
): Promise<void> {
  const nowIso = new Date().toISOString()
  await admin.schema("growth").from("discovery_refresh_queue").upsert(
    {
      segment_key: snapshotSegmentKey(snapshot.benchmark_id, snapshot.phase_version),
      reason: APOLLO_REPLACEMENT_BENCHMARK_SNAPSHOT_QUEUE_REASON,
      status: "completed",
      scheduled_for: nowIso,
      last_error: serializeApolloReplacementBenchmarkSnapshot({
        ...snapshot,
        captured_at: nowIso,
      }),
      updated_at: nowIso,
    },
    { onConflict: "segment_key,reason" },
  )
}

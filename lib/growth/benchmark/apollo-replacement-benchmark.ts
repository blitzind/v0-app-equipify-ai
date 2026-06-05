/** Phase 7.PS-IJ — Apollo replacement benchmark orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ensureApolloReplacementBenchmarkCohort,
  newBenchmarkSnapshotId,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-cohort"
import { buildApolloReplacementBenchmarkDeltaReport } from "@/lib/growth/benchmark/apollo-replacement-benchmark-delta"
import { loadApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-metrics"
import {
  listApolloReplacementBenchmarkSnapshots,
  loadApolloReplacementBenchmarkSnapshot,
  persistApolloReplacementBenchmarkSnapshot,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import {
  APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION,
  APOLLO_REPLACEMENT_BENCHMARK_ID,
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_QA_MARKER,
  type ApolloReplacementBenchmarkRunResult,
  type ApolloReplacementBenchmarkSnapshotRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

export async function runApolloReplacementBenchmark(input: {
  admin: SupabaseClient
  phase_name: string
  phase_version: string
  snapshot_kind?: "baseline" | "phase_run" | "comparison"
  compare_phase_version?: string | null
  force_rebuild_cohort?: boolean
}): Promise<ApolloReplacementBenchmarkRunResult> {
  const started = Date.now()
  const messages: string[] = []

  const { cohort, created } = await ensureApolloReplacementBenchmarkCohort(input.admin, {
    force_rebuild: input.force_rebuild_cohort,
  })
  messages.push(
    created
      ? `cohort_created count=${cohort.company_count}`
      : `cohort_loaded count=${cohort.company_count}`,
  )

  const metrics = await loadApolloReplacementBenchmarkMetrics(input.admin, cohort.company_ids)

  const existingBaseline = await loadApolloReplacementBenchmarkSnapshot(input.admin, {
    benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
    phase_version: APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION,
  })

  const snapshot_kind =
    input.snapshot_kind ??
    (existingBaseline ? "phase_run" : "baseline")

  const current_snapshot: ApolloReplacementBenchmarkSnapshotRecord = {
    snapshot_id: newBenchmarkSnapshotId(),
    benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
    phase_name: input.phase_name,
    phase_version: input.phase_version,
    snapshot_kind,
    captured_at: new Date().toISOString(),
    metrics,
  }

  await persistApolloReplacementBenchmarkSnapshot(input.admin, current_snapshot)
  messages.push(`snapshot_persisted phase=${input.phase_version} kind=${snapshot_kind}`)

  if (!existingBaseline && snapshot_kind === "baseline") {
    messages.push("baseline_snapshot_established")
  }

  const baseline_snapshot =
    existingBaseline ??
    (snapshot_kind === "baseline" ? current_snapshot : null)

  let delta_report = null
  if (input.compare_phase_version) {
    const compare_snapshot = await loadApolloReplacementBenchmarkSnapshot(input.admin, {
      benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
      phase_version: input.compare_phase_version,
    })
    if (compare_snapshot) {
      delta_report = buildApolloReplacementBenchmarkDeltaReport({
        before_snapshot: compare_snapshot,
        after_snapshot: current_snapshot,
      })
    }
  } else if (baseline_snapshot && input.phase_version !== baseline_snapshot.phase_version) {
    delta_report = buildApolloReplacementBenchmarkDeltaReport({
      before_snapshot: baseline_snapshot,
      after_snapshot: current_snapshot,
    })
  }

  const historical = await listApolloReplacementBenchmarkSnapshots(input.admin)
  messages.push(`historical_snapshots=${historical.length}`)

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_QA_MARKER,
    ok: cohort.company_count > 0,
    cohort,
    baseline_snapshot,
    current_snapshot,
    delta_report,
    runtime_ms: Date.now() - started,
    messages,
  }
}

/** Phase 7.PS-IJ — Apollo replacement benchmark certification. Client-safe. */

import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_CERTIFICATION_QA_MARKER,
  APOLLO_REPLACEMENT_BENCHMARK_TARGET_SIZE,
  type ApolloReplacementBenchmarkRunResult,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

export function evaluateApolloReplacementBenchmarkCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_CERTIFICATION_QA_MARKER
  audit_only: boolean
  no_acquisition: boolean
  no_new_providers: boolean
  no_threshold_changes: boolean
  no_sequence_enrollment: boolean
  stable_cohort_required: boolean
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_CERTIFICATION_QA_MARKER,
    audit_only: true,
    no_acquisition: true,
    no_new_providers: true,
    no_threshold_changes: true,
    no_sequence_enrollment: true,
    stable_cohort_required: true,
  }
}

export function evaluateApolloReplacementBenchmarkCertificationOutcome(input: {
  result: ApolloReplacementBenchmarkRunResult
  cohort_stable_on_reload: boolean
}): {
  certification: "PASS" | "FAIL"
  remaining_blockers: string[]
} {
  const blockers: string[] = []

  if (!input.result.ok) blockers.push("benchmark_run_failed")
  if (input.result.cohort.company_count === 0) blockers.push("empty_benchmark_cohort")
  if (input.result.cohort.company_count < Math.min(50, APOLLO_REPLACEMENT_BENCHMARK_TARGET_SIZE)) {
    blockers.push("insufficient_benchmark_cohort_size")
  }
  if (!input.result.current_snapshot?.metrics) blockers.push("missing_current_snapshot")
  if (!input.cohort_stable_on_reload) blockers.push("cohort_not_stable_on_reload")
  if (!input.result.baseline_snapshot && input.result.current_snapshot.snapshot_kind !== "baseline") {
    blockers.push("missing_baseline_snapshot")
  }

  const certification: "PASS" | "FAIL" =
    blockers.length === 0 && input.result.cohort.company_count > 0 ? "PASS" : "FAIL"

  return { certification, remaining_blockers: blockers }
}

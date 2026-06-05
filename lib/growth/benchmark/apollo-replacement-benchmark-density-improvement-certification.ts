/** Phase 7.PS-IK — Benchmark density improvement certification. Client-safe. */

import { hasApolloReplacementBenchmarkDensityImprovement } from "@/lib/growth/benchmark/apollo-replacement-benchmark-delta"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER,
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-improvement-types"
import type {
  ApolloReplacementBenchmarkMetrics,
  ApolloReplacementBenchmarkRunResult,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import type { ApolloReplacementBenchmarkPhaseEvaluation } from "@/lib/growth/benchmark/apollo-replacement-benchmark-integration"

export function evaluateApolloBenchmarkDensityImprovementCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER
  benchmark_gated: true
  no_broad_acquisition: true
  no_new_paid_providers: true
  no_threshold_changes: true
  no_sequence_enrollment: true
  no_synthetic_contacts: true
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER,
    benchmark_gated: true,
    no_broad_acquisition: true,
    no_new_paid_providers: true,
    no_threshold_changes: true,
    no_sequence_enrollment: true,
    no_synthetic_contacts: true,
  }
}

export function evaluateApolloBenchmarkDensityImprovementOutcome(input: {
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
  phase_evaluation: ApolloReplacementBenchmarkPhaseEvaluation
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: boolean
  remaining_blockers: string[]
} {
  const remaining_blockers: string[] = []
  const improved = hasApolloReplacementBenchmarkDensityImprovement(input.before, input.after)

  if (!improved) {
    remaining_blockers.push("no_benchmark_primary_metric_improvement")
  }
  if (input.phase_evaluation.regressions.length > 0) {
    remaining_blockers.push(`regressions:${input.phase_evaluation.regressions.join(",")}`)
  }
  if (input.after.person.named_persons === 0) {
    remaining_blockers.push("benchmark_still_has_zero_real_named_persons_at_scale")
  }
  if (input.after.channel.verified_emails <= 1) {
    remaining_blockers.push("verified_email_density_still_critically_low")
  }
  if (input.after.company.outreach_ready_companies <= 1) {
    remaining_blockers.push("outreach_ready_company_count_still_critically_low")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (input.phase_evaluation.density_claim_allowed) {
    certification = "PASS"
  } else if (improved && input.phase_evaluation.regressions.length === 0) {
    certification = "PASS_PARTIAL"
  }

  return {
    certification,
    density_claim_allowed: input.phase_evaluation.density_claim_allowed,
    remaining_blockers,
  }
}

export function assertBenchmarkDensityImprovementMarker(
  qa_marker: string,
): asserts qa_marker is typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER {
  if (qa_marker !== GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER) {
    throw new Error("invalid_density_improvement_qa_marker")
  }
}

export type ApolloBenchmarkDensityImprovementCertContext = {
  benchmark_before: ApolloReplacementBenchmarkRunResult
  improvement: Awaited<
    ReturnType<
      typeof import("@/lib/growth/benchmark/apollo-replacement-benchmark-density-improvement").runApolloReplacementBenchmarkDensityImprovement
    >
  >
  benchmark_after: ApolloReplacementBenchmarkRunResult
}

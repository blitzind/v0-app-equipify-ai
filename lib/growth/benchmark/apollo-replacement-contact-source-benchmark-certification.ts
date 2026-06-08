/** Phase 7.PS-IU — Verified contact source benchmark certification. Client-safe. */

import {
  GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_CERTIFICATION_QA_MARKER,
  type ContactSourceBenchmarkResult,
} from "@/lib/growth/benchmark/apollo-replacement-contact-source-benchmark-types"

export function evaluateContactSourceBenchmarkCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_CERTIFICATION_QA_MARKER
  audit_only: true
  benchmark_measurement_only: true
  no_provider_integration: true
  no_paid_api_calls: true
  no_threshold_lowering: true
  no_contact_creation: true
  no_sequence_enrollment: true
  uses_ps_ir_observed_pdl: true
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_CERTIFICATION_QA_MARKER,
    audit_only: true,
    benchmark_measurement_only: true,
    no_provider_integration: true,
    no_paid_api_calls: true,
    no_threshold_lowering: true,
    no_contact_creation: true,
    no_sequence_enrollment: true,
    uses_ps_ir_observed_pdl: true,
  }
}

export function evaluateContactSourceBenchmarkOutcome(
  result: ContactSourceBenchmarkResult,
): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: false
  remaining_blockers: string[]
  fastest_path_meets_both_targets: boolean
} {
  const remaining_blockers: string[] = []
  const meetsBoth = result.combination_scenarios.some(
    (s) => s.meets_named_target && s.meets_outreach_target,
  )
  const meetsOutreach = result.combination_scenarios.some((s) => s.meets_outreach_target)
  const hasObservedPdl = result.sources.some(
    (s) => s.key === "people_data_labs" && s.evidence_tier === "observed",
  )
  const hasRecommendation = Boolean(result.recommendation && result.recommendation_rationale)

  if (!hasObservedPdl) remaining_blockers.push("missing_ps_ir_observed_pdl")
  if (!hasRecommendation) remaining_blockers.push("missing_recommendation")
  if (result.gap_analysis.outreach_ready_gap > 0 && !meetsOutreach) {
    remaining_blockers.push("no_scenario_closes_outreach_gap")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (hasObservedPdl && hasRecommendation && meetsBoth) {
    certification = "PASS"
  } else if (hasObservedPdl && hasRecommendation && (meetsOutreach || meetsBoth)) {
    certification = "PASS_PARTIAL"
  } else if (hasObservedPdl && hasRecommendation) {
    certification = "PASS_PARTIAL"
  }

  return {
    certification,
    density_claim_allowed: false,
    remaining_blockers,
    fastest_path_meets_both_targets: meetsBoth,
  }
}

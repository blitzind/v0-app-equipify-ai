/** Phase 7.PS-IQ — Person acquisition source benchmark certification. Client-safe. */

import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_CERTIFICATION_QA_MARKER,
  PERSON_ACQUISITION_BENCHMARK_TARGETS,
  type PersonAcquisitionSourceAuditMetrics,
  type PersonAcquisitionSourceRegistryEntry,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

export function evaluateApolloBenchmarkPersonAcquisitionSourceCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_CERTIFICATION_QA_MARKER
  audit_only: true
  no_new_provider_integration: true
  no_paid_api_calls: true
  no_broad_acquisition: true
  no_threshold_lowering: true
  no_contact_creation: true
  no_density_claim_snapshots: true
} {
  return {
    qa_marker:
      GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_CERTIFICATION_QA_MARKER,
    audit_only: true,
    no_new_provider_integration: true,
    no_paid_api_calls: true,
    no_broad_acquisition: true,
    no_threshold_lowering: true,
    no_contact_creation: true,
    no_density_claim_snapshots: true,
  }
}

function normalizePer100(value: number, company_count: number): number {
  if (company_count <= 0) return 0
  return Math.round((value / company_count) * 1000) / 10
}

export function evaluateApolloBenchmarkPersonAcquisitionSourceOutcome(input: {
  benchmark_metrics: ApolloReplacementBenchmarkMetrics
  ranked_sources: PersonAcquisitionSourceRegistryEntry[]
  audit_metrics: PersonAcquisitionSourceAuditMetrics
  recommended_next_phase: string | null
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: false
  remaining_blockers: string[]
  current_named_persons_per_100: number
  current_outreach_ready_companies_per_100: number
  named_person_gap_per_100: number
  outreach_ready_gap_per_100: number
  meets_named_target_sources: string[]
  meets_outreach_target_sources: string[]
  meets_both_target_sources: string[]
} {
  const company_count = input.benchmark_metrics.company.total_companies
  const current_named_persons_per_100 = normalizePer100(
    input.benchmark_metrics.person.named_persons,
    company_count,
  )
  const current_outreach_ready_companies_per_100 = normalizePer100(
    input.benchmark_metrics.company.outreach_ready_companies,
    company_count,
  )

  const named_person_gap_per_100 = Math.max(
    0,
    PERSON_ACQUISITION_BENCHMARK_TARGETS.named_persons_per_100 - current_named_persons_per_100,
  )
  const outreach_ready_gap_per_100 = Math.max(
    0,
    PERSON_ACQUISITION_BENCHMARK_TARGETS.outreach_ready_companies_per_100 -
      current_outreach_ready_companies_per_100,
  )

  const actionable = input.ranked_sources.filter(
    (s) => s.recommendation !== "exhausted" && s.recommendation !== "defer",
  )

  const meets_named_target_sources = actionable
    .filter((s) => s.yield.named_persons_per_100 >= PERSON_ACQUISITION_BENCHMARK_TARGETS.named_persons_per_100)
    .map((s) => s.key)

  const meets_outreach_target_sources = actionable
    .filter(
      (s) =>
        s.yield.outreach_ready_companies_per_100 >=
        PERSON_ACQUISITION_BENCHMARK_TARGETS.outreach_ready_companies_per_100,
    )
    .map((s) => s.key)

  const meets_both_target_sources = actionable
    .filter(
      (s) =>
        s.yield.named_persons_per_100 >= PERSON_ACQUISITION_BENCHMARK_TARGETS.named_persons_per_100 &&
        s.yield.outreach_ready_companies_per_100 >=
          PERSON_ACQUISITION_BENCHMARK_TARGETS.outreach_ready_companies_per_100,
    )
    .map((s) => s.key)

  const remaining_blockers: string[] = []
  if (input.audit_metrics.sources_meeting_both_targets === 0) {
    remaining_blockers.push("no_single_source_meets_named_and_outreach_targets")
  }
  if (named_person_gap_per_100 > 0) {
    remaining_blockers.push(`named_person_gap_per_100:${named_person_gap_per_100}`)
  }
  if (outreach_ready_gap_per_100 > 0) {
    remaining_blockers.push(`outreach_ready_gap_per_100:${outreach_ready_gap_per_100}`)
  }
  if (!input.recommended_next_phase) {
    remaining_blockers.push("no_recommended_next_phase")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (meets_both_target_sources.length > 0 && input.recommended_next_phase) {
    certification = "PASS"
  } else if (
    (meets_named_target_sources.length > 0 || meets_outreach_target_sources.length > 0) &&
    input.recommended_next_phase
  ) {
    certification = "PASS_PARTIAL"
  } else if (actionable.length > 0 && input.recommended_next_phase) {
    certification = "PASS_PARTIAL"
  }

  return {
    certification,
    density_claim_allowed: false,
    remaining_blockers,
    current_named_persons_per_100,
    current_outreach_ready_companies_per_100,
    named_person_gap_per_100,
    outreach_ready_gap_per_100,
    meets_named_target_sources,
    meets_outreach_target_sources,
    meets_both_target_sources,
  }
}

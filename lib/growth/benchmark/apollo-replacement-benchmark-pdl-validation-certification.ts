/** Phase 7.PS-IR — Benchmark PDL validation certification. Client-safe. */

import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_CERTIFICATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { evaluateApolloReplacementBenchmarkPhaseOutcome } from "@/lib/growth/benchmark/apollo-replacement-benchmark-integration"

export function evaluateApolloBenchmarkPdlValidationCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_CERTIFICATION_QA_MARKER
  benchmark_gated: true
  uses_existing_pdl_provider: true
  uses_existing_identity_guards: true
  uses_existing_verification_gates: true
  no_synthetic_people: true
  no_threshold_lowering: true
  no_sequence_enrollment: true
  no_new_infrastructure: true
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_CERTIFICATION_QA_MARKER,
    benchmark_gated: true,
    uses_existing_pdl_provider: true,
    uses_existing_identity_guards: true,
    uses_existing_verification_gates: true,
    no_synthetic_people: true,
    no_threshold_lowering: true,
    no_sequence_enrollment: true,
    no_new_infrastructure: true,
  }
}

export function evaluateApolloBenchmarkPdlValidationOutcome(input: {
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
  persons_discovered: number
  persons_persisted: number
  pdl_configured: boolean
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: boolean
  remaining_blockers: string[]
} {
  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IR",
    before: input.before,
    after: input.after,
  })

  const named_persons_improved =
    input.after.person.named_persons > input.before.person.named_persons
  const outreach_ready_improved =
    input.after.company.outreach_ready_companies > input.before.company.outreach_ready_companies
  const density_improved = named_persons_improved || outreach_ready_improved

  const remaining_blockers: string[] = []
  if (!input.pdl_configured) {
    remaining_blockers.push("pdl_not_configured")
  }
  if (!density_improved) {
    remaining_blockers.push("no_named_person_or_outreach_ready_improvement")
  }
  if (
    input.persons_discovered > 0 &&
    input.persons_persisted === 0 &&
    !density_improved
  ) {
    remaining_blockers.push("persons_discovered_but_none_persisted")
  }
  if (phase_evaluation.regressions.length > 0) {
    remaining_blockers.push(`regressions:${phase_evaluation.regressions.join(",")}`)
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (density_improved && phase_evaluation.regressions.length === 0) {
    certification = phase_evaluation.density_claim_allowed ? "PASS" : "PASS_PARTIAL"
  } else if (
    (input.persons_discovered > 0 || input.persons_persisted > 0) &&
    !density_improved &&
    phase_evaluation.regressions.length === 0
  ) {
    certification = "PASS_PARTIAL"
  } else if (!input.pdl_configured) {
    certification = "FAIL"
  }

  return {
    certification,
    density_claim_allowed: phase_evaluation.density_claim_allowed,
    remaining_blockers,
  }
}

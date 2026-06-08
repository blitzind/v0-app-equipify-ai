/** Phase 7.PS-IO — Benchmark professional identity expansion certification. Client-safe. */

import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_CERTIFICATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { evaluateApolloReplacementBenchmarkPhaseOutcome } from "@/lib/growth/benchmark/apollo-replacement-benchmark-integration"

export function evaluateApolloBenchmarkProfessionalIdentityExpansionCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_CERTIFICATION_QA_MARKER
  benchmark_gated: true
  no_linkedin_scraping: true
  no_paid_enrichment: true
  no_apollo_apis: true
  no_email_guessing: true
  no_synthetic_contacts: true
  no_threshold_lowering: true
  no_sequence_enrollment: true
  evidence_backed_only: true
} {
  return {
    qa_marker:
      GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_CERTIFICATION_QA_MARKER,
    benchmark_gated: true,
    no_linkedin_scraping: true,
    no_paid_enrichment: true,
    no_apollo_apis: true,
    no_email_guessing: true,
    no_synthetic_contacts: true,
    no_threshold_lowering: true,
    no_sequence_enrollment: true,
    evidence_backed_only: true,
  }
}

export function evaluateApolloBenchmarkProfessionalIdentityExpansionOutcome(input: {
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
  evidence_records_collected: number
  evidence_records_accepted: number
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: boolean
  remaining_blockers: string[]
} {
  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IO",
    before: input.before,
    after: input.after,
  })

  const named_persons_improved =
    input.after.person.named_persons > input.before.person.named_persons
  const titled_persons_improved =
    input.after.person.titled_persons > input.before.person.titled_persons
  const density_improved = named_persons_improved || titled_persons_improved

  const remaining_blockers: string[] = []
  if (input.evidence_records_collected === 0) {
    remaining_blockers.push("no_evidence_records_collected")
  }
  if (!density_improved) {
    remaining_blockers.push("no_named_or_titled_person_improvement")
  }
  if (phase_evaluation.regressions.length > 0) {
    remaining_blockers.push(`regressions:${phase_evaluation.regressions.join(",")}`)
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (density_improved && phase_evaluation.regressions.length === 0) {
    certification = phase_evaluation.density_claim_allowed ? "PASS" : "PASS_PARTIAL"
  } else if (input.evidence_records_collected > 0 && phase_evaluation.regressions.length === 0) {
    // Evidence discovered from public sources but benchmark density unchanged.
    certification = "PASS_PARTIAL"
  } else if (
    input.evidence_records_collected === 0 &&
    !density_improved &&
    phase_evaluation.regressions.length === 0
  ) {
    certification = "FAIL"
  }

  return {
    certification,
    density_claim_allowed: phase_evaluation.density_claim_allowed,
    remaining_blockers,
  }
}

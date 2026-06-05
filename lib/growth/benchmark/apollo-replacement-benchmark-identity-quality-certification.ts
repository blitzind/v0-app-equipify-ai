/** Phase 7.PS-IN — Benchmark identity quality certification. Client-safe. */

import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_CERTIFICATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { evaluateApolloReplacementBenchmarkPhaseOutcome } from "@/lib/growth/benchmark/apollo-replacement-benchmark-integration"

export function evaluateApolloBenchmarkIdentityQualityCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_CERTIFICATION_QA_MARKER
  benchmark_gated: true
  preserve_evidence: true
  no_audit_trail_deletion: true
  no_threshold_lowering: true
  no_sequence_enrollment: true
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_CERTIFICATION_QA_MARKER,
    benchmark_gated: true,
    preserve_evidence: true,
    no_audit_trail_deletion: true,
    no_threshold_lowering: true,
    no_sequence_enrollment: true,
  }
}

export function evaluateApolloBenchmarkIdentityQualityOutcome(input: {
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
  false_positives_contained: number
  false_positives_addressed: number
  legitimate_preserved: number
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: boolean
  remaining_blockers: string[]
} {
  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IN",
    before: input.before,
    after: input.after,
  })

  const verified_emails_preserved =
    input.after.channel.verified_emails >= input.before.channel.verified_emails
  const outreach_preserved =
    input.after.company.outreach_ready_companies >= input.before.company.outreach_ready_companies
  const named_persons_corrected =
    input.after.person.named_persons <= input.before.person.named_persons

  const remaining_blockers: string[] = []
  if (input.false_positives_addressed === 0) {
    remaining_blockers.push("no_false_positives_addressed")
  }
  if (!verified_emails_preserved) {
    remaining_blockers.push("verified_emails_regressed")
  }
  if (!outreach_preserved) {
    remaining_blockers.push("outreach_ready_companies_regressed")
  }
  if (phase_evaluation.regressions.includes("verified_emails")) {
    remaining_blockers.push("benchmark_verified_email_regression")
  }
  if (phase_evaluation.regressions.includes("outreach_ready_companies")) {
    remaining_blockers.push("benchmark_outreach_regression")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  const quality_cleanup_succeeded =
    input.false_positives_addressed > 0 &&
    verified_emails_preserved &&
    outreach_preserved &&
    !phase_evaluation.regressions.includes("verified_emails") &&
    !phase_evaluation.regressions.includes("outreach_ready_companies")

  if (quality_cleanup_succeeded) {
    // Named-person decrease is expected quality correction, not a certification failure.
    certification = named_persons_corrected ? "PASS" : "PASS_PARTIAL"
  }

  return {
    certification,
    density_claim_allowed: phase_evaluation.density_claim_allowed,
    remaining_blockers,
  }
}

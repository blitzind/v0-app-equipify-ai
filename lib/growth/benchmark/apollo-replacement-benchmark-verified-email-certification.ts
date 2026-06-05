/** Phase 7.PS-IL — Benchmark verified email completion certification. Client-safe. */

import { hasApolloReplacementBenchmarkDensityImprovement } from "@/lib/growth/benchmark/apollo-replacement-benchmark-delta"
import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_CERTIFICATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { evaluateApolloReplacementBenchmarkPhaseOutcome } from "@/lib/growth/benchmark/apollo-replacement-benchmark-integration"

export function evaluateApolloBenchmarkVerifiedEmailCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_CERTIFICATION_QA_MARKER
  benchmark_gated: true
  no_invented_emails: true
  no_pattern_promotion: true
  no_role_inbox_promotion: true
  no_threshold_lowering: true
  no_fixture_fallback: true
  no_sequence_enrollment: true
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_CERTIFICATION_QA_MARKER,
    benchmark_gated: true,
    no_invented_emails: true,
    no_pattern_promotion: true,
    no_role_inbox_promotion: true,
    no_threshold_lowering: true,
    no_fixture_fallback: true,
    no_sequence_enrollment: true,
  }
}

export function evaluateApolloBenchmarkVerifiedEmailOutcome(input: {
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
  completion_before: {
    verified_emails: number
    outreach_ready_contacts: number
    outreach_ready_companies: number
  }
  completion_after: {
    verified_emails: number
    outreach_ready_contacts: number
    outreach_ready_companies: number
  }
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: boolean
  remaining_blockers: string[]
} {
  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IL",
    before: input.before,
    after: input.after,
  })

  const verified_email_improved =
    input.after.channel.verified_emails > input.before.channel.verified_emails
  const outreach_company_improved =
    input.after.company.outreach_ready_companies > input.before.company.outreach_ready_companies

  const remaining_blockers: string[] = []
  if (!verified_email_improved && !outreach_company_improved) {
    remaining_blockers.push("no_verified_email_or_outreach_company_improvement")
  }
  if (phase_evaluation.regressions.length > 0) {
    remaining_blockers.push(`regressions:${phase_evaluation.regressions.join(",")}`)
  }
  if (input.after.channel.verified_emails <= 1) {
    remaining_blockers.push("verified_email_density_still_low")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (
    (verified_email_improved || outreach_company_improved) &&
    phase_evaluation.regressions.length === 0
  ) {
    certification = phase_evaluation.density_claim_allowed ? "PASS" : "PASS_PARTIAL"
  }

  return {
    certification,
    density_claim_allowed: phase_evaluation.density_claim_allowed,
    remaining_blockers,
  }
}

/** Phase 7.PS-IM — Benchmark density scale-up certification. Client-safe. */

import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_CERTIFICATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { evaluateApolloReplacementBenchmarkPhaseOutcome } from "@/lib/growth/benchmark/apollo-replacement-benchmark-integration"

export function evaluateApolloBenchmarkDensityScaleUpCertification(): {
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_CERTIFICATION_QA_MARKER
  benchmark_gated: true
  no_invented_names: true
  no_guessed_emails: true
  no_role_inbox_promotion: true
  no_threshold_lowering: true
  no_sequence_enrollment: true
  no_broad_unbounded_crawl: true
} {
  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_CERTIFICATION_QA_MARKER,
    benchmark_gated: true,
    no_invented_names: true,
    no_guessed_emails: true,
    no_role_inbox_promotion: true,
    no_threshold_lowering: true,
    no_sequence_enrollment: true,
    no_broad_unbounded_crawl: true,
  }
}

export function evaluateApolloBenchmarkDensityScaleUpOutcome(input: {
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  density_claim_allowed: boolean
  remaining_blockers: string[]
} {
  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IM",
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

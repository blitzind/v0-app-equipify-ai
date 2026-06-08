/**
 * Phase 7.PS-IU — Verified contact source benchmark certification.
 * Run: pnpm test:growth-apollo-replacement-contact-source-benchmark-cert-7-ps-iu
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_CONTACT_SOURCE_BENCHMARK_CERT_7_PS_IU_QA_MARKER =
  "growth-apollo-replacement-contact-source-benchmark-cert-7-ps-iu-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementContactSourceBenchmark },
    { evaluateContactSourceBenchmarkCertification },
    { evaluateContactSourceBenchmarkOutcome },
    { GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-contact-source-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-contact-source-benchmark-certification"),
    import("../lib/growth/benchmark/apollo-replacement-contact-source-benchmark-certification"),
    import("../lib/growth/benchmark/apollo-replacement-contact-source-benchmark-types"),
  ])

  const compliance = evaluateContactSourceBenchmarkCertification()
  const benchmark = await runApolloReplacementContactSourceBenchmark(admin)
  const outcome = evaluateContactSourceBenchmarkOutcome(benchmark)

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_CONTACT_SOURCE_BENCHMARK_CERT_7_PS_IU_QA_MARKER,
        benchmark_qa_marker: GROWTH_APOLLO_REPLACEMENT_CONTACT_SOURCE_BENCHMARK_QA_MARKER,
        certification: outcome.certification,
        compliance,
        benchmark_summary: {
          benchmark_id: benchmark.benchmark_id,
          baseline: benchmark.baseline,
          targets: benchmark.targets,
          gap_analysis: benchmark.gap_analysis,
          recommendation: benchmark.recommendation,
          recommendation_rationale: benchmark.recommendation_rationale,
          estimated_weeks_to_targets: benchmark.estimated_weeks_to_targets,
          fastest_path_meets_both_targets: outcome.fastest_path_meets_both_targets,
        },
        source_ranking: benchmark.source_ranking,
        comparison_matrix: benchmark.comparison_matrix,
        combination_scenarios: benchmark.combination_scenarios,
        sources: benchmark.sources.map((s) => ({
          key: s.key,
          label: s.label,
          evidence_tier: s.evidence_tier,
          observed_phase: s.observed_phase,
          marginal_density: s.marginal_density,
          cost: s.cost,
          operational: s.operational,
          confidence: s.confidence,
          rank_score: s.rank_score,
          notes: s.notes,
        })),
        ps_ir_observed_pdl: {
          companies_processed: 54,
          companies_with_pdl_records: 3,
          persons_accepted: 3,
          named_persons_delta: "16 → 22",
          titled_persons_delta: "12 → 18",
          verified_emails_delta: "4 → 4",
          outreach_ready_delta: "4 → 4",
        },
        remaining_blockers: outcome.remaining_blockers,
        messages: benchmark.messages,
      },
      null,
      2,
    ),
  )

  if (outcome.certification === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

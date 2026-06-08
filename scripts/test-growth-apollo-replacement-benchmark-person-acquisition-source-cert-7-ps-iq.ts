/**
 * Phase 7.PS-IQ — Person acquisition source benchmark audit (read-only).
 * Run: pnpm test:growth-apollo-replacement-benchmark-person-acquisition-source-cert-7-ps-iq
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_PERSON_ACQUISITION_SOURCE_CERT_7_PS_IQ_QA_MARKER =
  "growth-apollo-replacement-benchmark-person-acquisition-source-cert-7-ps-iq-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkPersonAcquisitionSourceAudit },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkPersonAcquisitionSourceCertification },
    { evaluateApolloBenchmarkPersonAcquisitionSourceOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-audit"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-person-acquisition-source-types"),
  ])

  const compliance = evaluateApolloBenchmarkPersonAcquisitionSourceCertification()

  const prior_snapshot = await loadApolloReplacementBenchmarkSnapshot(admin, {
    benchmark_id: "equipify-apollo-replacement-benchmark-v1",
    phase_version: "7.ps-in",
  })

  let benchmark_metrics = prior_snapshot?.metrics
  if (!benchmark_metrics) {
    const { loadApolloReplacementBenchmarkCohort } = await import(
      "../lib/growth/benchmark/apollo-replacement-benchmark-storage"
    )
    const { loadApolloReplacementBenchmarkMetrics } = await import(
      "../lib/growth/benchmark/apollo-replacement-benchmark-metrics"
    )
    const cohort = await loadApolloReplacementBenchmarkCohort(
      admin,
      "equipify-apollo-replacement-benchmark-v1",
    )
    if (!cohort?.company_ids.length) {
      console.log(JSON.stringify({ certification: "FAIL", error: "benchmark_cohort_missing" }))
      process.exit(1)
    }
    benchmark_metrics = await loadApolloReplacementBenchmarkMetrics(admin, cohort.company_ids)
  }

  const audit = await runApolloReplacementBenchmarkPersonAcquisitionSourceAudit(admin, {
    benchmark_metrics,
  })

  const { certification, density_claim_allowed, remaining_blockers, ...outcome } =
    evaluateApolloBenchmarkPersonAcquisitionSourceOutcome({
      benchmark_metrics,
      ranked_sources: audit.ranked_sources,
      audit_metrics: audit.audit_metrics,
      recommended_next_phase: audit.recommended_next_phase,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_PERSON_ACQUISITION_SOURCE_CERT_7_PS_IQ_QA_MARKER,
        audit_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PERSON_ACQUISITION_SOURCE_QA_MARKER,
        certification,
        compliance,
        benchmark_before: benchmark_metrics,
        cohort_company_count: audit.cohort_company_count,
        cohort_segmentation: audit.cohort_segmentation,
        primary_blocker: audit.primary_blocker,
        blocker_rationale: audit.blocker_rationale,
        provider_runtime: audit.provider_runtime,
        source_ranking: audit.source_ranking_table,
        ranked_sources: audit.ranked_sources.map((s) => ({
          key: s.key,
          label: s.label,
          category: s.category,
          wired_in_codebase: s.wired_in_codebase,
          configured_at_runtime: s.configured_at_runtime,
          benchmark_observed: s.benchmark_observed,
          observed_phase: s.observed_phase,
          yield: s.yield,
          cost_per_verified_contact_usd: s.cost_per_verified_contact_usd,
          implementation_complexity: s.implementation_complexity,
          compliance_risk: s.compliance_risk,
          recommendation: s.recommendation,
          recommendation_rationale: s.recommendation_rationale,
          rank_score: s.rank_score,
        })),
        audit_metrics: audit.audit_metrics,
        expected_benchmark_lift: audit.expected_benchmark_lift,
        recommended_next_phase: audit.recommended_next_phase,
        recommended_source_key: audit.recommended_source_key,
        recommended_rationale: audit.recommended_rationale,
        current_densities_per_100: {
          named_persons: outcome.current_named_persons_per_100,
          outreach_ready_companies: outcome.current_outreach_ready_companies_per_100,
        },
        target_densities_per_100: {
          named_persons: 50,
          outreach_ready_companies: 15,
        },
        gaps_per_100: {
          named_persons: outcome.named_person_gap_per_100,
          outreach_ready_companies: outcome.outreach_ready_gap_per_100,
        },
        meets_named_target_sources: outcome.meets_named_target_sources,
        meets_outreach_target_sources: outcome.meets_outreach_target_sources,
        meets_both_target_sources: outcome.meets_both_target_sources,
        density_claim_allowed,
        remaining_blockers,
        messages: audit.messages,
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

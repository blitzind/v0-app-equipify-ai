/**
 * Phase 7.PS-IK — Benchmark-gated density improvement certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-density-improvement-cert-7-ps-ik
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_DENSITY_IMPROVEMENT_CERT_7_PS_IK_QA_MARKER =
  "growth-apollo-replacement-benchmark-density-improvement-cert-7-ps-ik-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkDensityImprovement },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkDensityImprovementCertification },
    { evaluateApolloBenchmarkDensityImprovementOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-improvement"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-improvement-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-improvement-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-types"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-improvement-types"),
  ])

  const compliance = evaluateApolloBenchmarkDensityImprovementCertification()

  const baseline_snapshot = await loadApolloReplacementBenchmarkSnapshot(admin, {
    benchmark_id: "equipify-apollo-replacement-benchmark-v1",
    phase_version: APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION,
  })

  const benchmark_before_metrics =
    baseline_snapshot?.metrics ??
    (
      await runApolloReplacementBenchmark({
        admin,
        phase_name: "7.PS-IJ",
        phase_version: APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION,
        snapshot_kind: "baseline",
      })
    ).current_snapshot.metrics

  const improvement = await runApolloReplacementBenchmarkDensityImprovement(admin, {
    max_targets: 8,
  })

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IK",
    phase_version: "7.ps-ik",
    snapshot_kind: "phase_run",
    compare_phase_version: APOLLO_REPLACEMENT_BENCHMARK_BASELINE_PHASE_VERSION,
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IK",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkDensityImprovementOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
      phase_evaluation,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_DENSITY_IMPROVEMENT_CERT_7_PS_IK_QA_MARKER,
        improvement_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER,
        certification,
        compliance,
        selected_blocker: improvement.selected_blocker,
        blocker_rationale: improvement.blocker_rationale,
        segmentation: improvement.segmentation,
        targets: improvement.targets.map((t) => ({
          company_name: t.company_name,
          canonical_company_id: t.canonical_company_id,
          segment: t.segment,
          service_shop_score: t.service_shop_score,
          is_ps_he_anchor: t.is_ps_he_anchor,
          has_website: t.has_website,
        })),
        improvement_metrics: improvement.metrics,
        naming_upgrades: improvement.naming_upgrades,
        company_results: improvement.company_results,
        benchmark_before: benchmark_before_metrics,
        benchmark_after: benchmark_after.current_snapshot.metrics,
        delta_report_lines: benchmark_after.delta_report
          ? summarizeApolloReplacementBenchmarkDeltas(benchmark_after.delta_report)
          : [],
        delta_report: benchmark_after.delta_report,
        phase_evaluation,
        density_claim_allowed,
        remaining_blockers,
        messages: improvement.messages,
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

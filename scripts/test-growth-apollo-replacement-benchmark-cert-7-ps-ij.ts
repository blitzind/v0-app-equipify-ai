/**
 * Phase 7.PS-IJ — Apollo replacement benchmark certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-cert-7-ps-ij
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_REPLACEMENT_BENCHMARK_CERT_7_PS_IJ_QA_MARKER =
  "growth-apollo-replacement-benchmark-cert-7-ps-ij-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkCohort },
    {
      evaluateApolloReplacementBenchmarkCertification,
      evaluateApolloReplacementBenchmarkCertificationOutcome,
    },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-types"),
  ])

  const compliance = evaluateApolloReplacementBenchmarkCertification()

  const initial = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IJ",
    phase_version: "baseline",
    snapshot_kind: "baseline",
  })

  const reloaded = await loadApolloReplacementBenchmarkCohort(admin)
  const cohort_stable_on_reload =
    reloaded?.company_ids.join(",") === initial.cohort.company_ids.join(",")

  const phaseRun = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IJ",
    phase_version: "7.ps-ij.cert",
    snapshot_kind: "phase_run",
    compare_phase_version: "baseline",
  })

  const { certification, remaining_blockers } =
    evaluateApolloReplacementBenchmarkCertificationOutcome({
      result: initial,
      cohort_stable_on_reload,
    })

  const phase_evaluation =
    initial.baseline_snapshot && phaseRun.current_snapshot
      ? evaluateApolloReplacementBenchmarkPhaseOutcome({
          phase_name: "7.PS-IJ",
          before: initial.baseline_snapshot.metrics,
          after: phaseRun.current_snapshot.metrics,
          delta_report: phaseRun.delta_report,
        })
      : null

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_CERT_7_PS_IJ_QA_MARKER,
        benchmark_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_QA_MARKER,
        certification,
        compliance,
        storage_design: {
          runtime_table: "growth.discovery_refresh_queue",
          runtime_cohort_segment: "apollo_benchmark_cohort:{benchmark_id}",
          runtime_snapshot_segment: "apollo_benchmark_snapshot:{benchmark_id}:{phase_version}",
          dedicated_tables: [
            "growth.apollo_replacement_benchmark_cohorts",
            "growth.apollo_replacement_benchmark_snapshots",
          ],
          versioning: {
            benchmark_id: initial.cohort.benchmark_id,
            cohort_version: initial.cohort.cohort_version,
            snapshot_phase_version: "per-phase immutable key",
          },
        },
        cohort_summary: {
          benchmark_id: initial.cohort.benchmark_id,
          cohort_version: initial.cohort.cohort_version,
          company_count: initial.cohort.company_count,
          target_size: 100,
          cohort_created: initial.messages.includes("cohort_created"),
          cohort_stable_on_reload,
          composition: initial.cohort.composition,
        },
        baseline_metrics: initial.current_snapshot.metrics,
        phase_run_metrics: phaseRun.current_snapshot.metrics,
        delta_report_lines: phaseRun.delta_report
          ? summarizeApolloReplacementBenchmarkDeltas(phaseRun.delta_report)
          : [],
        delta_report: phaseRun.delta_report?.deltas ?? null,
        phase_evaluation,
        runtime_stats: {
          baseline_runtime_ms: initial.runtime_ms,
          phase_run_runtime_ms: phaseRun.runtime_ms,
        },
        integration_plan: {
          future_phase_hook: "runApolloReplacementBenchmark(admin, { phase_name, phase_version })",
          density_claim_gate: "assertApolloReplacementBenchmarkDensityClaim",
          compare_against: "7.ps-ij.baseline or latest prior snapshot",
        },
        messages: [...initial.messages, ...phaseRun.messages],
        remaining_blockers,
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

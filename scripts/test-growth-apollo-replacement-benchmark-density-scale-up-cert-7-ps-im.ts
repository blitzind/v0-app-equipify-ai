/**
 * Phase 7.PS-IM — Benchmark density scale-up certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-density-scale-up-cert-7-ps-im
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_DENSITY_SCALE_UP_CERT_7_PS_IM_QA_MARKER =
  "growth-apollo-replacement-benchmark-density-scale-up-cert-7-ps-im-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkDensityScaleUp },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkDensityScaleUpCertification },
    { evaluateApolloBenchmarkDensityScaleUpOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"),
  ])

  const compliance = evaluateApolloBenchmarkDensityScaleUpCertification()

  const prior_snapshot = await loadApolloReplacementBenchmarkSnapshot(admin, {
    benchmark_id: "equipify-apollo-replacement-benchmark-v1",
    phase_version: "7.ps-il",
  })

  const benchmark_before_metrics =
    prior_snapshot?.metrics ??
    (
      await runApolloReplacementBenchmark({
        admin,
        phase_name: "7.PS-IL",
        phase_version: "7.ps-il",
        snapshot_kind: "phase_run",
      })
    ).current_snapshot.metrics

  const scale_up = await runApolloReplacementBenchmarkDensityScaleUp(admin)

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IM",
    phase_version: "7.ps-im",
    snapshot_kind: "phase_run",
    compare_phase_version: "7.ps-il",
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IM",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkDensityScaleUpOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_DENSITY_SCALE_UP_CERT_7_PS_IM_QA_MARKER,
        scale_up_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER,
        certification,
        compliance,
        cohort: scale_up.cohort,
        candidates_found: scale_up.upgrade_candidates.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          company_name: row.company_name,
          in_benchmark: row.in_benchmark,
        })),
        upgrade_rejected_sample: scale_up.upgrade_rejected.slice(0, 40),
        identities_upgraded: scale_up.metrics.identities_upgraded,
        naming_upgrades: scale_up.naming_upgrades.filter((row) => row.upgraded),
        emails_selected: scale_up.selected_emails.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          company_name: row.company_name,
          ps_ik_upgrade: row.ps_ik_upgrade,
        })),
        rejected_emails_sample: scale_up.rejected_emails.slice(0, 40),
        scale_up_metrics: scale_up.metrics,
        person_results: scale_up.person_results,
        verified_emails: {
          scale_up_before: scale_up.before.verified_emails,
          scale_up_after: scale_up.after.verified_emails,
          benchmark_before: benchmark_before_metrics.channel.verified_emails,
          benchmark_after: benchmark_after.current_snapshot.metrics.channel.verified_emails,
        },
        outreach_ready: {
          contacts_before: scale_up.before.outreach_ready_contacts,
          contacts_after: scale_up.after.outreach_ready_contacts,
          companies_before: scale_up.before.outreach_ready_companies,
          companies_after: scale_up.after.outreach_ready_companies,
          benchmark_companies_before: benchmark_before_metrics.company.outreach_ready_companies,
          benchmark_companies_after:
            benchmark_after.current_snapshot.metrics.company.outreach_ready_companies,
        },
        benchmark_before: benchmark_before_metrics,
        benchmark_after: benchmark_after.current_snapshot.metrics,
        delta_report_lines: benchmark_after.delta_report
          ? summarizeApolloReplacementBenchmarkDeltas(benchmark_after.delta_report)
          : [],
        delta_report: benchmark_after.delta_report,
        phase_evaluation,
        density_claim_allowed,
        remaining_blockers,
        website_refreshes: scale_up.website_refreshes,
        messages: scale_up.messages,
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

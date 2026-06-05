/**
 * Phase 7.PS-IL — Benchmark-scoped verified email completion certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-verified-email-cert-7-ps-il
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_VERIFIED_EMAIL_CERT_7_PS_IL_QA_MARKER =
  "growth-apollo-replacement-benchmark-verified-email-cert-7-ps-il-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkVerifiedEmailCompletion },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkVerifiedEmailCertification },
    { evaluateApolloBenchmarkVerifiedEmailOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-verified-email-completion"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-verified-email-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-verified-email-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"),
  ])

  const compliance = evaluateApolloBenchmarkVerifiedEmailCertification()

  const prior_snapshot = await loadApolloReplacementBenchmarkSnapshot(admin, {
    benchmark_id: "equipify-apollo-replacement-benchmark-v1",
    phase_version: "7.ps-ik",
  })

  const benchmark_before_metrics =
    prior_snapshot?.metrics ??
    (
      await runApolloReplacementBenchmark({
        admin,
        phase_name: "7.PS-IK",
        phase_version: "7.ps-ik",
        snapshot_kind: "phase_run",
      })
    ).current_snapshot.metrics

  const completion = await runApolloReplacementBenchmarkVerifiedEmailCompletion(admin)

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IL",
    phase_version: "7.ps-il",
    snapshot_kind: "phase_run",
    compare_phase_version: "7.ps-ik",
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IL",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkVerifiedEmailOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
      completion_before: completion.before,
      completion_after: completion.after,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_VERIFIED_EMAIL_CERT_7_PS_IL_QA_MARKER,
        completion_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
        certification,
        compliance,
        selected_candidate_emails: completion.selected_candidates.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          company_name: row.company_name,
          ps_ik_upgrade: row.ps_ik_upgrade,
        })),
        rejected_emails: completion.rejected_candidates.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          rejection_reason: row.rejection_reason,
        })),
        completion_metrics: completion.metrics,
        person_results: completion.person_results,
        verified_emails: {
          completion_before: completion.before.verified_emails,
          completion_after: completion.after.verified_emails,
          benchmark_before: benchmark_before_metrics.channel.verified_emails,
          benchmark_after: benchmark_after.current_snapshot.metrics.channel.verified_emails,
        },
        outreach_ready: {
          contacts_before: completion.before.outreach_ready_contacts,
          contacts_after: completion.after.outreach_ready_contacts,
          companies_before: completion.before.outreach_ready_companies,
          companies_after: completion.after.outreach_ready_companies,
          benchmark_companies_before: benchmark_before_metrics.company.outreach_ready_companies,
          benchmark_companies_after: benchmark_after.current_snapshot.metrics.company.outreach_ready_companies,
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
        messages: completion.messages,
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

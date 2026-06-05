/**
 * Phase 7.PS-IN — Benchmark identity quality cleanup certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-identity-quality-cert-7-ps-in
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_IDENTITY_QUALITY_CERT_7_PS_IN_QA_MARKER =
  "growth-apollo-replacement-benchmark-identity-quality-cert-7-ps-in-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkIdentityQualityCleanup },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkIdentityQualityCertification },
    { evaluateApolloBenchmarkIdentityQualityOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-cleanup"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-identity-quality-types"),
  ])

  const compliance = evaluateApolloBenchmarkIdentityQualityCertification()

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

  const cleanup = await runApolloReplacementBenchmarkIdentityQualityCleanup(admin)

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IN",
    phase_version: "7.ps-in",
    snapshot_kind: "phase_run",
    compare_phase_version: "7.ps-il",
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IN",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkIdentityQualityOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
      false_positives_contained: cleanup.metrics.false_positives_contained,
      false_positives_addressed: cleanup.metrics.false_positives_addressed,
      legitimate_preserved: cleanup.metrics.legitimate_preserved,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_IDENTITY_QUALITY_CERT_7_PS_IN_QA_MARKER,
        cleanup_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_IDENTITY_QUALITY_QA_MARKER,
        certification,
        compliance,
        suspicious_persons_inspected: cleanup.inspected.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          company_name: row.company_name,
          is_real_person_name: row.is_real_person_name,
          should_contain: row.should_contain,
          containment_reason: row.containment_reason,
          upgrade_method: row.upgrade_method,
          evidence_ref: row.evidence_ref,
        })),
        contained_false_positives: cleanup.contained.filter((row) => row.contained),
        preserved_legitimate: cleanup.preserved_legitimate.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          company_name: row.company_name,
        })),
        cleanup_metrics: cleanup.metrics,
        named_persons: {
          benchmark_before: benchmark_before_metrics.person.named_persons,
          benchmark_after: benchmark_after.current_snapshot.metrics.person.named_persons,
        },
        verified_emails: {
          benchmark_before: benchmark_before_metrics.channel.verified_emails,
          benchmark_after: benchmark_after.current_snapshot.metrics.channel.verified_emails,
        },
        outreach_ready: {
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
        messages: cleanup.messages,
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

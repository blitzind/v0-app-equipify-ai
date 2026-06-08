/**
 * Phase 7.PS-IO — Benchmark multi-source professional identity expansion certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-professional-identity-expansion-cert-7-ps-io
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_CERT_7_PS_IO_QA_MARKER =
  "growth-apollo-replacement-benchmark-professional-identity-expansion-cert-7-ps-io-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkProfessionalIdentityExpansion },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkProfessionalIdentityExpansionCertification },
    { evaluateApolloBenchmarkProfessionalIdentityExpansionOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-types"),
  ])

  const compliance = evaluateApolloBenchmarkProfessionalIdentityExpansionCertification()

  const prior_snapshot = await loadApolloReplacementBenchmarkSnapshot(admin, {
    benchmark_id: "equipify-apollo-replacement-benchmark-v1",
    phase_version: "7.ps-in",
  })

  const benchmark_before_metrics =
    prior_snapshot?.metrics ??
    (
      await runApolloReplacementBenchmark({
        admin,
        phase_name: "7.PS-IN",
        phase_version: "7.ps-in",
        snapshot_kind: "phase_run",
      })
    ).current_snapshot.metrics

  const expansion = await runApolloReplacementBenchmarkProfessionalIdentityExpansion(admin)

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IO",
    phase_version: "7.ps-io",
    snapshot_kind: "phase_run",
    compare_phase_version: "7.ps-in",
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IO",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkProfessionalIdentityExpansionOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
      evidence_records_collected: expansion.evidence_records_collected,
      evidence_records_accepted: expansion.metrics.evidence_records_accepted,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_CERT_7_PS_IO_QA_MARKER,
        expansion_qa_marker:
          GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
        certification,
        compliance,
        sources_queried: expansion.sources_queried,
        evidence_records_collected: expansion.evidence_records_collected,
        evidence_records_accepted: expansion.metrics.evidence_records_accepted,
        evidence_records_rejected: expansion.metrics.evidence_records_rejected,
        persons_created: expansion.metrics.persons_created,
        titles_created: expansion.metrics.titles_created,
        committee_members_created: expansion.metrics.committee_members_created,
        committee_classifications: expansion.committee_classifications,
        rejected_sample: expansion.rejected.slice(0, 12),
        named_persons: {
          benchmark_before: benchmark_before_metrics.person.named_persons,
          benchmark_after: benchmark_after.current_snapshot.metrics.person.named_persons,
        },
        titled_persons: {
          benchmark_before: benchmark_before_metrics.person.titled_persons,
          benchmark_after: benchmark_after.current_snapshot.metrics.person.titled_persons,
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
        committee_members: {
          benchmark_before: benchmark_before_metrics.person.committee_members,
          benchmark_after: benchmark_after.current_snapshot.metrics.person.committee_members,
        },
        benchmark_before: benchmark_before_metrics,
        benchmark_after: benchmark_after.current_snapshot.metrics,
        delta_report_lines: benchmark_after.delta_report
          ? summarizeApolloReplacementBenchmarkDeltas(benchmark_after.delta_report)
          : [],
        delta_report: benchmark_after.delta_report,
        phase_evaluation,
        expansion_metrics: expansion.metrics,
        density_claim_allowed,
        remaining_blockers,
        messages: expansion.messages,
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

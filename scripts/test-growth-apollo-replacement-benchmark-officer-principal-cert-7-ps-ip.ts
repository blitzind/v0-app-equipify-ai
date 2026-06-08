/**
 * Phase 7.PS-IP — Benchmark officer/principal discovery certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-officer-principal-cert-7-ps-ip
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_OFFICER_PRINCIPAL_CERT_7_PS_IP_QA_MARKER =
  "growth-apollo-replacement-benchmark-officer-principal-cert-7-ps-ip-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkOfficerPrincipalDiscovery },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkOfficerPrincipalCertification },
    { evaluateApolloBenchmarkOfficerPrincipalOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-discovery"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-types"),
  ])

  const compliance = evaluateApolloBenchmarkOfficerPrincipalCertification()

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

  const discovery = await runApolloReplacementBenchmarkOfficerPrincipalDiscovery(admin)

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IP",
    phase_version: "7.ps-ip",
    snapshot_kind: "phase_run",
    compare_phase_version: "7.ps-in",
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IP",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkOfficerPrincipalOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
      evidence_records_collected: discovery.evidence_records_collected,
    })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_OFFICER_PRINCIPAL_CERT_7_PS_IP_QA_MARKER,
        discovery_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER,
        certification,
        compliance,
        companies_queried: discovery.companies_queried,
        evidence_sources_queried_count: discovery.evidence_sources_queried.length,
        evidence_sources_sample: discovery.evidence_sources_queried.slice(0, 8),
        officer_records_found: discovery.officer_records_found,
        principal_records_found: discovery.principal_records_found,
        evidence_records_collected: discovery.evidence_records_collected,
        evidence_records_accepted: discovery.metrics.evidence_records_accepted,
        evidence_records_rejected: discovery.metrics.evidence_records_rejected,
        persons_created: discovery.metrics.persons_created,
        titles_created: discovery.metrics.titles_created,
        committee_members_created: discovery.metrics.committee_members_created,
        rejected_sample: discovery.rejected.slice(0, 12),
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
        discovery_metrics: discovery.metrics,
        density_claim_allowed,
        remaining_blockers,
        messages: discovery.messages,
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

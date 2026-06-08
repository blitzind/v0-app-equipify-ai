/**
 * Phase 7.PS-IR — Benchmark PDL validation certification.
 * Run: pnpm test:growth-apollo-replacement-benchmark-pdl-validation-cert-7-ps-ir
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_APOLLO_BENCHMARK_PDL_VALIDATION_CERT_7_PS_IR_QA_MARKER =
  "growth-apollo-replacement-benchmark-pdl-validation-cert-7-ps-ir-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { runApolloReplacementBenchmarkPdlValidation },
    { runApolloReplacementBenchmark },
    { loadApolloReplacementBenchmarkSnapshot },
    { evaluateApolloBenchmarkPdlValidationCertification },
    { evaluateApolloBenchmarkPdlValidationOutcome },
    { summarizeApolloReplacementBenchmarkDeltas },
    { evaluateApolloReplacementBenchmarkPhaseOutcome },
    { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER },
    {
      runDeployedPdlBenchmarkValidation,
      shouldUseDeployedPdlBenchmarkValidationRuntime,
    },
    { isPdlApiConfigured },
  ] = await Promise.all([
    import("../lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-discovery"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-storage"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-certification"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-delta"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-integration"),
    import("../lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"),
    import("../lib/growth/qa/pdl-benchmark-validation-deployed-runtime"),
    import("../lib/growth/providers/pdl/pdl-config"),
  ])

  const compliance = evaluateApolloBenchmarkPdlValidationCertification()

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

  const use_deployed_runtime = shouldUseDeployedPdlBenchmarkValidationRuntime()
  const deployed_run = use_deployed_runtime
    ? await runDeployedPdlBenchmarkValidation({ admin, poll_timeout_ms: 600_000 })
    : null

  const validation =
    deployed_run?.validation ??
    (await runApolloReplacementBenchmarkPdlValidation(admin))

  const execution_channel = deployed_run
    ? deployed_run.channel
    : isPdlApiConfigured()
      ? "local_runtime"
      : "unconfigured"

  const benchmark_after = await runApolloReplacementBenchmark({
    admin,
    phase_name: "7.PS-IR",
    phase_version: "7.ps-ir",
    snapshot_kind: "phase_run",
    compare_phase_version: "7.ps-in",
  })

  const phase_evaluation = evaluateApolloReplacementBenchmarkPhaseOutcome({
    phase_name: "7.PS-IR",
    before: benchmark_before_metrics,
    after: benchmark_after.current_snapshot.metrics,
    delta_report: benchmark_after.delta_report,
  })

  const { certification, density_claim_allowed, remaining_blockers } =
    evaluateApolloBenchmarkPdlValidationOutcome({
      before: benchmark_before_metrics,
      after: benchmark_after.current_snapshot.metrics,
      persons_discovered: validation.metrics.persons_discovered,
      persons_persisted: validation.metrics.persons_persisted,
      pdl_configured: validation.preflight.pdl_configured,
    })

  const PDL_COST_PER_VERIFIED_CONTACT_USD = 0.18
  const cost_estimate_usd =
    validation.metrics.verified_emails_added > 0
      ? validation.metrics.verified_emails_added * PDL_COST_PER_VERIFIED_CONTACT_USD
      : validation.metrics.persons_persisted * PDL_COST_PER_VERIFIED_CONTACT_USD * 0.25

  const rejected_by_reason = validation.rejected.reduce<Record<string, number>>((acc, row) => {
    acc[row.reason] = (acc[row.reason] ?? 0) + 1
    return acc
  }, {})

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_APOLLO_BENCHMARK_PDL_VALIDATION_CERT_7_PS_IR_QA_MARKER,
        validation_qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
        certification,
        compliance,
        execution_channel,
        deployed_runtime: deployed_run
          ? {
              ok: deployed_run.ok,
              error: deployed_run.error,
              cron_telemetry_run_id: deployed_run.cron_telemetry_run_id,
            }
          : null,
        preflight: validation.preflight,
        runtime_diagnostics: {
          qa_marker: validation.runtime_diagnostics.qa_marker,
          loaders: validation.runtime_diagnostics.loaders,
          keys: validation.runtime_diagnostics.keys,
          production_safe: validation.runtime_diagnostics.production_safe,
        },
        companies_processed: validation.metrics.companies_processed,
        companies_with_results: validation.metrics.companies_with_results,
        companies_enriched: validation.metrics.companies_enriched,
        persons_discovered: validation.metrics.persons_discovered,
        persons_accepted: validation.metrics.persons_accepted,
        persons_persisted: validation.metrics.persons_persisted,
        persons_rejected: validation.metrics.persons_rejected,
        persons_promoted: validation.metrics.persons_promoted,
        titles_added: validation.metrics.titles_added,
        committee_members_created: validation.metrics.committee_members_created,
        verified_emails_added: validation.metrics.verified_emails_added,
        emails_returned: validation.metrics.emails_returned,
        outreach_ready_companies_added: validation.metrics.outreach_ready_companies_added,
        rejected_by_reason,
        rejected_sample: validation.rejected.slice(0, 12),
        company_results_sample: validation.company_results
          .filter((r) => r.persons_discovered > 0 || r.persons_persisted > 0)
          .slice(0, 8),
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
        validation_metrics: validation.metrics,
        verified_email_completion: validation.verified_email_completion
          ? {
              candidates_selected: validation.verified_email_completion.metrics.candidates_selected,
              emails_attempted: validation.verified_email_completion.metrics.emails_attempted,
              emails_verified: validation.verified_email_completion.metrics.emails_verified,
              emails_promoted: validation.verified_email_completion.metrics.emails_promoted,
            }
          : null,
        density_claim_allowed,
        cost_estimate_usd,
        remaining_blockers,
        messages: validation.messages,
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

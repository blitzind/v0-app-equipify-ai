/**
 * Phase 7.PS-IB — Batch graph expansion orchestration certification.
 * Run: pnpm test:growth-batch-graph-expansion-cert-7-ps-ib
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_BATCH_GRAPH_EXPANSION_CERT_7_PS_IB_QA_MARKER =
  "growth-batch-graph-expansion-cert-7-ps-ib-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { loadBatchGraphExpansionCohort },
    { runBatchGraphExpansion },
    { parseBatchGraphExpansionResumeToken, loadBatchGraphExpansionManifest },
    { evaluateBatchGraphExpansionCertification, evaluateBatchGraphExpansionCertificationOutcome },
    { GROWTH_BATCH_GRAPH_EXPANSION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/batch-graph-expansion-cohort"),
    import("../lib/growth/graph-expansion/batch-graph-expansion-orchestrator"),
    import("../lib/growth/graph-expansion/batch-graph-expansion-queue"),
    import("../lib/growth/graph-expansion/batch-graph-expansion-certification"),
    import("../lib/growth/graph-expansion/batch-graph-expansion-types"),
  ])

  const compliance = evaluateBatchGraphExpansionCertification()

  const cohort = await loadBatchGraphExpansionCohort(admin, {
    include_anchors: false,
    only_unenriched: true,
    limit: 120,
  })

  const wave_size = 25
  const max_companies = 25

  const expansion = await runBatchGraphExpansion(admin, {
    wave_size,
    max_companies,
    cohort_limit: 120,
    include_anchors: false,
    stop_after_wave: true,
  })

  const resumeParsed = parseBatchGraphExpansionResumeToken(expansion.resume_token)
  const manifestReloaded = await loadBatchGraphExpansionManifest(admin, expansion.batch_id)
  const resume_smoke_ok = Boolean(resumeParsed?.batch_id && manifestReloaded?.batch_id)

  const { certification, remaining_blockers } = evaluateBatchGraphExpansionCertificationOutcome({
    result: expansion,
    resume_smoke_ok,
  })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_BATCH_GRAPH_EXPANSION_CERT_7_PS_IB_QA_MARKER,
        expansion_qa_marker: GROWTH_BATCH_GRAPH_EXPANSION_QA_MARKER,
        certification,
        compliance,
        batch_design: {
          queue_table: "growth.discovery_refresh_queue",
          company_segment_key: "bgx_co:{batch_id}:{company_id}",
          manifest_segment_key: "bgx_batch:{batch_id}",
          wave_size,
          max_companies_per_run: max_companies,
          resume_token_format: "{batch_id}:w:{wave_index}[:c:{company_id}]",
        },
        cohort_unenriched_available: cohort.length,
        batch_id: expansion.batch_id,
        resume_token: expansion.resume_token,
        resume_smoke_ok,
        manifest: expansion.manifest,
        wave_metrics: expansion.wave_metrics,
        density_funnel: expansion.density_funnel,
        named_persons: {
          before: expansion.density_funnel.before.total_named_persons,
          after: expansion.density_funnel.after.total_named_persons,
          delta:
            expansion.density_funnel.after.total_named_persons -
            expansion.density_funnel.before.total_named_persons,
        },
        verified_channels: {
          emails_before: expansion.density_funnel.before.total_verified_emails,
          emails_after: expansion.density_funnel.after.total_verified_emails,
          phones_before: expansion.density_funnel.before.total_verified_phones,
          phones_after: expansion.density_funnel.after.total_verified_phones,
        },
        outreach_ready: {
          before: expansion.density_funnel.before.outreach_ready_companies,
          after: expansion.density_funnel.after.outreach_ready_companies,
          delta: expansion.wave_metrics.outreach_ready_delta,
        },
        runtime_stats: {
          wave_runtime_ms: expansion.wave_metrics.runtime_ms,
          provider_counters: expansion.wave_metrics.provider_counters,
          companies_processed: expansion.wave_metrics.companies_processed,
          companies_succeeded: expansion.wave_metrics.companies_succeeded,
          companies_failed: expansion.wave_metrics.companies_failed,
          fetch_errors: expansion.wave_metrics.fetch_errors,
        },
        failure_reasons: expansion.manifest.failure_reasons.slice(0, 12),
        company_sample: expansion.company_results.slice(0, 8).map((row) => ({
          company_name: row.company_name,
          status: row.status,
          contacts_discovered: row.metrics.contacts_discovered,
          named_persons_added: row.metrics.named_persons_added,
          failure_reason: row.metrics.failure_reason,
        })),
        messages: expansion.messages,
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

/**
 * Phase 7.PS-IE — Batch wave density improvement certification.
 * Run: pnpm test:growth-batch-wave-density-improvement-cert-7-ps-ie
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_CERT_7_PS_IE_QA_MARKER =
  "growth-batch-wave-density-improvement-cert-7-ps-ie-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { loadBatchWaveDensityImprovementCohort },
    { runBatchWaveDensityImprovement },
    {
      evaluateBatchWaveDensityImprovementCertification,
      evaluateBatchWaveDensityImprovementCertificationOutcome,
    },
    { GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/batch-wave-density-improvement-cohort"),
    import("../lib/growth/graph-expansion/batch-wave-density-improvement"),
    import("../lib/growth/graph-expansion/batch-wave-density-improvement-certification"),
    import("../lib/growth/graph-expansion/batch-wave-density-improvement-types"),
  ])

  const compliance = evaluateBatchWaveDensityImprovementCertification()
  const cohortPreview = await loadBatchWaveDensityImprovementCohort(admin, {
    only_enriched: true,
    limit: 12,
  })

  const improvement = await runBatchWaveDensityImprovement(admin, {
    batch_id: cohortPreview.batch_id || undefined,
    limit: 12,
    company_timeout_ms: 120_000,
  })

  const { certification, remaining_blockers } =
    evaluateBatchWaveDensityImprovementCertificationOutcome({ result: improvement })

  const page_discovery_gaps = [
    ...new Set(improvement.company_audits.flatMap((audit) => audit.discovery_gaps)),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_CERT_7_PS_IE_QA_MARKER,
        improvement_qa_marker: GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_QA_MARKER,
        certification,
        compliance,
        batch_id: improvement.batch_id,
        companies_inspected: improvement.companies_inspected,
        page_discovery_gaps,
        pages_newly_crawled: improvement.metrics.pages_newly_crawled,
        names_recovered: improvement.names_recovered,
        titles_recovered: improvement.titles_recovered,
        verified_channels_promoted: improvement.verified_channels_promoted,
        named_persons: {
          before: improvement.density_funnel.before.total_named_persons,
          after: improvement.density_funnel.after.total_named_persons,
          delta: improvement.metrics.named_persons_delta,
        },
        titles: {
          before: improvement.density_funnel.before.companies_with_contacts,
          delta: improvement.metrics.titles_delta,
        },
        verified_channels: {
          emails_before: improvement.density_funnel.before.total_verified_emails,
          emails_after: improvement.density_funnel.after.total_verified_emails,
          phones_before: improvement.density_funnel.before.total_verified_phones,
          phones_after: improvement.density_funnel.after.total_verified_phones,
        },
        generic_channels_preserved: improvement.metrics.generic_contacts_preserved,
        outreach_ready: {
          before: improvement.density_funnel.before.outreach_ready_companies,
          after: improvement.density_funnel.after.outreach_ready_companies,
          delta: improvement.metrics.outreach_ready_delta,
        },
        company_audits_sample: improvement.company_audits.slice(0, 6).map((audit) => ({
          company_name: audit.company_name,
          pages_crawled: audit.pages_crawled_before.length,
          person_pages_attempted: audit.person_page_paths_attempted.length,
          person_pages_missing: audit.person_page_paths_missing.length,
          generic_contacts: audit.generic_contacts_before,
          why_remained_generic: audit.why_remained_generic,
          discovery_gaps: audit.discovery_gaps,
          external_evidence_signals: audit.external_evidence_signals,
        })),
        company_results_sample: improvement.company_results.slice(0, 6).map((row) => ({
          company_name: row.company_name,
          ok: row.ok,
          pages_newly_crawled: row.pages_newly_crawled.length,
          named_persons_delta: row.named_persons_delta,
        })),
        runtime_stats: {
          runtime_ms: improvement.metrics.runtime_ms,
          companies_processed: improvement.metrics.companies_processed,
          companies_succeeded: improvement.metrics.companies_succeeded,
          companies_failed: improvement.metrics.companies_failed,
          fetch_errors: improvement.metrics.fetch_errors,
        },
        messages: improvement.messages,
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

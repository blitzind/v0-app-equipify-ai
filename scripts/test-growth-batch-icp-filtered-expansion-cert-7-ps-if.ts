/**
 * Phase 7.PS-IF — ICP-filtered batch expansion certification.
 * Run: pnpm test:growth-batch-icp-filtered-expansion-cert-7-ps-if
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_BATCH_ICP_FILTERED_EXPANSION_CERT_7_PS_IF_QA_MARKER =
  "growth-batch-icp-filtered-expansion-cert-7-ps-if-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { loadBatchIcpFilteredCohort },
    { runBatchIcpFilteredExpansion },
    {
      evaluateBatchIcpFilteredExpansionCertification,
      evaluateBatchIcpFilteredExpansionCertificationOutcome,
    },
    { GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/batch-icp-filtered-cohort"),
    import("../lib/growth/graph-expansion/batch-icp-filtered-expansion"),
    import("../lib/growth/graph-expansion/batch-icp-filtered-expansion-certification"),
    import("../lib/growth/graph-expansion/batch-icp-filter-types"),
  ])

  const compliance = evaluateBatchIcpFilteredExpansionCertification()

  const cohortPreview = await loadBatchIcpFilteredCohort(admin, {
    limit: 25,
    scan_limit: 400,
    include_anchors: true,
    only_unenriched: true,
    excluded_sample_limit: 20,
  })

  const expansion = await runBatchIcpFilteredExpansion(admin, {
    wave_size: 25,
    max_companies: 25,
    scan_limit: 400,
    include_anchors: true,
    stop_after_wave: true,
  })

  const { certification, remaining_blockers } =
    evaluateBatchIcpFilteredExpansionCertificationOutcome({ result: expansion })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_BATCH_ICP_FILTERED_EXPANSION_CERT_7_PS_IF_QA_MARKER,
        expansion_qa_marker: GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER,
        certification,
        compliance,
        cohort_selection: {
          icp_qualified: expansion.cohort_diagnostics.icp_qualified_count,
          off_icp_excluded: expansion.cohort_diagnostics.off_icp_excluded_count,
          selected: expansion.cohort_diagnostics.selected.map((row) => ({
            company_name: row.company_name,
            industry: row.industry,
            source_tags: row.source_tags,
            website: row.website,
            domain: row.domain,
            icp_match_reason: row.icp_match_reason,
            contact_count: row.contact_count,
          })),
          excluded_sample: expansion.cohort_diagnostics.excluded_sample.map((row) => ({
            company_name: row.company_name,
            industry: row.industry,
            exclusion_reason: row.exclusion_reason,
          })),
        },
        prior_wave_comparison: {
          prior_wave_named_persons: expansion.prior_wave_named_persons,
          named_person_yield_delta: expansion.named_person_yield_delta,
        },
        named_persons: {
          before: expansion.expansion.density_funnel.before.total_named_persons,
          after: expansion.expansion.density_funnel.after.total_named_persons,
          added: expansion.expansion.wave_metrics.named_persons_added,
        },
        titles: {
          added: expansion.expansion.wave_metrics.titles_added,
        },
        verified_channels: {
          emails_added: expansion.expansion.wave_metrics.verified_emails_added,
          phones_added: expansion.expansion.wave_metrics.verified_phones_added,
          emails_after: expansion.expansion.density_funnel.after.total_verified_emails,
          phones_after: expansion.expansion.density_funnel.after.total_verified_phones,
        },
        outreach_ready: {
          before: expansion.expansion.density_funnel.before.outreach_ready_companies,
          after: expansion.expansion.density_funnel.after.outreach_ready_companies,
          delta: expansion.expansion.wave_metrics.outreach_ready_delta,
        },
        enrichment: {
          contacts_discovered: expansion.expansion.wave_metrics.contacts_discovered,
          companies_with_contacts_before:
            expansion.expansion.density_funnel.before.companies_with_contacts,
          companies_with_contacts_after:
            expansion.expansion.density_funnel.after.companies_with_contacts,
          generic_identities: expansion.expansion.density_funnel.after.generic_identities,
        },
        batch_id: expansion.expansion.batch_id,
        resume_token: expansion.expansion.resume_token,
        runtime_stats: {
          wave_runtime_ms: expansion.expansion.wave_metrics.runtime_ms,
          companies_processed: expansion.expansion.wave_metrics.companies_processed,
          companies_succeeded: expansion.expansion.wave_metrics.companies_succeeded,
          companies_failed: expansion.expansion.wave_metrics.companies_failed,
          fetch_errors: expansion.expansion.wave_metrics.fetch_errors,
          provider_counters: expansion.expansion.wave_metrics.provider_counters,
        },
        company_results_sample: expansion.expansion.company_results.slice(0, 8).map((row) => ({
          company_name: row.company_name,
          status: row.status,
          contacts_discovered: row.metrics.contacts_discovered,
          named_persons_added: row.metrics.named_persons_added,
        })),
        cohort_preview_counts: {
          icp_qualified: cohortPreview.diagnostics.icp_qualified_count,
          off_icp_excluded: cohortPreview.diagnostics.off_icp_excluded_count,
        },
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

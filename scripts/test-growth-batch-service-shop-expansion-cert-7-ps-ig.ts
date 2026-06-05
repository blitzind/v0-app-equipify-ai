/**
 * Phase 7.PS-IG — Service-shop source targeting batch certification.
 * Run: pnpm test:growth-batch-service-shop-expansion-cert-7-ps-ig
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_BATCH_SERVICE_SHOP_EXPANSION_CERT_7_PS_IG_QA_MARKER =
  "growth-batch-service-shop-expansion-cert-7-ps-ig-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { loadServiceShopCohort },
    { runBatchServiceShopExpansion },
    {
      evaluateBatchServiceShopExpansionCertification,
      evaluateBatchServiceShopExpansionCertificationOutcome,
    },
    { GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/service-shop-cohort"),
    import("../lib/growth/graph-expansion/batch-service-shop-expansion"),
    import("../lib/growth/graph-expansion/batch-service-shop-expansion-certification"),
    import("../lib/growth/graph-expansion/service-shop-expansion-types"),
  ])

  const compliance = evaluateBatchServiceShopExpansionCertification()

  const cohortPreview = await loadServiceShopCohort(admin, {
    limit: 25,
    scan_limit: 500,
    include_anchors: true,
  })

  const expansion = await runBatchServiceShopExpansion(admin, {
    wave_size: 25,
    max_companies: 25,
    scan_limit: 500,
    include_anchors: true,
    stop_after_wave: true,
  })

  const { certification, remaining_blockers } =
    evaluateBatchServiceShopExpansionCertificationOutcome({ result: expansion })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_BATCH_SERVICE_SHOP_EXPANSION_CERT_7_PS_IG_QA_MARKER,
        expansion_qa_marker: GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER,
        certification,
        compliance,
        cohort_selection: {
          companies_scored: expansion.cohort_diagnostics.companies_scored,
          companies_selected: expansion.cohort_diagnostics.companies_selected,
          down_ranked_excluded: expansion.cohort_diagnostics.down_ranked_excluded,
          score_distribution: expansion.cohort_diagnostics.score_distribution,
          selected: expansion.cohort_diagnostics.selected.map((row) => ({
            company_name: row.company_name,
            industry: row.industry,
            source_tags: row.source_tags,
            website: row.website,
            service_shop_score: row.service_shop_score,
            score_tier: row.score_tier,
            up_signals: row.up_signals,
            down_rank_reason: row.down_rank_reason,
          })),
          down_ranked_sample: expansion.cohort_diagnostics.down_ranked_sample.map((row) => ({
            company_name: row.company_name,
            industry: row.industry,
            service_shop_score: row.service_shop_score,
            down_rank_reason: row.down_rank_reason,
          })),
        },
        prior_wave_comparison: {
          prior_wave_named_persons: expansion.prior_wave_named_persons,
          named_person_yield_delta: expansion.named_person_yield_delta,
        },
        names_discovered: expansion.names_discovered,
        titles_discovered: expansion.titles_discovered,
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
          companies_with_contacts_after:
            expansion.expansion.density_funnel.after.companies_with_contacts,
          generic_identities: expansion.expansion.density_funnel.after.generic_identities,
        },
        source_contribution: expansion.source_contribution,
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
          companies_selected: cohortPreview.diagnostics.companies_selected,
          down_ranked_excluded: cohortPreview.diagnostics.down_ranked_excluded,
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

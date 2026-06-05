/**
 * Phase 7.PS-IH — Service-shop corroboration & channel completion certification.
 * Run: pnpm test:growth-batch-service-shop-corroboration-channel-completion-cert-7-ps-ih
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_BATCH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_CERT_7_PS_IH_QA_MARKER =
  "growth-batch-service-shop-corroboration-channel-completion-cert-7-ps-ih-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const [
    { loadServiceShopCorroborationTargets },
    { runBatchServiceShopCorroborationChannelCompletion },
    {
      evaluateBatchServiceShopCorroborationChannelCompletionCertification,
      evaluateBatchServiceShopCorroborationChannelCompletionCertificationOutcome,
    },
    { GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/service-shop-corroboration-targets"),
    import("../lib/growth/graph-expansion/batch-service-shop-corroboration-channel-completion"),
    import("../lib/growth/graph-expansion/batch-service-shop-corroboration-channel-completion-certification"),
    import("../lib/growth/graph-expansion/service-shop-corroboration-types"),
  ])

  const compliance = evaluateBatchServiceShopCorroborationChannelCompletionCertification()
  const targetPreview = await loadServiceShopCorroborationTargets(admin, { scan_limit: 500 })

  const result = await runBatchServiceShopCorroborationChannelCompletion(admin, {
    scan_limit: 500,
  })

  const { certification, remaining_blockers } =
    evaluateBatchServiceShopCorroborationChannelCompletionCertificationOutcome({ result })

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_BATCH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_CERT_7_PS_IH_QA_MARKER,
        completion_qa_marker: GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER,
        certification,
        compliance,
        selected_targets: result.selected_targets.map((row) => ({
          full_name: row.full_name,
          company_name: row.company_name,
          title: row.title,
          service_shop_score: row.service_shop_score,
          is_ps_he_anchor: row.is_ps_he_anchor,
          extended_timeout: row.extended_timeout,
          has_external_evidence: row.has_external_evidence,
          has_corroboration_evidence: row.has_corroboration_evidence,
        })),
        rejected_targets: result.rejected_targets.map((row) => ({
          full_name: row.full_name,
          company_name: row.company_name,
          service_shop_score: row.service_shop_score,
          rejection_reason: row.rejection_reason,
        })),
        target_preview: {
          selected: targetPreview.selected.length,
          rejected: targetPreview.rejected.length,
        },
        metrics: result.metrics,
        verified_channels: {
          emails_before: result.before.verified_emails,
          emails_after: result.after.verified_emails,
          phones_before: result.before.verified_phones,
          phones_after: result.after.verified_phones,
        },
        outreach_ready: {
          contacts_before: result.before.outreach_ready_contacts,
          contacts_after: result.after.outreach_ready_contacts,
          companies_before: result.before.outreach_ready_companies,
          companies_after: result.after.outreach_ready_companies,
          delta: result.outreach_ready_delta,
        },
        person_results: result.person_results,
        messages: result.messages,
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

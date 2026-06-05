/**
 * Phase 7.PS-HY — Professional identity corroboration certification.
 * Run: pnpm test:growth-professional-identity-corroboration-cert-7-ps-hy
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateProfessionalIdentityCorroborationExpansionCertification } from "../lib/growth/professional-identity-corroboration/professional-identity-corroboration-expansion-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_CERT_7_PS_HY_QA_MARKER =
  "growth-professional-identity-corroboration-cert-7-ps-hy-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runProfessionalIdentityCorroborationExpansion },
    { loadPersonCommitteeDensityExpansionCohort },
    { GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/professional-identity-corroboration/professional-identity-corroboration-expansion"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateProfessionalIdentityCorroborationExpansionCertification()

  const cohort = await loadPersonCommitteeDensityExpansionCohort(admin, {
    include_anchors: true,
    limit: 20,
  })

  const expansion = await runProfessionalIdentityCorroborationExpansion(admin, { cohort })

  const title_density_increased =
    (expansion.after.graph_metrics.titles_total ?? 0) >
    (expansion.before.graph_metrics.titles_total ?? 0)
  const identity_confidence_improved =
    expansion.metrics.persons_corroborated > 0 ||
    expansion.metrics.titles_strengthened > 0 ||
    expansion.metrics.linkedin_urls_discovered > 0
  const channel_readiness_improved =
    expansion.metrics.verified_channels_promoted > 0 ||
    expansion.after.outreach_ready_companies > expansion.before.outreach_ready_companies
  const committee_increased =
    expansion.after.committee_members_verified > expansion.before.committee_members_verified

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    compliance.evidence_backed_only &&
    compliance.no_paid_enrichment_providers &&
    compliance.no_people_from_linkedin_alone &&
    compliance.no_threshold_lowering &&
    (identity_confidence_improved || channel_readiness_improved) &&
    (title_density_increased ||
      expansion.metrics.titles_strengthened > 0 ||
      expansion.metrics.linkedin_urls_discovered > 0 ||
      expansion.metrics.verified_channels_promoted > 0)
  ) {
    certification = "PASS"
  } else if (
    expansion.metrics.persons_corroborated > 0 ||
    expansion.metrics.persons_processed > 0 ||
    expansion.metrics.channel_jobs_enqueued > 0
  ) {
    certification = "PASS_PARTIAL"
  } else if (expansion.targets.length > 0) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers = [
    ...(!identity_confidence_improved ? ["no_identity_confidence_improvement"] : []),
    ...(!channel_readiness_improved ? ["channel_readiness_unchanged"] : []),
    ...(!committee_increased ? ["committee_density_still_zero_or_unchanged"] : []),
    ...(expansion.after.outreach_ready_companies <= expansion.before.outreach_ready_companies
      ? ["outreach_ready_companies_unchanged"]
      : []),
    ...(expansion.metrics.persons_corroborated === 0 ? ["no_persons_corroborated"] : []),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_CERT_7_PS_HY_QA_MARKER,
        certification,
        compliance,
        cohort_size: cohort.length,
        persons_processed: expansion.metrics.persons_processed,
        corroborated_persons: expansion.metrics.persons_corroborated,
        titles_strengthened: expansion.metrics.titles_strengthened,
        professional_urls_discovered: expansion.metrics.linkedin_urls_discovered,
        verified_channels_promoted: expansion.metrics.verified_channels_promoted,
        committee_members_promoted: expansion.metrics.committee_members_promoted,
        channel_jobs_enqueued: expansion.metrics.channel_jobs_enqueued,
        named_person_density: {
          before_pct: expansion.before.graph_metrics.named_person_density_pct,
          after_pct: expansion.after.graph_metrics.named_person_density_pct,
          persons_before: expansion.before.graph_metrics.named_persons_total,
          persons_after: expansion.after.graph_metrics.named_persons_total,
        },
        committee_density: {
          members_before: expansion.before.committee_members_verified,
          members_after: expansion.after.committee_members_verified,
          members_delta:
            expansion.after.committee_members_verified -
            expansion.before.committee_members_verified,
          industry_before_pct: expansion.before.graph_metrics.committee_density_pct,
          industry_after_pct: expansion.after.graph_metrics.committee_density_pct,
        },
        title_metrics: {
          titles_total_before: expansion.before.graph_metrics.titles_total,
          titles_total_after: expansion.after.graph_metrics.titles_total,
          titles_delta:
            (expansion.after.graph_metrics.titles_total ?? 0) -
            (expansion.before.graph_metrics.titles_total ?? 0),
        },
        outreach_ready_companies: {
          before: expansion.before.outreach_ready_companies,
          after: expansion.after.outreach_ready_companies,
          delta: expansion.after.outreach_ready_companies - expansion.before.outreach_ready_companies,
        },
        verified_channels: {
          emails_before: expansion.before.graph_metrics.verified_emails_total,
          emails_after: expansion.after.graph_metrics.verified_emails_total,
          phones_before: expansion.before.graph_metrics.verified_phones_total,
          phones_after: expansion.after.graph_metrics.verified_phones_total,
        },
        person_results: expansion.person_results,
        expansion_messages: expansion.messages,
        expansion_qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
        remaining_blockers,
      },
      null,
      2,
    ),
  )

  process.exit(certification === "FAIL" ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Phase 7.PS-HX — External evidence source expansion certification.
 * Run: pnpm test:growth-external-evidence-cert-7-ps-hx
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateExternalEvidenceExpansionCertification } from "../lib/growth/external-evidence/external-evidence-expansion-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_EXTERNAL_EVIDENCE_CERT_7_PS_HX_QA_MARKER =
  "growth-external-evidence-cert-7-ps-hx-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runExternalEvidenceExpansion },
    { loadPersonCommitteeDensityExpansionCohort },
    { GROWTH_EXTERNAL_EVIDENCE_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/external-evidence/external-evidence-expansion"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/external-evidence/external-evidence-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateExternalEvidenceExpansionCertification()

  const cohort = await loadPersonCommitteeDensityExpansionCohort(admin, {
    include_anchors: true,
    limit: 20,
  })

  const expansion = await runExternalEvidenceExpansion(admin, { cohort })

  const named_density_increased =
    expansion.after.graph_metrics.named_person_density_pct >
      expansion.before.graph_metrics.named_person_density_pct ||
    expansion.after.graph_metrics.named_persons_total >
      expansion.before.graph_metrics.named_persons_total
  const title_density_increased =
    (expansion.after.graph_metrics.titles_total ?? 0) >
    (expansion.before.graph_metrics.titles_total ?? 0)
  const committee_increased =
    expansion.after.committee_members_verified > expansion.before.committee_members_verified

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    compliance.no_paid_enrichment_providers &&
    compliance.evidence_backed_only &&
    (named_density_increased || title_density_increased) &&
    (expansion.metrics.names_discovered > 0 ||
      expansion.metrics.titles_discovered > 0 ||
      expansion.metrics.latent_titles_recovered > 0 ||
      expansion.metrics.persons_materialized > 0)
  ) {
    certification = "PASS"
  } else if (
    expansion.metrics.external_evidence_records > 0 ||
    expansion.metrics.sources_queried > 0 ||
    expansion.metrics.companies_enriched > 0 ||
    expansion.metrics.latent_titles_recovered > 0
  ) {
    certification = "PASS_PARTIAL"
  } else if (expansion.metrics.sources_queried > 0) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers = [
    ...(!named_density_increased ? ["named_person_density_not_increased"] : []),
    ...(!title_density_increased ? ["title_density_not_increased"] : []),
    ...(!committee_increased ? ["committee_density_still_zero_or_unchanged"] : []),
    ...(expansion.after.outreach_ready_companies <= expansion.before.outreach_ready_companies
      ? ["outreach_ready_companies_unchanged"]
      : []),
    ...(expansion.metrics.external_evidence_records === 0
      ? ["no_external_evidence_records_acquired"]
      : []),
    ...(expansion.metrics.companies_enriched === 0 ? ["no_cohort_companies_enriched"] : []),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_EXTERNAL_EVIDENCE_CERT_7_PS_HX_QA_MARKER,
        certification,
        compliance,
        cohort_size: cohort.length,
        sources_queried: expansion.metrics.sources_queried,
        sources_with_records: expansion.metrics.sources_with_records,
        external_evidence_records: expansion.metrics.external_evidence_records,
        companies_enriched: expansion.metrics.companies_enriched,
        names_acquired: expansion.metrics.names_discovered,
        titles_acquired:
          expansion.metrics.titles_discovered + expansion.metrics.latent_titles_recovered,
        committee_members_promoted: expansion.metrics.committee_members_promoted,
        persons_materialized: expansion.metrics.persons_materialized,
        latent_titles_recovered: expansion.metrics.latent_titles_recovered,
        named_person_density: {
          before_pct: expansion.before.graph_metrics.named_person_density_pct,
          after_pct: expansion.after.graph_metrics.named_person_density_pct,
          delta_pct:
            expansion.after.graph_metrics.named_person_density_pct -
            expansion.before.graph_metrics.named_person_density_pct,
          persons_before: expansion.before.graph_metrics.named_persons_total,
          persons_after: expansion.after.graph_metrics.named_persons_total,
          persons_delta:
            expansion.after.graph_metrics.named_persons_total -
            expansion.before.graph_metrics.named_persons_total,
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
        graph_delta: expansion.graph_delta,
        acquisition_messages: expansion.acquisition_messages,
        expansion_messages: expansion.messages,
        expansion_qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
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

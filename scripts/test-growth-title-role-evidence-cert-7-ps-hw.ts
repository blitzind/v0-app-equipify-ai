/**
 * Phase 7.PS-HW — Title & role evidence expansion certification.
 * Run: pnpm test:growth-title-role-evidence-cert-7-ps-hw
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateTitleRoleEvidenceExpansionCertification } from "../lib/growth/human-identity-evidence/title-role-evidence-expansion-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_TITLE_ROLE_EVIDENCE_CERT_7_PS_HW_QA_MARKER =
  "growth-title-role-evidence-cert-7-ps-hw-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runTitleRoleEvidenceExpansion },
    { loadPersonCommitteeDensityExpansionCohort },
    { GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/human-identity-evidence/title-role-evidence-expansion"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/human-identity-evidence/title-role-evidence-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateTitleRoleEvidenceExpansionCertification()

  const cohort = await loadPersonCommitteeDensityExpansionCohort(admin, {
    include_anchors: true,
    limit: 20,
  })

  const expansion = await runTitleRoleEvidenceExpansion(admin, { cohort })

  const titled_increased = expansion.after.titled_persons > expansion.before.titled_persons
  const committee_increased =
    expansion.after.committee_members_verified > expansion.before.committee_members_verified
  const title_density_increased =
    (expansion.after.graph_metrics.titles_total ?? 0) >
    (expansion.before.graph_metrics.titles_total ?? 0)

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    (titled_increased || committee_increased || title_density_increased) &&
    compliance.evidence_backed_only &&
    compliance.no_threshold_lowering &&
    expansion.metrics.persons_enriched > 0
  ) {
    certification = "PASS"
  } else if (
    expansion.metrics.titles_discovered > 0 ||
    expansion.metrics.persons_enriched > 0 ||
    expansion.metrics.website_contacts_with_titles > 0
  ) {
    certification = "PASS_PARTIAL"
  } else if (expansion.metrics.companies_processed > 0) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers = [
    ...(!titled_increased ? ["titled_persons_not_increased"] : []),
    ...(!committee_increased ? ["committee_members_not_increased"] : []),
    ...(!title_density_increased ? ["title_density_not_increased"] : []),
    ...(expansion.after.outreach_ready_companies <= expansion.before.outreach_ready_companies
      ? ["outreach_ready_companies_unchanged"]
      : []),
    ...(expansion.metrics.persons_enriched === 0 ? ["no_persons_enriched_with_titles"] : []),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_CERT_7_PS_HW_QA_MARKER,
        certification,
        compliance,
        cohort_size: cohort.length,
        persons_enriched_with_titles: expansion.metrics.persons_enriched,
        titles_discovered: expansion.metrics.titles_discovered,
        committee_members_promoted: expansion.metrics.committee_members_promoted,
        titled_persons: {
          before: expansion.before.titled_persons,
          after: expansion.after.titled_persons,
          delta: expansion.after.titled_persons - expansion.before.titled_persons,
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
        critical_roles: {
          before: expansion.before.critical_roles_present,
          after: expansion.after.critical_roles_present,
          delta: expansion.after.critical_roles_present - expansion.before.critical_roles_present,
        },
        outreach_ready_companies: {
          before: expansion.before.outreach_ready_companies,
          after: expansion.after.outreach_ready_companies,
          delta: expansion.after.outreach_ready_companies - expansion.before.outreach_ready_companies,
        },
        title_metrics: {
          titles_total_before: expansion.before.graph_metrics.titles_total,
          titles_total_after: expansion.after.graph_metrics.titles_total,
          website_contacts_with_titles: expansion.metrics.website_contacts_with_titles,
          roles_upserted: expansion.metrics.roles_upserted,
        },
        company_results: expansion.company_results,
        expansion_qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
        remaining_blockers,
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

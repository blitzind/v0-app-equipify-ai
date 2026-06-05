/**
 * Phase 7.PS-HV — Generic contact containment certification.
 * Run: pnpm test:growth-generic-contact-containment-cert-7-ps-hv
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateGenericContactContainmentCertification } from "../lib/growth/human-identity-evidence/generic-contact-containment-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_GENERIC_CONTACT_CONTAINMENT_CERT_7_PS_HV_QA_MARKER =
  "growth-generic-contact-containment-cert-7-ps-hv-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { runGenericContactContainment },
    { loadPersonCommitteeDensityExpansionCohort },
    { runPersonCommitteeDensityExpansion },
    { loadProspectGraphExpansionMetrics, diffProspectGraphExpansionMetrics },
    { GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/human-identity-evidence/generic-contact-containment"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-metrics"),
    import("../lib/growth/human-identity-evidence/generic-contact-containment-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluateGenericContactContainmentCertification()

  const cohort = await loadPersonCommitteeDensityExpansionCohort(admin, {
    include_anchors: true,
    limit: 20,
  })
  const companyIds = cohort.map((c) => c.canonical_company_id)

  const industry_before = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const containment = await runGenericContactContainment(admin, {
    company_ids: companyIds,
    mode: "apply",
    limit: 250,
  })

  const industry_after_containment = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const hu_rerun = await runPersonCommitteeDensityExpansion(admin, {
    cohort,
    run_channel_jobs: false,
  })

  const industry_after_hu = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const industry_delta = diffProspectGraphExpansionMetrics(
    industry_before.metrics,
    industry_after_hu.metrics,
  )

  const density_not_degraded =
    industry_after_hu.metrics.named_person_density_pct >=
      industry_before.metrics.named_person_density_pct ||
    hu_rerun.cohort_metrics.after.named_person_density_pct >=
      hu_rerun.cohort_metrics.before.named_person_density_pct

  const channels_preserved = containment.metrics.company_channels_preserved > 0
  const shells_reduced =
    containment.metrics.generic_shells_after <= containment.metrics.generic_shells_before

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    shells_reduced &&
    channels_preserved &&
    density_not_degraded &&
    compliance.evidence_preserved &&
    compliance.no_threshold_lowering
  ) {
    certification = "PASS"
  } else if (containment.metrics.contacts_unlinked > 0 && channels_preserved) {
    certification = "PASS_PARTIAL"
  } else if (containment.metrics.generic_shells_before === 0) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers = [
    ...(!shells_reduced ? ["generic_shells_not_reduced"] : []),
    ...(!channels_preserved ? ["company_channels_not_preserved"] : []),
    ...(!density_not_degraded ? ["named_person_density_degraded"] : []),
    ...(industry_after_hu.metrics.committee_members_verified === 0
      ? ["committee_density_still_zero"]
      : []),
    ...(hu_rerun.outreach_ready_companies.delta <= 0
      ? ["outreach_ready_companies_unchanged"]
      : []),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_CERT_7_PS_HV_QA_MARKER,
        certification,
        compliance,
        containment: {
          qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
          ok: containment.ok,
          metrics: containment.metrics,
          samples: containment.samples.slice(0, 10),
          messages: containment.messages,
        },
        generic_person_shells: {
          before: containment.metrics.generic_shells_before,
          after: containment.metrics.generic_shells_after,
          delta: containment.metrics.generic_shells_after - containment.metrics.generic_shells_before,
        },
        company_channels_preserved: containment.metrics.company_channels_preserved,
        person_count_correction: {
          before: containment.metrics.persons_total_before,
          after_containment: containment.metrics.persons_total_after,
          after_hu_rerun: industry_after_hu.metrics.persons_total,
          delta:
            industry_after_hu.metrics.persons_total - containment.metrics.persons_total_before,
        },
        named_person_density: {
          industry_before: industry_before.metrics.named_person_density_pct,
          after_containment: industry_after_containment.metrics.named_person_density_pct,
          after_hu_rerun: industry_after_hu.metrics.named_person_density_pct,
          cohort_before: hu_rerun.cohort_metrics.before.named_person_density_pct,
          cohort_after: hu_rerun.cohort_metrics.after.named_person_density_pct,
          industry_delta: industry_delta.named_person_density_pct ?? 0,
        },
        channel_contacts: {
          role_channel_contacts: industry_after_hu.metrics.role_channel_contacts_total,
          company_channel_contacts: industry_after_hu.metrics.company_channel_contacts_total,
          generic_placeholder_contacts: industry_after_hu.metrics.generic_placeholder_contacts_total,
        },
        committee_density: {
          before: industry_before.metrics.committee_density_pct,
          after: industry_after_hu.metrics.committee_density_pct,
          verified_members: industry_after_hu.metrics.committee_members_verified,
        },
        outreach_ready_companies: hu_rerun.outreach_ready_companies,
        hu_rerun_summary: {
          companies_processed: hu_rerun.metrics.companies_processed,
          named_persons_promoted: hu_rerun.metrics.named_persons_promoted,
          committee_members_promoted: hu_rerun.metrics.committee_members_promoted,
        },
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

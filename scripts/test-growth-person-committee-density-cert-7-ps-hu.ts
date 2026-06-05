/**
 * Phase 7.PS-HU — Person & committee density expansion certification.
 * Run: pnpm test:growth-person-committee-density-cert-7-ps-hu
 */
import { createClient } from "@supabase/supabase-js"
import { evaluatePersonCommitteeDensityExpansionCertification } from "../lib/growth/graph-expansion/person-committee-density-expansion-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_PERSON_COMMITTEE_DENSITY_CERT_7_PS_HU_QA_MARKER =
  "growth-person-committee-density-cert-7-ps-hu-v1" as const

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const [
    { loadPersonCommitteeDensityExpansionCohort, runPersonCommitteeDensityExpansion },
    { loadProspectGraphExpansionMetrics, diffProspectGraphExpansionMetrics },
    { GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_QA_MARKER },
  ] = await Promise.all([
    import("../lib/growth/graph-expansion/person-committee-density-expansion"),
    import("../lib/growth/graph-expansion/prospect-graph-expansion-metrics"),
    import("../lib/growth/graph-expansion/person-committee-density-expansion-types"),
  ])

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const compliance = evaluatePersonCommitteeDensityExpansionCertification()

  const cohort = await loadPersonCommitteeDensityExpansionCohort(admin, {
    include_anchors: true,
    limit: 20,
  })

  const companyIds = cohort.map((c) => c.canonical_company_id)

  const industry_before = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const expansion = await runPersonCommitteeDensityExpansion(admin, {
    cohort,
    run_channel_jobs: true,
  })

  const industry_after = await loadProspectGraphExpansionMetrics(admin, {
    industry_contains: "biomedical",
    limit: 500,
  })

  const industry_delta = diffProspectGraphExpansionMetrics(
    industry_before.metrics,
    industry_after.metrics,
  )

  const named_density_increased =
    expansion.cohort_metrics.after.named_person_density_pct >
      expansion.cohort_metrics.before.named_person_density_pct ||
    (industry_after.metrics.named_person_density_pct ?? 0) >
      (industry_before.metrics.named_person_density_pct ?? 0)

  const committee_density_increased =
    expansion.cohort_metrics.after.committee_density_pct >
      expansion.cohort_metrics.before.committee_density_pct ||
    (industry_after.metrics.committee_density_pct ?? 0) >
      (industry_before.metrics.committee_density_pct ?? 0)

  const density_increased = named_density_increased || committee_density_increased

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    density_increased &&
    compliance.evidence_backed_only &&
    compliance.no_threshold_lowering &&
    (expansion.metrics.named_persons_promoted > 0 || expansion.metrics.committee_members_promoted > 0)
  ) {
    certification = "PASS"
  } else if (
    expansion.metrics.named_persons_promoted > 0 ||
    expansion.metrics.committee_members_promoted > 0 ||
    expansion.metrics.companies_with_evidence > 0
  ) {
    certification = "PASS_PARTIAL"
  } else if (expansion.metrics.companies_processed > 0) {
    certification = "PASS_PARTIAL"
  }

  const remaining_blockers = [
    ...(!density_increased ? ["person_or_committee_density_not_increased"] : []),
    ...(expansion.metrics.named_persons_promoted === 0 ? ["no_named_persons_promoted"] : []),
    ...(expansion.metrics.committee_members_promoted === 0
      ? ["no_committee_members_promoted"]
      : []),
    ...(expansion.outreach_ready_companies.delta <= 0
      ? ["outreach_ready_companies_unchanged"]
      : []),
    ...(process.env.GROWTH_RESEARCH_WEBSITE_ENABLED !== "true"
      ? ["website_research_disabled"]
      : []),
    ...(cohort.filter((c) => c.cohort_kind === "ps_ht_new").length === 0
      ? ["ps_ht_new_cohort_empty"]
      : []),
  ]

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PERSON_COMMITTEE_DENSITY_CERT_7_PS_HU_QA_MARKER,
        certification,
        compliance,
        cohort: {
          total: cohort.length,
          ps_ht_new: cohort.filter((c) => c.cohort_kind === "ps_ht_new").length,
          ps_he_anchors: cohort.filter((c) => c.cohort_kind === "ps_he_anchor").length,
          companies: cohort.map((c) => ({
            company_name: c.company_name,
            canonical_company_id: c.canonical_company_id,
            cohort_kind: c.cohort_kind,
          })),
        },
        companies_processed: expansion.metrics.companies_processed,
        named_persons: {
          discovered: expansion.metrics.named_persons_discovered,
          promoted: expansion.metrics.named_persons_promoted,
        },
        titles: {
          discovered: expansion.metrics.titles_discovered,
          promoted: expansion.metrics.titles_promoted,
        },
        channels: {
          emails_discovered: expansion.metrics.emails_discovered,
          phones_discovered: expansion.metrics.phones_discovered,
          social_profiles_discovered: expansion.metrics.social_profiles_discovered,
          channel_jobs_enqueued: expansion.metrics.channel_jobs_enqueued,
        },
        committee_members_promoted: expansion.metrics.committee_members_promoted,
        named_person_density: {
          cohort_before: expansion.cohort_metrics.before.named_person_density_pct,
          cohort_after: expansion.cohort_metrics.after.named_person_density_pct,
          industry_before: industry_before.metrics.named_person_density_pct,
          industry_after: industry_after.metrics.named_person_density_pct,
          industry_delta: industry_delta.named_person_density_pct ?? 0,
        },
        committee_density: {
          cohort_before: expansion.cohort_metrics.before.committee_density_pct,
          cohort_after: expansion.cohort_metrics.after.committee_density_pct,
          industry_before: industry_before.metrics.committee_density_pct,
          industry_after: industry_after.metrics.committee_density_pct,
          industry_delta: industry_delta.committee_density_pct ?? 0,
        },
        outreach_ready_companies: expansion.outreach_ready_companies,
        company_results: expansion.company_results.map((row) => ({
          company_name: row.company_name,
          cohort_kind: row.cohort_kind,
          ok: row.ok,
          before: {
            named_persons: row.before.named_persons,
            titled_persons: row.before.titled_persons,
            committee_members_verified: row.before.committee_members_verified,
            outreach_ready: row.before.outreach_ready,
          },
          after: {
            named_persons: row.after.named_persons,
            titled_persons: row.after.titled_persons,
            committee_members_verified: row.after.committee_members_verified,
            outreach_ready: row.after.outreach_ready,
          },
          acquisition: row.acquisition,
          committee: row.committee,
          source_types_observed: row.source_types_observed,
        })),
        expansion_qa_marker: GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_QA_MARKER,
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

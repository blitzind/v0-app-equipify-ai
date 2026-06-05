/**
 * Phase 7.PS-HM-LINK — Canonical company staging linkage certification.
 * Run: pnpm test:growth-canonical-company-staging-linkage-cert-7-ps-hm-link
 */
import { createClient } from "@supabase/supabase-js"
import {
  backfillStagingCanonicalCompanyLinkage,
  countUnlinkedStagingCompanyCandidates,
  GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER,
  resolveStagingCanonicalCompanyId,
} from "../lib/growth/canonical-companies/canonical-company-staging-linkage"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

const PS_HE_TARGETS = [
  {
    company_candidate_id: "94bea025-d2df-4a13-ba6c-ec1476b6d050",
    canonical_company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    company_name: "Emergency Repair Biomedical",
    query: "biomedical equipment service companies",
  },
  {
    company_candidate_id: "5ee5a006-6eb8-4890-8775-21d22af4af6e",
    canonical_company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
    company_name: "Biomedical Repair Service",
    query: "medical equipment repair companies",
  },
  {
    company_candidate_id: "5a9a8ba4-1f8b-4ec6-9ebf-5607bbadf1ec",
    canonical_company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    company_name: "ERS Biomedical Services",
    query: "biomedical equipment service companies",
  },
] as const

function shellWithoutWebsite(
  target: (typeof PS_HE_TARGETS)[number],
): GrowthProspectSearchCompanyResult {
  return {
    id: target.company_candidate_id,
    source_type: "external_discovered",
    company_name: target.company_name,
    website: null,
    domain: null,
    canonical_company_id: null,
    growth_lead_id: null,
    is_suppressed: false,
    signals: [],
    match_reasoning: [],
    keywords: [],
    territory_match_reasons: [],
    score_explanation_items: [],
    confidence_explanation_items: [],
    contact_intelligence: null,
    reachable_human: null,
  } as GrowthProspectSearchCompanyResult
}

async function countVerifiedPhones(admin: ReturnType<typeof createClient>, person_id: string) {
  const { count } = await admin
    .schema("growth")
    .from("person_phones")
    .select("id", { count: "exact", head: true })
    .eq("person_id", person_id)
    .eq("verification_status", "verified")
  return count ?? 0
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const before_unlinked = await countUnlinkedStagingCompanyCandidates(admin)
  const before_linkage = []
  for (const target of PS_HE_TARGETS) {
    const { data } = await admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("canonical_company_id")
      .eq("id", target.company_candidate_id)
      .maybeSingle()
    before_linkage.push({
      company_candidate_id: target.company_candidate_id,
      canonical_company_id: data?.canonical_company_id ?? null,
    })
  }

  const backfill = await backfillStagingCanonicalCompanyLinkage(admin, {
    company_candidate_ids: PS_HE_TARGETS.map((t) => t.company_candidate_id),
    mode: "apply",
  })

  const after_unlinked = await countUnlinkedStagingCompanyCandidates(admin)

  const { refreshProspectSearchCompanyAfterHumanAcquisition } = await import(
    "../lib/growth/prospect-search/prospect-search-human-acquisition-hydration"
  )
  const { resolveProspectSearchReachableHumanScore } = await import(
    "../lib/growth/prospect-search/prospect-search-reachable-human-scoring"
  )

  const hydration_results = []
  let pass_count = 0

  for (const target of PS_HE_TARGETS) {
    const hydrated = await refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: shellWithoutWebsite(target),
      query: target.query,
    })

    const coverage = hydrated.contact_intelligence?.engine_coverage?.company
    const engine = hydrated.contact_intelligence?.engine_intelligence
    const reachable = resolveProspectSearchReachableHumanScore(hydrated)
    const verified_phones = await countVerifiedPhones(admin, target.person_id)

    const pass =
      coverage?.resolved === true &&
      coverage?.method === "staging_candidate_id" &&
      coverage?.canonical_company_id === target.canonical_company_id &&
      (engine?.verified_channels?.persons_with_verified_phone ?? 0) > 0 &&
      verified_phones > 0

    if (pass) pass_count += 1

    hydration_results.push({
      company: target.company_name,
      coverage_method: coverage?.method ?? null,
      coverage_resolved: coverage?.resolved ?? false,
      canonical_company_id: coverage?.canonical_company_id ?? null,
      engine_verified_phones: engine?.verified_channels?.persons_with_verified_phone ?? 0,
      db_verified_phones: verified_phones,
      reachable_label: reachable.label,
      pass,
    })
  }

  const certification =
    pass_count === PS_HE_TARGETS.length && backfill.linked === PS_HE_TARGETS.length
      ? "PASS"
      : pass_count > 0
        ? "PASS_PARTIAL"
        : "FAIL"

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER,
        certification,
        pass_count,
        target_count: PS_HE_TARGETS.length,
        before: {
          unlinked_real_world_candidates: before_unlinked,
          ps_he_linkage: before_linkage,
        },
        backfill,
        after: {
          unlinked_real_world_candidates: after_unlinked,
        },
        hydration_without_domain_fallback: hydration_results,
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

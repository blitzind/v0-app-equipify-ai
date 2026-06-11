/**
 * Apollo Scale-3 domain alias search + certification historical revalidation tests.
 * Run: pnpm test:apollo-scale-3-domain-alias-historical-revalidation
 */
import assert from "node:assert/strict"
import {
  assessApolloScale3SearchStrategyResult,
  buildApolloScale3CertificationAssessment,
  isApolloScale3CurrentRunSequenceReadyCompany,
} from "../lib/growth/apollo/apollo-scale-3-certification-assessment"
import {
  isApolloHistoricalRevalidationCandidate,
  readApolloHistoricalRevalidationPersonIds,
  resolveApolloScale3CertificationMode,
} from "../lib/growth/apollo/apollo-certification-historical-revalidation-evidence"
import {
  resolveApolloCurrentRunAttribution,
  resolveApolloCandidateIdsAttributedThisRun,
} from "../lib/growth/apollo/apollo-current-run-attribution"
import {
  buildApolloSearchDomainAliasEvidence,
  resolveApolloOrganizationDomainsForSearch,
} from "../lib/growth/apollo/apollo-search-domain-aliases"
import { buildApolloPeopleSearchParamsForTier } from "../lib/growth/providers/apollo/apollo-query-builder"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"
import type { ApolloScale3MappedCompanyEvidenceRow } from "../lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import { emptyApolloCompanyEnrichmentEvidence } from "../lib/growth/apollo/apollo-mapped-contact-enrichment-evidence"
import { emptyApolloPartialIdentityEvidence } from "../lib/growth/apollo/apollo-partial-identity-evidence"

function candidate(input: {
  id: string
  full_name: string
  email?: string | null
  apollo_person_id: string
  apollo_email_status?: string
}): GrowthContactCandidate {
  return {
    id: input.id,
    company_candidate_id: "stat-company",
    provider_type: "future_apollo",
    full_name: input.full_name,
    first_name: input.full_name.split(" ")[0] ?? null,
    last_name: input.full_name.split(" ").slice(1).join(" ") || null,
    job_title: "Owner",
    email: input.email ?? null,
    phone: null,
    linkedin_url: null,
    metadata: {
      apollo_person_id: input.apollo_person_id,
      apollo_email_status: input.apollo_email_status ?? "verified",
      identity_classification: "named_person",
      eligible_for_canonical_person: true,
      eligible_for_committee: true,
    },
    verification_state: "unknown",
    confidence: 0.9,
    source_attribution: [],
    evidence: [],
    dedupe_hash: `hash-${input.id}`,
  } as GrowthContactCandidate
}

function statWinnerRow(
  overrides: Partial<ApolloScale3MappedCompanyEvidenceRow>,
): ApolloScale3MappedCompanyEvidenceRow {
  return {
    company_candidate_id: "stat",
    company_name: "Stat Biomedical Technicians, Inc.",
    domain: "statbiomedical.com",
    search_attempted: true,
    contacts_found: 0,
    contacts_enriched: 0,
    contacts_promoted: 4,
    contactable_contacts: 2,
    sequence_ready_contacts: 2,
    blockers: [],
    error: null,
    failed: false,
    tier_used: 5,
    raw_contacts_returned: 0,
    mapped_contacts: 0,
    mapping_rejections: 0,
    rejection_reasons: {},
    mapper_rejection_evidence: null,
    tier_attempts: [],
    tier_attempts_compact: [],
    contactable: 2,
    sequence_ready: 2,
    current_run_apollo_verified_email_contacts: 2,
    current_run_apollo_promoted_contacts: 4,
    current_run_apollo_contactable_contacts: 2,
    current_run_apollo_sequence_ready_contacts: 2,
    certification_fail_reasons: [],
    fresh_search_contacts_found: 0,
    historical_revalidated_contacts_found: 2,
    current_run_attribution_source: "historical_revalidated",
    domain_aliases_used: ["stat-biomed.com"],
    domain_alias_evidence: buildApolloSearchDomainAliasEvidence({
      primary_domain: "statbiomedical.com",
      email_domains: ["stat-biomed.com", "statbiomedical.com", "shannon@stat-biomed.com"],
    }),
    partial_identity_evidence: emptyApolloPartialIdentityEvidence(),
    cohort_search_debug: null,
    legacy_fallback_used: false,
    enrichment_evidence: emptyApolloCompanyEnrichmentEvidence(),
    promotion_evidence: {
      apollo_search_attempted: true,
      apollo_search_skipped_reason: null,
      enrichment_attempted: false,
      enrichment_skipped_reason: "no_candidates_need_email_enrichment",
      verified_status_without_email_selected: 0,
      email_enrichment_candidates_selected: 0,
      email_enrichment_candidates_updated: 0,
      email_enrichment_error: null,
      email_enrichment_error_stage: null,
      verified_email_contacts: 2,
      company_contacts_promoted: 4,
      contactable_after_promotion: 2,
      sequence_ready_after_promotion: 2,
      current_run_apollo_verified_email_contacts: 2,
      current_run_apollo_promoted_contacts: 4,
      current_run_apollo_contactable_contacts: 2,
      current_run_apollo_sequence_ready_contacts: 2,
      historical_apollo_verified_email_contacts: 0,
      legacy_contactable_contacts: 0,
      search_verified_email_contacts: 2,
      enrichment_verified_email_contacts: 0,
      promotion_attempted: true,
      promotion_blockers_by_candidate: [],
      contactability_blockers_by_candidate: [],
      sequence_readiness_blockers_by_candidate: [],
    },
    acquisition_evidence: null,
    ...overrides,
  }
}

function testStatDomainAliasesIncludeBothDomains(): void {
  const evidence = buildApolloSearchDomainAliasEvidence({
    primary_domain: "statbiomedical.com",
    email_domains: ["shannon@stat-biomed.com", "bryan@statbiomedical.com"],
  })

  assert.equal(evidence.primary_domain, "statbiomedical.com")
  assert.deepEqual(evidence.alias_domains, ["stat-biomed.com"])
  assert.ok(evidence.domains_attempted.includes("statbiomedical.com"))
  assert.ok(evidence.domains_attempted.includes("stat-biomed.com"))

  const organization_domains = resolveApolloOrganizationDomainsForSearch(evidence)
  const tierA = buildApolloPeopleSearchParamsForTier(
    {
      company_name: "Stat Biomedical Technicians, Inc.",
      domain: "statbiomedical.com",
      organization_domains,
      limit: 10,
    },
    1,
  )

  assert.ok(tierA.request_payload.q_organization_domains_list?.includes("statbiomedical.com"))
  assert.ok(tierA.request_payload.q_organization_domains_list?.includes("stat-biomed.com"))
}

function testHistoricalRevalidationCandidateFilter(): void {
  const verified = candidate({
    id: "shannon",
    full_name: "Shannon Moore",
    email: "shannon@stat-biomed.com",
    apollo_person_id: "apollo-shannon",
  })
  const unverified = candidate({
    id: "luke",
    full_name: "Luke Watson",
    email: null,
    apollo_person_id: "apollo-luke",
    apollo_email_status: "unavailable",
  })

  assert.equal(isApolloHistoricalRevalidationCandidate(verified), true)
  assert.equal(isApolloHistoricalRevalidationCandidate(unverified), false)

  const personIds = readApolloHistoricalRevalidationPersonIds([
    {
      contact_candidate_id: "shannon",
      full_name: "Shannon Moore",
      apollo_person_id: "apollo-shannon",
      email: "shannon@stat-biomed.com",
      attribution_source: "historical_revalidated_apollo_candidate",
    },
  ])
  assert.deepEqual(personIds, ["apollo-shannon"])
}

function testCertificationWinnersPassWithHistoricalRevalidationOnly(): void {
  const row = statWinnerRow({})
  assert.equal(
    isApolloScale3CurrentRunSequenceReadyCompany(row, "certification_winners_revalidation"),
    true,
  )

  const assessment = buildApolloScale3CertificationAssessment({
    mock: false,
    certification_mode: "certification_winners_revalidation",
    companies: [row],
  })

  assert.equal(assessment.result, "PASS")
  assert.equal(assessment.aggregate_current_run.fresh_search_contacts_found, 0)
  assert.equal(assessment.aggregate_current_run.historical_revalidated_contacts_found, 2)
  assert.deepEqual(row.current_run_attribution_source, "historical_revalidated")
}

function testGreenfieldCannotPassFromHistoricalRevalidationOnly(): void {
  const row = statWinnerRow({})
  assert.equal(isApolloScale3CurrentRunSequenceReadyCompany(row, "greenfield"), false)
  assert.equal(
    assessApolloScale3SearchStrategyResult({
      mock: false,
      certification_mode: "greenfield",
      companies: [row],
    }),
    "FAIL",
  )
}

function testCurrentRunAttributionMixedFreshAndHistorical(): void {
  const candidates = [
    candidate({
      id: "shannon",
      full_name: "Shannon Moore",
      email: "shannon@stat-biomed.com",
      apollo_person_id: "apollo-shannon",
    }),
    candidate({
      id: "bryan",
      full_name: "Bryan Ginther",
      email: "bryan@statbiomedical.com",
      apollo_person_id: "apollo-bryan",
    }),
  ]

  const attribution = resolveApolloCurrentRunAttribution({
    apollo_mapped_this_run: 1,
    apollo_persisted_this_run: 0,
    apollo_candidate_ids_before: new Set(["shannon", "bryan"]),
    apollo_candidates_after: candidates,
    apollo_person_ids_mapped_this_run: ["apollo-fresh"],
    apollo_person_ids_historical_revalidated_this_run: ["apollo-shannon", "apollo-bryan"],
    domain_alias_evidence: buildApolloSearchDomainAliasEvidence({
      primary_domain: "statbiomedical.com",
      email_domains: ["stat-biomed.com", "statbiomedical.com"],
    }),
    verified_email_promotion: null,
    existing_contactable_before: 0,
    company_contacts: candidates.map((c) => ({
      contact_candidate_id: c.id,
      email: c.email,
      email_status: "verified",
      phone: null,
      phone_status: null,
      canonical_person_id: `person-${c.id}`,
    })),
    promotion_attempted: true,
  })

  assert.equal(attribution.fresh_search_contacts_found, 1)
  assert.equal(attribution.historical_revalidated_contacts_found, 2)
  assert.equal(attribution.current_run_attribution_source, "mixed")
  assert.deepEqual(attribution.domain_aliases_used, ["stat-biomed.com"])

  const attributed = resolveApolloCandidateIdsAttributedThisRun({
    before: new Set(["shannon", "bryan"]),
    apollo_candidates: candidates,
    apollo_person_ids_mapped_this_run: ["apollo-fresh"],
    apollo_person_ids_historical_revalidated_this_run: ["apollo-shannon", "apollo-bryan"],
  })
  assert.ok(attributed.includes("shannon"))
  assert.ok(attributed.includes("bryan"))
}

function testCertificationModeResolution(): void {
  assert.equal(
    resolveApolloScale3CertificationMode({ cohort_preset: "certification_winners" }),
    "certification_winners_revalidation",
  )
  assert.equal(resolveApolloScale3CertificationMode({ cohort_preset: null }), "greenfield")
  assert.equal(
    resolveApolloScale3CertificationMode({ certification_mode: "greenfield" }),
    "greenfield",
  )
}

function testAliasDerivedVerifiedEmailAttribution(): void {
  const shannon = candidate({
    id: "shannon",
    full_name: "Shannon Moore",
    email: "shannon@stat-biomed.com",
    apollo_person_id: "apollo-shannon",
  })

  const attribution = resolveApolloCurrentRunAttribution({
    apollo_mapped_this_run: 0,
    apollo_persisted_this_run: 0,
    apollo_candidate_ids_before: new Set(["shannon"]),
    apollo_candidates_after: [shannon],
    apollo_person_ids_mapped_this_run: [],
    apollo_person_ids_historical_revalidated_this_run: ["apollo-shannon"],
    domain_alias_evidence: buildApolloSearchDomainAliasEvidence({
      primary_domain: "statbiomedical.com",
      email_domains: ["shannon@stat-biomed.com"],
    }),
    verified_email_promotion: null,
    existing_contactable_before: 0,
    company_contacts: [
      {
        contact_candidate_id: "shannon",
        full_name: "Shannon Moore",
        title: "President/Owner",
        email: "shannon@stat-biomed.com",
        email_status: "verified",
        phone: null,
        phone_status: null,
        canonical_person_id: "person-shannon",
        metadata: {
          identity_classification: "named_person",
          eligible_for_canonical_person: true,
          eligible_for_committee: true,
        },
      },
    ],
    promotion_attempted: true,
  })

  assert.equal(attribution.current_run_apollo_verified_email_contacts, 1)
  assert.equal(attribution.current_run_apollo_sequence_ready_contacts, 1)
  assert.equal(attribution.current_run_attribution_source, "historical_revalidated")
}

async function main(): Promise<void> {
  testStatDomainAliasesIncludeBothDomains()
  console.log("  ✓ Stat tier A payload includes statbiomedical.com and stat-biomed.com")

  testHistoricalRevalidationCandidateFilter()
  console.log("  ✓ historical revalidation requires Apollo person id + verified email")

  testCertificationWinnersPassWithHistoricalRevalidationOnly()
  console.log("  ✓ certification_winners can PASS from historical revalidation when fresh search is zero")

  testGreenfieldCannotPassFromHistoricalRevalidationOnly()
  console.log("  ✓ greenfield cannot PASS from historical revalidation only")

  testCurrentRunAttributionMixedFreshAndHistorical()
  console.log("  ✓ payload reports fresh vs revalidated vs mixed yield")

  testCertificationModeResolution()
  console.log("  ✓ certification modes stay separated by cohort preset")

  testAliasDerivedVerifiedEmailAttribution()
  console.log("  ✓ alias-derived verified email can be attributed safely")

  console.log("\nAll Apollo Scale-3 domain alias + historical revalidation tests passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

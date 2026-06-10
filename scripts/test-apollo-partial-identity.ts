/**
 * Apollo partial-identity staging — Leonard B / strong org path.
 * Run: pnpm test:apollo-partial-identity
 */
import assert from "node:assert/strict"
import { assessApolloScale3SearchStrategyResult } from "../lib/growth/apollo/apollo-scale-3-certification-assessment"
import { mapApolloScale3CompanyEvidenceRow } from "../lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import { isSequenceReadyCompanyContact } from "../lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import { emptyApolloPartialIdentityEvidence } from "../lib/growth/apollo/apollo-partial-identity-evidence"
import {
  APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY,
  APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT,
  APOLLO_MATCH_STRENGTH_STRONG_ORG_PARTIAL_PERSON,
  canPromoteApolloPartialIdentityCandidate,
  evaluateApolloPartialIdentityStaging,
  isApolloPartialInitialOnlyName,
  isApolloPartialIdentityMappedContact,
} from "../lib/growth/apollo/apollo-partial-identity"
import {
  apolloCandidateHasVerifiedPromotableChannel,
  evaluateApolloVerifiedEmailPromotionBlocker,
} from "../lib/growth/apollo/apollo-verified-email-promotion-evidence"
import {
  mapApolloPeopleToContactDiscoveryRaw,
  resolveApolloPersonMappingOutcome,
} from "../lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "../lib/growth/providers/apollo/apollo-types"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function pulseLeonardB(): ApolloPersonRecord {
  return {
    id: "pulse-leonard-b",
    first_name: "Leonard",
    last_name: "B",
    name: "Leonard B",
    title: "Account Manager",
    organization: {
      name: "Pulse Biomedical Service",
      primary_domain: "pulsexray.com",
    },
  }
}

function wrongOrgLeonardB(): ApolloPersonRecord {
  return {
    ...pulseLeonardB(),
    id: "wrong-org-leonard-b",
    organization: {
      name: "Other Medical Supply",
      primary_domain: "othermedical.com",
    },
  }
}

function mappingContext() {
  return {
    company_name: "Pulse Biomedical Service",
    domain: "pulsexray.com",
    mock: false,
    search_tier: 4 as const,
    mapping_policy: {
      require_organization_match: true,
      require_location_match: false,
      match_strength: "weak" as const,
      max_mapped_contacts: null,
    },
  }
}

function testLeonardBStagedAsPartialIdentity(): void {
  const person = pulseLeonardB()
  assert.equal(isApolloPartialInitialOnlyName("Leonard B", person), true)

  const outcome = resolveApolloPersonMappingOutcome(person, mappingContext())
  assert.equal(outcome.accepted, true)
  assert.ok(outcome.mapped)
  assert.equal(isApolloPartialIdentityMappedContact(outcome.mapped!), true)
  assert.equal(outcome.mapped?.metadata?.candidate_quality, APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY)
  assert.equal(outcome.mapped?.metadata?.identity_status, APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT)
  assert.equal(
    outcome.mapped?.metadata?.apollo_match_strength,
    APOLLO_MATCH_STRENGTH_STRONG_ORG_PARTIAL_PERSON,
  )
  assert.equal(outcome.mapped?.metadata?.contactable, false)
  assert.equal(outcome.mapped?.metadata?.sequence_ready, false)
}

function testPartialIdentityBatchMappedCount(): void {
  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: [pulseLeonardB()],
    company_name: "Pulse Biomedical Service",
    domain: "pulsexray.com",
    mock: false,
    search_tier: 4,
    mapping_policy: mappingContext().mapping_policy,
  })
  assert.equal(mapped.diagnostics.contacts_mapped, 1)
  assert.equal(mapped.mapped_partial_identity_contacts, 1)
  assert.equal(mapped.mapped_full_identity_contacts, 0)
}

function testPartialIdentityNotSequenceReadyWithoutVerifiedEmail(): void {
  const candidate: GrowthContactCandidate = {
    id: "cand-1",
    created_at: "",
    updated_at: "",
    company_candidate_id: "co-1",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name: "Leonard B",
    first_name: "Leonard",
    last_name: "B",
    job_title: "Account Manager",
    department: null,
    seniority: null,
    linkedin_url: null,
    email: null,
    phone: null,
    verification_state: "unverified",
    confidence: 0.5,
    source_attribution: [],
    evidence: [],
    dedupe_hash: "abc",
    metadata: {
      candidate_quality: APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY,
      identity_status: APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT,
      apollo_match_strength: APOLLO_MATCH_STRENGTH_STRONG_ORG_PARTIAL_PERSON,
      apollo_partial_identity_staged: true,
    },
  }

  assert.equal(canPromoteApolloPartialIdentityCandidate(candidate), false)
  assert.equal(apolloCandidateHasVerifiedPromotableChannel(candidate), false)
  assert.equal(evaluateApolloVerifiedEmailPromotionBlocker(candidate), "partial_identity_unresolved")
  assert.equal(
    isSequenceReadyCompanyContact({
      full_name: candidate.full_name,
      title: candidate.job_title,
      email: null,
      phone: null,
      email_status: "unknown",
      phone_status: "unknown",
      linkedin_url: null,
      canonical_person_id: "person-1",
      metadata: candidate.metadata,
    }),
    false,
  )
}

function testPartialIdentityPromotableWithVerifiedEmail(): void {
  const candidate: GrowthContactCandidate = {
    id: "cand-2",
    created_at: "",
    updated_at: "",
    company_candidate_id: "co-1",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name: "Leonard B",
    first_name: "Leonard",
    last_name: "B",
    job_title: "Account Manager",
    department: null,
    seniority: null,
    linkedin_url: null,
    email: "leonard.b@pulsexray.com",
    phone: null,
    verification_state: "unverified",
    confidence: 0.5,
    source_attribution: [],
    evidence: [],
    dedupe_hash: "def",
    metadata: {
      candidate_quality: APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY,
      identity_status: APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT,
      apollo_match_strength: APOLLO_MATCH_STRENGTH_STRONG_ORG_PARTIAL_PERSON,
      apollo_email_status: "verified",
    },
  }

  assert.equal(canPromoteApolloPartialIdentityCandidate(candidate), true)
  assert.equal(apolloCandidateHasVerifiedPromotableChannel(candidate), true)
  assert.equal(evaluateApolloVerifiedEmailPromotionBlocker(candidate), null)
}

function testOrgMismatchPartialNameStillRejected(): void {
  const outcome = resolveApolloPersonMappingOutcome(wrongOrgLeonardB(), mappingContext())
  assert.equal(outcome.accepted, false)
  assert.equal(outcome.rejection_reason, "organization_mismatch")
}

function testScale3DoesNotPassFromPartialIdentityAlone(): void {
  const row = mapApolloScale3CompanyEvidenceRow({
    base: {
      company_candidate_id: "pulse",
      company_name: "Pulse Biomedical Service",
      domain: "pulsexray.com",
      search_attempted: true,
      contacts_found: 1,
      contacts_enriched: 0,
      contacts_promoted: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: [],
      error: null,
      failed: false,
    },
    acquisition: {
      apollo_search_attempted: true,
      search_strategy: {
        qa_marker: "apollo-tiered-people-search-v2",
        tier_used: 4,
        chosen_tier: 4,
        chosen_tier_name: "D_org_only_fallback",
        last_attempted_tier: 4,
        last_attempted_tier_name: "D_org_only_fallback",
        stop_reason: "mapped_contacts_found",
        tier_attempts: [],
        raw_contacts_returned: 1,
        mapped_contacts: 1,
        mapping_rejections: 0,
        rejection_reasons: {},
        legacy_fallback_used: false,
        legacy_contactable_count: 0,
        mapped_partial_identity_contacts: 1,
        mapped_full_identity_contacts: 0,
      },
      partial_identity_evidence: {
        ...emptyApolloPartialIdentityEvidence(),
        mapped_partial_identity_contacts: 1,
        partial_identity_candidates_staged: 1,
        partial_identity_enrichment_attempted: true,
        partial_identity_blockers: ["partial_identity_needs_enrichment"],
      },
      current_run_attribution: {
        qa_marker: "apollo-current-run-attribution-v1",
        current_run_apollo_mapped_contacts: 1,
        current_run_apollo_persisted_contacts: 1,
        current_run_apollo_verified_email_contacts: 0,
        current_run_apollo_promoted_contacts: 0,
        current_run_apollo_contactable_contacts: 0,
        current_run_apollo_sequence_ready_contacts: 0,
        historical_apollo_verified_email_contacts: 0,
        legacy_contactable_contacts: 0,
        apollo_candidate_ids_this_run: ["cand-pulse"],
        has_current_run_search_yield: true,
      },
    } as never,
  })

  assert.equal(row.mapped_contacts, 1)
  assert.equal(row.partial_identity_evidence.partial_identity_candidates_staged, 1)
  assert.equal(
    assessApolloScale3SearchStrategyResult({ mock: false, companies: [row] }),
    "FAIL",
  )
}

function testPartialStagingEligibilityGuard(): void {
  const person = pulseLeonardB()
  const mapped = {
    full_name: "Leonard B",
    job_title: "Account Manager",
    metadata: {},
  } as never
  const eligible = evaluateApolloPartialIdentityStaging({
    person,
    mapped,
    context: mappingContext(),
    rejection_reason: "name_not_plausible",
  })
  assert.equal(eligible.eligible, true)
}

function main(): void {
  testLeonardBStagedAsPartialIdentity()
  console.log("  ✓ Leonard B with strong org/domain staged as partial_identity")
  testPartialIdentityBatchMappedCount()
  console.log("  ✓ partial identity included in mapped count")
  testPartialIdentityNotSequenceReadyWithoutVerifiedEmail()
  console.log("  ✓ partial identity without verified email is not sequence-ready or promotable")
  testPartialIdentityPromotableWithVerifiedEmail()
  console.log("  ✓ partial identity with verified email can enter promotion pool")
  testOrgMismatchPartialNameStillRejected()
  console.log("  ✓ org mismatch + partial name still rejected")
  testScale3DoesNotPassFromPartialIdentityAlone()
  console.log("  ✓ Scale-3 FAIL when only partial identity staged")
  testPartialStagingEligibilityGuard()
  console.log("  ✓ partial staging eligibility guard accepts name_not_plausible")
  console.log("\nApollo partial-identity checks passed.")
}

main()

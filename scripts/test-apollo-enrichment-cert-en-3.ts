/**
 * Apollo EN-3 enrichment promotion & sequence readiness — no live DB/Apollo HTTP.
 * Run: pnpm test:apollo-enrichment-cert-en-3
 */
import assert from "node:assert/strict"
import {
  buildApolloEnrichmentPromotionBlockers,
  countEnrichedCandidateChannels,
  isSequenceReadyCompanyContact,
  selectApolloCandidatesForPromotion,
  apolloContactDiscoverySourceType,
  APOLLO_ENRICHMENT_CERT_PROMOTION_EVIDENCE_QA_MARKER,
} from "../lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import {
  APOLLO_ENRICHMENT_CERT_CANONICAL_COMPANY_RESOLUTION_EVIDENCE_QA_MARKER,
  emptyApolloEnrichmentCertCanonicalCompanyResolutionEvidence,
  summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure,
} from "../lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"
import { candidateHasObservedContactChannel } from "../lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { normalizeApolloSearchPersonRecord } from "../lib/growth/providers/apollo/apollo-search-person-normalize"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"
import { normalizeContactCandidate } from "../lib/growth/contact-discovery/contact-normalizer"

function buildEnrichedHenryScheinCandidate(
  overrides: Partial<Pick<GrowthContactCandidate, "email" | "phone" | "linkedin_url">> = {},
): GrowthContactCandidate {
  const person = normalizeApolloSearchPersonRecord({
    id: "apollo-enriched-hs-1",
    first_name: "Carrie",
    last_name: "King",
    title: "Executive Vice President, Chief Operating Officer",
    email: "carrie.king@henryschein.com",
    email_status: "verified",
    linkedin_url: "https://www.linkedin.com/in/carrie-king",
    organization: { name: "Henry Schein", primary_domain: "henryschein.com" },
  })
  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: [person],
    company_name: "Henry Schein",
    domain: "henryschein.com",
    mock: false,
  })
  assert.equal(mapped.contacts.length, 1)
  const normalized = normalizeContactCandidate(
    mapped.contacts[0]!,
    "apollo",
    "future_apollo",
    "company-candidate-1",
  )
  assert.ok(normalized)
  return {
    id: "candidate-enriched-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    company_candidate_id: "company-candidate-1",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name: normalized.full_name,
    first_name: normalized.first_name,
    last_name: normalized.last_name,
    job_title: normalized.job_title,
    department: normalized.department,
    seniority: normalized.seniority,
    linkedin_url:
      "linkedin_url" in overrides ? overrides.linkedin_url ?? null : normalized.linkedin_url,
    email: "email" in overrides ? overrides.email ?? null : normalized.email,
    phone: "phone" in overrides ? overrides.phone ?? null : normalized.phone,
    verification_state: normalized.verification_state,
    confidence: normalized.confidence,
    source_attribution: normalized.source_attribution,
    evidence: normalized.evidence,
    dedupe_hash: normalized.dedupe_hash,
    metadata: {
      ...normalized.metadata,
      apollo_enriched_at: "2026-06-01T00:00:00.000Z",
      apollo_email_status: "verified",
    },
  }
}

function buildChannelLessCandidate(): GrowthContactCandidate {
  return buildEnrichedHenryScheinCandidate({
    email: null,
    phone: null,
    linkedin_url: null,
  })
}

function main(): void {
  console.log("Apollo EN-3 enrichment promotion tests\n")

  assert.equal(APOLLO_ENRICHMENT_CERT_PROMOTION_EVIDENCE_QA_MARKER, "apollo-enrichment-cert-promotion-evidence-en-3-v1")
  console.log("  ✓ promotion QA marker")

  const enriched = buildEnrichedHenryScheinCandidate({
    email: "carrie.king@henryschein.com",
    linkedin_url: "https://www.linkedin.com/in/carrie-king",
  })
  assert.equal(candidateHasObservedContactChannel(enriched), true)
  assert.equal(selectApolloCandidatesForPromotion([enriched]).length, 1)
  const channelLess = buildChannelLessCandidate()
  assert.equal(selectApolloCandidatesForPromotion([channelLess]).length, 0)
  console.log("  ✓ enriched candidate with email promotes; channel-less remains candidate-only")

  const counts = countEnrichedCandidateChannels([enriched, channelLess])
  assert.equal(counts.with_email, 1)
  assert.equal(counts.with_channel, 1)
  console.log("  ✓ enriched channel counts")

  assert.equal(apolloContactDiscoverySourceType("future_apollo"), "public_record")
  console.log("  ✓ future_apollo maps to public_record for company_contacts")

  const readyRow = {
    full_name: enriched.full_name,
    title: enriched.job_title,
    email: enriched.email,
    phone: null,
    email_status: "discovered",
    phone_status: "unknown",
    linkedin_url: enriched.linkedin_url,
    canonical_person_id: "person-1",
    metadata: {
      identity_classification: "named_person",
      eligible_for_canonical_person: true,
    },
  }
  assert.equal(isSequenceReadyCompanyContact(readyRow), true)

  const linkedinOnlyNotContactable = {
    ...readyRow,
    email: null,
    phone: null,
    email_status: "unknown",
  }
  assert.equal(isSequenceReadyCompanyContact(linkedinOnlyNotContactable), false)

  const genericPlaceholder = {
    ...readyRow,
    full_name: "Info Desk",
    metadata: {
      identity_classification: "generic_placeholder",
      eligible_for_canonical_person: false,
    },
  }
  assert.equal(isSequenceReadyCompanyContact(genericPlaceholder), false)
  console.log("  ✓ sequence readiness gates — email/phone + canonical person + identity required")

  const blockers = buildApolloEnrichmentPromotionBlockers({
    canonical_company_id: null,
    candidates_with_channel: 5,
    resolution_diagnostics: ["staging_company_candidate_not_found"],
    rejection_reasons: { canonical_company_id_unresolved: 5 },
  })
  assert.ok(blockers.includes("canonical_company_id_unresolved"))
  assert.ok(blockers.some((item) => item.includes("staging_company_candidate_not_found")))
  console.log("  ✓ promotion blockers surfaced when canonical sync fails")

  assert.equal(
    APOLLO_ENRICHMENT_CERT_CANONICAL_COMPANY_RESOLUTION_EVIDENCE_QA_MARKER,
    "apollo-enrichment-cert-canonical-company-resolution-en-3-v1",
  )
  const unresolvedEvidence = emptyApolloEnrichmentCertCanonicalCompanyResolutionEvidence(
    "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
  )
  unresolvedEvidence.staging_table_detected = null
  unresolvedEvidence.candidate_domain_normalized = "henryschein.com"
  unresolvedEvidence.domain_lookup_attempted = true
  unresolvedEvidence.promote_backfill_ran = false
  const summary = summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure(unresolvedEvidence)
  assert.ok(summary.includes("canonical_company_id_unresolved"))
  assert.ok(summary.includes("staging_company_candidate_not_found"))
  assert.ok(summary.includes("henryschein.com"))
  console.log("  ✓ canonical resolution evidence summarizes failure steps")

  console.log("\nAll Apollo EN-3 enrichment promotion checks passed.")
}

main()

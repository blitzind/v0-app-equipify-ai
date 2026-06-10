/**
 * Apollo-Scale-5B — verified email status without address + enrichment contactability.
 * Run: pnpm test:apollo-scale-5b-email-channel
 */
import {
  apolloCandidateNeedsEmailEnrichment,
  buildApolloEmailChannelEvidenceRow,
} from "../lib/growth/apollo/apollo-email-channel-evidence"
import {
  buildApolloCompanyContactPromotionFields,
  buildApolloVerifiedEmailPromotionContactRow,
  evaluateApolloVerifiedEmailPromotionBlocker,
  resolveApolloCandidatePromotedEmail,
} from "../lib/growth/apollo/apollo-verified-email-promotion-evidence"
import { mapApolloPersonToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"
import type { ApolloPersonRecord } from "../lib/growth/providers/apollo/apollo-types"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function verifiedStatusOnlyPerson(full_name: string): ApolloPersonRecord {
  return {
    id: `apollo-${full_name.replace(/\s+/g, "-").toLowerCase()}`,
    name: full_name,
    first_name: full_name.split(" ")[0] ?? null,
    last_name: full_name.split(" ").slice(1).join(" ") || null,
    title: "Owner",
    email: null,
    email_status: "verified",
    linkedin_url: "https://linkedin.com/in/example",
    has_email: true,
    organization: { name: "Medical Equipment Solutions", primary_domain: "medicalequipmentsolutions.com" },
  }
}

function candidateFromMapped(full_name: string, mapped: NonNullable<ReturnType<typeof mapApolloPersonToContactDiscoveryRaw>>): GrowthContactCandidate {
  return {
    id: `candidate-${full_name}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_candidate_id: "mes-company",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name,
    first_name: mapped.first_name,
    last_name: mapped.last_name,
    job_title: mapped.job_title,
    department: mapped.department,
    seniority: mapped.seniority,
    linkedin_url: mapped.linkedin_url,
    email: mapped.email,
    phone: mapped.phone,
    verification_state: "unverified",
    confidence: mapped.confidence,
    source_attribution: [],
    evidence: [],
    dedupe_hash: "hash",
    metadata:
      mapped.metadata && typeof mapped.metadata === "object"
        ? (mapped.metadata as Record<string, unknown>)
        : {},
  }
}

function testSearchReturnsVerifiedStatusWithoutEmail(): void {
  const person = verifiedStatusOnlyPerson("Tanya Powell")
  const mapped = mapApolloPersonToContactDiscoveryRaw(person, {
    company_name: "Medical Equipment Solutions",
    domain: "medicalequipmentsolutions.com",
    mock: false,
  })
  assert(Boolean(mapped), "mapped contact expected")
  assert(mapped!.email === null, "search mapping must not invent email when Apollo omits address")
  assert(
    (mapped!.metadata as Record<string, unknown>).apollo_email_status === "verified",
    "search should preserve verified email_status in metadata",
  )

  const candidate = candidateFromMapped("Tanya Powell", mapped!)
  assert(apolloCandidateNeedsEmailEnrichment(candidate), "verified-status-without-email needs bulk_match")
  assert(
    evaluateApolloVerifiedEmailPromotionBlocker(candidate) === "apollo_verified_status_without_email",
    "verified status alone must not pass verified-email promotion",
  )

  const row = buildApolloVerifiedEmailPromotionContactRow({ candidate })
  assert(row.contactable === false, "verified status without email is not contactable")
  assert(row.sequence_ready === false, "verified status without email is not sequence-ready")

  const evidence = buildApolloEmailChannelEvidenceRow({
    candidate,
    raw_email: null,
    mapped_email: null,
    company_contact: {
      full_name: candidate.full_name,
      email: null,
      email_status: "verified",
      canonical_person_id: "person-id",
    },
  })
  assert(evidence.raw_email_present === false, "raw email absent from Apollo search")
  assert(evidence.mapped_email_present === false, "mapped email absent")
  assert(evidence.candidate_email_present === false, "candidate email absent")
  assert(evidence.verified_status_without_email === true, "verified status without email flagged")
  assert(evidence.email_source === "metadata", "email source is metadata-only status")
  assert(evidence.company_contact_email_present === false, "company_contact email still absent")
}

function testEnrichedEmailBecomesContactable(): void {
  const person = verifiedStatusOnlyPerson("Kimberly Woolsey")
  const mapped = mapApolloPersonToContactDiscoveryRaw(person, {
    company_name: "Medical Equipment Solutions",
    domain: "medicalequipmentsolutions.com",
    mock: false,
  })!
  const candidate = candidateFromMapped("Kimberly Woolsey", mapped)
  const enrichedEmail = "kimberly@medicalequipmentsolutions.com"
  candidate.email = enrichedEmail
  candidate.metadata = {
    ...candidate.metadata,
    apollo_enriched_at: new Date().toISOString(),
    apollo_enriched_email: enrichedEmail,
    apollo_email_enrichment_source: "bulk_match",
  }

  assert(
    resolveApolloCandidatePromotedEmail(candidate) === enrichedEmail,
    "enriched verified email should be promotable",
  )
  assert(!evaluateApolloVerifiedEmailPromotionBlocker(candidate), "enriched candidate should clear blocker")

  const promotionFields = buildApolloCompanyContactPromotionFields({ candidate })
  assert(promotionFields.email === enrichedEmail, "promotion resolver should emit enriched email")
  assert(promotionFields.email_status === "verified", "promotion email_status should be verified")

  const companyContact = {
    full_name: candidate.full_name,
    title: candidate.job_title,
    email: promotionFields.email,
    email_status: promotionFields.email_status,
    phone: null,
    phone_status: "unknown",
    linkedin_url: candidate.linkedin_url,
    canonical_person_id: "person-kimberly",
    metadata: {
      identity_classification: "named_person",
      eligible_for_canonical_person: true,
      eligible_for_committee: true,
    },
  }

  const row = buildApolloVerifiedEmailPromotionContactRow({ candidate, company_contact: companyContact })
  assert(row.contactable === true, "enriched verified email should be contactable")
  assert(row.sequence_ready === true, "enriched verified email should be sequence-ready")

  const evidence = buildApolloEmailChannelEvidenceRow({
    candidate,
    mapped_email: null,
    company_contact: companyContact,
    canonical_person_email: enrichedEmail,
  })
  assert(evidence.enriched_email_present === true, "enriched email present in evidence")
  assert(evidence.candidate_email_present === true, "candidate email present after enrichment")
  assert(evidence.company_contact_email_present === true, "company_contact email present after promotion")
  assert(evidence.email_source === "enrichment", "email source should be enrichment")
}

function main(): void {
  testSearchReturnsVerifiedStatusWithoutEmail()
  console.log("  ✓ verified email_status without address is not contactable")
  testEnrichedEmailBecomesContactable()
  console.log("  ✓ bulk_match enriched email becomes contactable and sequence-ready")
  console.log("\nApollo-Scale-5B email channel checks passed.")
}

main()

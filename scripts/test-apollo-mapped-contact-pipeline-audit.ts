/**
 * Apollo mapped contact pipeline audit structure checks.
 * Run: pnpm test:apollo-mapped-contact-pipeline-audit
 */
import {
  buildApolloMappedContactPipelineAuditRow,
  buildApolloMappedContactPipelineBlockerFrequency,
} from "../lib/growth/apollo/apollo-mapped-contact-pipeline-audit"
import type { ApolloPersonRecord } from "../lib/growth/providers/apollo/apollo-types"
import type { GrowthContactDiscoveryProviderRawContact } from "../lib/growth/contact-discovery/contact-discovery-provider-types"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function mappedContact(
  overrides: Partial<GrowthContactDiscoveryProviderRawContact> = {},
): GrowthContactDiscoveryProviderRawContact {
  return {
    full_name: "John Smith",
    first_name: "John",
    last_name: "Smith",
    job_title: "Owner",
    department: null,
    seniority: null,
    linkedin_url: null,
    email: null,
    phone: null,
    pii_observed: false,
    confidence: 0.58,
    external_provider_contact_id: "apollo-person-1",
    evidence: [],
    source_attribution: [],
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "unavailable" },
    ...overrides,
  }
}

function person(overrides: Partial<ApolloPersonRecord> = {}): ApolloPersonRecord {
  return {
    id: "apollo-person-1",
    name: "John Smith",
    title: "Owner",
    organization: {
      name: "Medical Equipment Solutions",
      primary_domain: "medicalequipmentsolutions.com",
    },
    email_status: "unavailable",
    has_email: false,
    ...overrides,
  }
}

function testNoEmailBlocksPromotion(): void {
  const row = buildApolloMappedContactPipelineAuditRow({
    person: person(),
    contact: mappedContact(),
    target_company_name: "Medical Equipment Solutions",
    target_domain: "medicalequipmentsolutions.com",
    enrichment_enabled: true,
  })

  const enrichment = row.stages.find((stage) => stage.stage === "enrichment_eligibility")
  const promotion = row.stages.find((stage) => stage.stage === "promotion_eligibility")
  assert(enrichment?.result === "FAIL", "expected enrichment FAIL")
  assert(enrichment?.blocker === "no_email_available", "expected no_email_available")
  assert(promotion?.result === "FAIL", "expected promotion FAIL")
  assert(promotion?.blocker === "missing_contact_channel", "expected missing_contact_channel")
}

function testDomainMismatch(): void {
  const row = buildApolloMappedContactPipelineAuditRow({
    person: person({
      organization: { name: "Other Medical LLC", primary_domain: "othermedical.com" },
    }),
    contact: mappedContact({ email: "john@othermedical.com", pii_observed: true }),
    target_company_name: "Medical Equipment Solutions",
    target_domain: "medicalequipmentsolutions.com",
    enrichment_enabled: true,
  })
  const companyMatch = row.stages.find((stage) => stage.stage === "company_match_validation")
  assert(companyMatch?.result === "FAIL", "expected company match FAIL")
  assert(companyMatch?.blocker === "normalized_domain_mismatch", "expected domain mismatch")
}

function testBlockerFrequency(): void {
  const rows = [
    buildApolloMappedContactPipelineAuditRow({
      person: person(),
      contact: mappedContact(),
      target_company_name: "Medical Equipment Solutions",
      target_domain: "medicalequipmentsolutions.com",
    }),
    buildApolloMappedContactPipelineAuditRow({
      person: person({ id: "apollo-person-2" }),
      contact: mappedContact({
        full_name: "Jane Doe",
        external_provider_contact_id: "apollo-person-2",
        metadata: { apollo_person_id: "apollo-person-2" },
      }),
      target_company_name: "Medical Equipment Solutions",
      target_domain: "medicalequipmentsolutions.com",
    }),
  ]
  const frequency = buildApolloMappedContactPipelineBlockerFrequency(rows)
  assert((frequency.blocker_frequency.no_email_available ?? 0) >= 2, "expected repeated blockers")
}

function main(): void {
  testNoEmailBlocksPromotion()
  console.log("  ✓ no_email_available blocks enrichment and promotion")
  testDomainMismatch()
  console.log("  ✓ normalized_domain_mismatch on company match")
  testBlockerFrequency()
  console.log("  ✓ blocker frequency table")
  console.log("\nApollo mapped contact pipeline audit checks passed.")
}

main()

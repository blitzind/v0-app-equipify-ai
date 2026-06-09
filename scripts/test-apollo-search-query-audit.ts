/**
 * Apollo search query audit — classification and mapping structure checks.
 * Run: pnpm test:apollo-search-query-audit
 */
import {
  APOLLO_SEARCH_QUERY_AUDIT_QA_MARKER,
  buildApolloSearchQueryAuditTierEvidence,
  classifyApolloSearchQueryAudit,
  redactApolloPersonForAuditSample,
} from "../lib/growth/apollo/apollo-search-query-audit"
import type { ApolloPersonRecord } from "../lib/growth/providers/apollo/apollo-types"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function person(overrides: Partial<ApolloPersonRecord> = {}): ApolloPersonRecord {
  return {
    id: "person-1",
    first_name: "Jane",
    last_name: "Owner",
    name: "Jane Owner",
    title: "Owner",
    email_status: "verified",
    email: "jane@example.com",
    organization: {
      name: "Medical Equipment Solutions",
      primary_domain: "medequipsolutions.com",
    },
    ...overrides,
  }
}

function testNoApolloCoverageClassification(): void {
  const tierEvidence = ([1, 2, 3] as const).map((tier) =>
    buildApolloSearchQueryAuditTierEvidence({
      tier,
      search_input: { company_name: "Medical Equipment Solutions", domain: "medequipsolutions.com" },
      apollo_response_status: "success",
      apollo_message: null,
      people: [],
      apollo_total_matches: 0,
      mock: true,
    }),
  )
  const result = classifyApolloSearchQueryAudit({
    tier_evidence: tierEvidence,
    mapping_audit: [],
    people: [],
    target_domain: "medequipsolutions.com",
    target_company_name: "Medical Equipment Solutions",
  })
  assert(result.classification === "NO_APOLLO_COVERAGE", "expected NO_APOLLO_COVERAGE")
}

function testOverlyStrictMappingClassification(): void {
  const people = [
    person({ title: "Sales Manager", email: "sales@example.com" }),
    person({ id: "person-2", title: "Marketing Director", email: "mkt@example.com" }),
  ]
  const tierEvidence = [
    buildApolloSearchQueryAuditTierEvidence({
      tier: 1,
      search_input: { company_name: "Medical Equipment Solutions", domain: "medequipsolutions.com" },
      apollo_response_status: "success",
      apollo_message: null,
      people,
      apollo_total_matches: 2,
      mock: true,
    }),
  ]
  const mappingAudit = people.map((row) => ({
    name: row.name ?? null,
    title: row.title ?? null,
    company: row.organization?.name ?? null,
    linkedin: null,
    email_status: row.email_status ?? null,
    accepted: false,
    rejection_reason: "irrelevant_title",
  }))
  const result = classifyApolloSearchQueryAudit({
    tier_evidence: tierEvidence,
    mapping_audit: mappingAudit,
    people,
    target_domain: "medequipsolutions.com",
    target_company_name: "Medical Equipment Solutions",
  })
  assert(result.classification === "OVERLY_STRICT_MAPPING", "expected OVERLY_STRICT_MAPPING")
}

function testCompanyMatchFailureClassification(): void {
  const people = [
    person({
      organization: { name: "Unrelated Healthcare LLC", primary_domain: "otherhealth.com" },
    }),
  ]
  const tierEvidence = [
    buildApolloSearchQueryAuditTierEvidence({
      tier: 1,
      search_input: { company_name: "Medical Equipment Solutions", domain: "medequipsolutions.com" },
      apollo_response_status: "success",
      apollo_message: null,
      people,
      apollo_total_matches: 1,
      mock: true,
    }),
  ]
  const mappingAudit = [
    {
      name: "Jane Owner",
      title: "Owner",
      company: "Unrelated Healthcare LLC",
      linkedin: null,
      email_status: "verified",
      accepted: false,
      rejection_reason: "identity_unknown_person",
    },
  ]
  const result = classifyApolloSearchQueryAudit({
    tier_evidence: tierEvidence,
    mapping_audit: mappingAudit,
    people,
    target_domain: "medequipsolutions.com",
    target_company_name: "Medical Equipment Solutions",
  })
  assert(result.classification === "COMPANY_MATCH_FAILURE", "expected COMPANY_MATCH_FAILURE")
}

function testRedactionSample(): void {
  const sample = redactApolloPersonForAuditSample(
    person({ linkedin_url: "https://linkedin.com/in/jane", city: "Phoenix", state: "AZ" }),
  )
  assert(sample.organization_domain === "medequipsolutions.com", "organization domain preserved")
  assert(sample.city === "Phoenix", "city preserved")
}

function main(): void {
  testNoApolloCoverageClassification()
  console.log("  ✓ NO_APOLLO_COVERAGE classification")
  testOverlyStrictMappingClassification()
  console.log("  ✓ OVERLY_STRICT_MAPPING classification")
  testCompanyMatchFailureClassification()
  console.log("  ✓ COMPANY_MATCH_FAILURE classification")
  testRedactionSample()
  console.log("  ✓ raw person redaction sample")
  assert(APOLLO_SEARCH_QUERY_AUDIT_QA_MARKER.length > 0, "qa marker present")
  console.log("\nApollo search query audit checks passed.")
}

main()

/**
 * Apollo Scale-3 query coverage — tiered search builder, org match, and attribution tests.
 * Run: pnpm test:apollo-scale-3-query-coverage
 */
import assert from "node:assert/strict"
import {
  buildApolloPeopleSearchParamsForTier,
  APOLLO_TIER_E_MAX_PEOPLE,
  GROWTH_APOLLO_PERSON_TITLES,
  shouldSkipApolloSearchTier,
} from "../lib/growth/providers/apollo/apollo-query-builder"
import { evaluateApolloOrganizationMatch } from "../lib/growth/providers/apollo/apollo-org-match"
import { resolveApolloTierMappingPolicy } from "../lib/growth/providers/apollo/apollo-tier-mapping-policy"
import {
  mapApolloPeopleToContactDiscoveryRaw,
  resolveApolloPersonMappingOutcome,
} from "../lib/growth/providers/apollo/map-apollo-contact"
import { resolveApolloAttributedContactableCounts } from "../lib/growth/apollo/apollo-acquisition-search-evidence"
import { isSequenceReadyCompanyContact } from "../lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import type { ApolloPersonRecord } from "../lib/growth/providers/apollo/apollo-types"

function ownerPerson(overrides: Partial<ApolloPersonRecord> = {}): ApolloPersonRecord {
  return {
    id: "owner-1",
    first_name: "Jane",
    last_name: "Owner",
    name: "Jane Owner",
    title: "Owner",
    email: "jane@medonegroup.com",
    email_status: "verified",
    organization: {
      name: "Med One Group",
      primary_domain: "medonegroup.com",
    },
    state: "Arizona",
    ...overrides,
  }
}

function testStrictDomainTierA(): void {
  const built = buildApolloPeopleSearchParamsForTier(
    {
      company_name: "Med One Group",
      domain: "medonegroup.com",
      limit: 10,
    },
    1,
  )
  assert.equal(built.tier_name, "A_strict_domain_titles")
  assert.equal(built.title_filter_applied, true)
  assert.ok(built.request_payload.q_organization_domains_list?.includes("medonegroup.com"))
  assert.equal(built.person_titles.length, GROWTH_APOLLO_PERSON_TITLES.length)
}

function testCompanyLocationTierB(): void {
  const built = buildApolloPeopleSearchParamsForTier(
    {
      company_name: "Med One Group",
      domain: "medonegroup.com",
      city: "Phoenix",
      state: "AZ",
      limit: 10,
    },
    2,
  )
  assert.equal(built.tier_name, "B_company_location_titles")
  assert.equal(built.request_payload.q_organization_name, "Med One Group")
  assert.ok(
    Array.isArray(built.request_payload.organization_locations) &&
      built.request_payload.organization_locations[0]?.includes("AZ"),
  )
  assert.equal(built.request_payload.q_organization_domains_list, undefined)
}

function testTierBSkippedWithoutLocationWhenDomainAbsent(): void {
  const skip = shouldSkipApolloSearchTier(2, {
    company_name: "Med One Group",
    domain: null,
  })
  assert.equal(skip, "missing_location_for_name_search")
}

function testRelaxedTierCMatchesOwnerOperatorTitles(): void {
  const built = buildApolloPeopleSearchParamsForTier(
    {
      company_name: "Next Level DME",
      domain: "nextleveldme.com",
      limit: 10,
    },
    3,
  )
  assert.equal(built.tier_name, "C_relaxed_owner_operator_titles")
  assert.ok(built.person_titles.includes("dme manager"))
  assert.ok(built.person_titles.includes("biomedical technician"))
}

function testTierDOrgOnlyFallbackHasNoTitles(): void {
  const built = buildApolloPeopleSearchParamsForTier(
    {
      company_name: "OMI MedTech",
      domain: "omimedtech.com",
      limit: 10,
    },
    4,
  )
  assert.equal(built.title_filter_applied, false)
  assert.equal(built.person_titles.length, 0)
  assert.ok(built.request_payload.q_organization_domains_list?.includes("omimedtech.com"))
}

function testTierENoTitleFallbackCapped(): void {
  const built = buildApolloPeopleSearchParamsForTier(
    {
      company_name: "Small Med Co",
      domain: "smallmedco.com",
      limit: 25,
    },
    5,
  )
  assert.equal(built.title_filter_applied, false)
  assert.equal(built.per_page, APOLLO_TIER_E_MAX_PEOPLE)
}

function testMapperRejectsWrongOrganization(): void {
  const policy = resolveApolloTierMappingPolicy(2, { domain: null, state: "AZ" })
  const outcome = resolveApolloPersonMappingOutcome(
    ownerPerson({
      organization: { name: "Totally Different Corp", primary_domain: "other.com" },
    }),
    {
      company_name: "Med One Group",
      domain: null,
      mock: true,
      state: "AZ",
      mapping_policy: policy,
    },
  )
  assert.equal(outcome.accepted, false)
  assert.equal(outcome.rejection_reason, "organization_mismatch")
}

function testWeakCompanyNameMismatchRejected(): void {
  const gate = evaluateApolloOrganizationMatch({
    person: ownerPerson({
      organization: null,
    }),
    target_domain: null,
    target_company_name: "Med One Group",
    target_state: "AZ",
    require_organization_match: true,
    require_location_match: false,
  })
  assert.equal(gate.accepted, false)
  assert.equal(gate.reason, "weak_company_name_mismatch")
}

function testRawReturnedButMapperRejectsIrrelevantTitle(): void {
  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: [
      ownerPerson({
        title: "Marketing Director",
        email: "mkt@medonegroup.com",
      }),
    ],
    company_name: "Med One Group",
    domain: "medonegroup.com",
    mock: true,
    mapping_policy: resolveApolloTierMappingPolicy(1, { domain: "medonegroup.com", state: null }),
  })
  assert.equal(mapped.diagnostics.contacts_mapped, 0)
  assert.ok((mapped.diagnostics.skip_reasons.irrelevant_title ?? 0) > 0)
}

function testNoTitleFallbackReturnsCappedCandidates(): void {
  const names = ["Alice Smith", "Bob Jones", "Carol Lee", "Dan Miller", "Eve Wilson", "Frank Brown", "Grace Hall", "Henry King"]
  const people = names.map((name, index) => {
    const [first, last] = name.split(" ")
    return ownerPerson({
      id: `owner-${index}`,
      first_name: first,
      last_name: last,
      name,
      title: index % 2 === 0 ? "Owner" : "General Manager",
      email: `${first!.toLowerCase()}.${last!.toLowerCase()}@smallmedco.com`,
      organization: {
        name: "Small Med Co",
        primary_domain: "smallmedco.com",
      },
    })
  })
  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people,
    company_name: "Small Med Co",
    domain: "smallmedco.com",
    mock: true,
    search_tier: 5,
    mapping_policy: resolveApolloTierMappingPolicy(5, { domain: "smallmedco.com", state: null }),
  })
  assert.equal(mapped.contacts.length, APOLLO_TIER_E_MAX_PEOPLE)
}

function testWeakMatchNotSequenceReadyWithoutVerifiedEmail(): void {
  const ready = isSequenceReadyCompanyContact({
    full_name: "Jane Owner",
    email: "jane@medonegroup.com",
    email_status: "guessed",
    canonical_person_id: "person-1",
    metadata: { apollo_match_strength: "weak" },
  })
  assert.equal(ready, false)
}

function testApolloAttributedCountsExcludeLegacy(): void {
  const counts = resolveApolloAttributedContactableCounts({
    company_contacts: [
      {
        contact_candidate_id: "apollo-1",
        email: "apollo@example.com",
        email_status: "verified",
      },
      {
        contact_candidate_id: "",
        email: "legacy@example.com",
        email_status: "verified",
      },
    ],
    apollo_candidate_ids: new Set(["apollo-1"]),
  })
  assert.equal(counts.apollo_contactable, 1)
  assert.equal(counts.legacy_contactable, 1)
}

function main(): void {
  testStrictDomainTierA()
  console.log("  ✓ tier A strict domain + ICP titles")
  testCompanyLocationTierB()
  console.log("  ✓ tier B company name + location + titles")
  testTierBSkippedWithoutLocationWhenDomainAbsent()
  console.log("  ✓ tier B skipped without location when domain absent")
  testRelaxedTierCMatchesOwnerOperatorTitles()
  console.log("  ✓ tier C relaxed owner/operator titles")
  testTierDOrgOnlyFallbackHasNoTitles()
  console.log("  ✓ tier D org-only fallback has no title filters")
  testTierENoTitleFallbackCapped()
  console.log("  ✓ tier E no-title fallback capped per_page")
  testMapperRejectsWrongOrganization()
  console.log("  ✓ mapper rejects organization mismatch")
  testWeakCompanyNameMismatchRejected()
  console.log("  ✓ weak company-name mismatch rejected")
  testRawReturnedButMapperRejectsIrrelevantTitle()
  console.log("  ✓ raw people returned but mapper rejects irrelevant titles")
  testNoTitleFallbackReturnsCappedCandidates()
  console.log("  ✓ no-title fallback returns capped mapped candidates")
  testWeakMatchNotSequenceReadyWithoutVerifiedEmail()
  console.log("  ✓ weak matches not sequence-ready without verified email")
  testApolloAttributedCountsExcludeLegacy()
  console.log("  ✓ Apollo-attributed contactable counts exclude legacy contacts")
  console.log("\nApollo Scale-3 query coverage checks passed.")
}

main()

/**
 * Apollo tiered search query builder tests.
 * Run: pnpm test:apollo-tiered-search
 */
import assert from "node:assert/strict"
import {
  APOLLO_SEARCH_TIER_NAMES,
  APOLLO_TIER_E_MAX_PEOPLE,
  buildApolloPeopleSearchParamsForTier,
  GROWTH_APOLLO_PERSON_TITLES,
  GROWTH_APOLLO_PERSON_TITLES_TIER_3,
  shouldSkipApolloSearchTier,
} from "../lib/growth/providers/apollo/apollo-query-builder"

const input = {
  company_name: "Med One Group",
  domain: "medonegroup.com",
  website_url: "https://medonegroup.com",
  city: "Phoenix",
  state: "AZ",
  limit: 10,
}

const tier1 = buildApolloPeopleSearchParamsForTier(input, 1)
assert.equal(tier1.tier_name, APOLLO_SEARCH_TIER_NAMES[1])
assert.equal(tier1.domain_exact_only, true)
assert.ok(tier1.request_payload.q_organization_domains_list?.includes("medonegroup.com"))
assert.equal(tier1.person_titles.length, GROWTH_APOLLO_PERSON_TITLES.length)
console.log("  ✓ tier A uses exact domain + full title/seniority filters")

const tier2 = buildApolloPeopleSearchParamsForTier(input, 2)
assert.equal(tier2.tier_name, APOLLO_SEARCH_TIER_NAMES[2])
assert.equal(tier2.domain_exact_only, false)
assert.equal(tier2.request_payload.q_organization_name, "Med One Group")
assert.ok(Array.isArray(tier2.request_payload.organization_locations))
assert.equal(tier2.request_payload.q_organization_domains_list, undefined)
console.log("  ✓ tier B uses company name + location without domain filter")

const tier3 = buildApolloPeopleSearchParamsForTier(input, 3)
assert.equal(tier3.person_titles.length, GROWTH_APOLLO_PERSON_TITLES_TIER_3.length)
assert.ok(tier3.person_titles.includes("dme manager"))
assert.ok(tier3.request_payload.q_organization_domains_list?.includes("medonegroup.com"))
console.log("  ✓ tier C uses domain + relaxed medical equipment titles")

const tier4 = buildApolloPeopleSearchParamsForTier(input, 4)
assert.equal(tier4.title_filter_applied, false)
assert.equal(tier4.person_titles.length, 0)
console.log("  ✓ tier D uses org-only fallback without title filters")

const tier5 = buildApolloPeopleSearchParamsForTier(input, 5)
assert.equal(tier5.title_filter_applied, false)
assert.equal(tier5.per_page, APOLLO_TIER_E_MAX_PEOPLE)
console.log("  ✓ tier E caps no-title fallback per_page")

assert.equal(
  shouldSkipApolloSearchTier(2, { company_name: "Med One Group", domain: null }),
  "missing_location_for_name_search",
)
console.log("  ✓ tier B skipped when domain absent and location missing")

console.log("\nApollo tiered search query builder checks passed.")

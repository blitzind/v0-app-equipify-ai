/**
 * Apollo tiered search query builder tests.
 * Run: pnpm test:apollo-tiered-search
 */
import assert from "node:assert/strict"
import {
  buildApolloPeopleSearchParamsForTier,
  GROWTH_APOLLO_PERSON_TITLES,
  GROWTH_APOLLO_PERSON_TITLES_TIER_3,
} from "../lib/growth/providers/apollo/apollo-query-builder"

const input = {
  company_name: "Med One Group",
  domain: "medonegroup.com",
  website_url: "https://medonegroup.com",
  limit: 10,
}

const tier1 = buildApolloPeopleSearchParamsForTier(input, 1)
assert.equal(tier1.domain_exact_only, true)
assert.ok(tier1.request_payload.q_organization_domains_list?.includes("medonegroup.com"))
assert.equal(tier1.person_titles.length, GROWTH_APOLLO_PERSON_TITLES.length)
console.log("  ✓ tier1 uses exact domain + full title/seniority filters")

const tier2 = buildApolloPeopleSearchParamsForTier(input, 2)
assert.equal(tier2.domain_exact_only, false)
assert.equal(tier2.request_payload.q_organization_name, "Med One Group")
assert.equal(tier2.request_payload.q_organization_domains_list, undefined)
console.log("  ✓ tier2 uses company name without domain filter")

const tier3 = buildApolloPeopleSearchParamsForTier(input, 3)
assert.equal(tier3.person_titles.length, GROWTH_APOLLO_PERSON_TITLES_TIER_3.length)
assert.equal(tier3.person_seniorities.length, 0)
assert.ok(tier3.request_payload.q_organization_domains_list?.includes("medonegroup.com"))
console.log("  ✓ tier3 uses domain + persona titles without seniority filter")

console.log("\nApollo tiered search query builder checks passed.")

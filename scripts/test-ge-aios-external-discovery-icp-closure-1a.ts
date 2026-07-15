/**
 * GE-AIOS-EXTERNAL-DISCOVERY-ICP-CLOSURE-1A — External discovery ICP pipeline certification.
 * Run: pnpm test:ge-aios-external-discovery-icp-closure-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import {
  resolveDatamoonCompanyGeography,
  resolveDatamoonProspectCompanyIdentityKey,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import { normalizeDatamoonAudienceRecord } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { defaultPortfolioManagementSection } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import {
  buildProspectSearchFiltersFromBusinessProfile,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a"
import { applyProspectSearchExternalCompanyFilters } from "../lib/growth/prospect-search/prospect-search-external-filters"
import { explainProspectSearchFilterDrop, normalizeProspectSearchFilters } from "../lib/growth/prospect-search/prospect-search-filters"
import {
  normalizeTerritoryFilter,
  parseTerritoryInput,
  rowMatchesTerritoryFilter,
} from "../lib/growth/prospect-search/prospect-search-geo"
import { normalizeDatamoonProviderRecordsForProspectSearch } from "../lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

export const GE_AIOS_EXTERNAL_DISCOVERY_ICP_CLOSURE_1A_QA_MARKER =
  "ge-aios-external-discovery-icp-closure-1a-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function nationwideProfileFixture(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.com",
      shortDescription: "Equipment maintenance platform",
      productsServices: ["Maintenance software"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Keep equipment running",
    },
    idealCustomers: {
      targetIndustries: ["Medical equipment service"],
      companySizeRanges: ["11-50", "51-200"],
      geography: ["United States", "Canada"],
      buyerPersonas: ["Director of Biomedical Engineering"],
      disqualifiers: ["general retail"],
      preferredNaicsCodes: ["811310"],
      excludedNaicsCodes: ["443142"],
    },
    problemsAndTriggers: {
      painPoints: ["Downtime"],
      buyingTriggers: ["Audit"],
      competitorsAlternatives: [],
      keywords: ["biomedical maintenance", "equipment service"],
      negativeKeywords: ["retail"],
    },
    salesAndMarketing: {
      averageDealSize: "$50k",
      salesCycleEstimate: "90 days",
      messagingAngles: ["Uptime"],
      qualificationCriteria: ["Maintains equipment"],
    },
    portfolioManagement: defaultPortfolioManagementSection(),
    confidence: { score: 85, assumptions: [], missingInformation: [] },
  }
}

function externalCompanyFixture(input: {
  id: string
  state: string
  country?: string
  keywords?: string[]
  industry?: string
}): GrowthProspectSearchCompanyResult {
  return {
    id: input.id,
    source_type: "external_discovered",
    company_name: `${input.state} Medical Service Co`,
    website: `https://${input.id}.example.com`,
    industry: input.industry ?? "Medical equipment service",
    subindustry: null,
    city: "Example City",
    state: input.state,
    country: input.country ?? "US",
    employees: null,
    revenue_range: null,
    location: `${input.state}, US`,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: 0.75,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: ["Provider industry: Medical equipment service"],
    search_intent_category: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 0.5,
    match_reasoning: ["Discovered via DataMoon — routed through canonical Prospect Search."],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: input.keywords ?? ["Medical equipment service", "equipment service"],
    notes: "Provider company id: 123",
  }
}

console.log(`[${GE_AIOS_EXTERNAL_DISCOVERY_ICP_CLOSURE_1A_QA_MARKER}] External discovery ICP closure certification\n`)

// Phase 1 — Nationwide geography
const parsedUs = parseTerritoryInput("US")
assert.equal(parsedUs.country, "US")
assert.equal(parsedUs.cities, undefined)

const parsedCalifornia = parseTerritoryInput("CA")
assert.deepEqual(parsedCalifornia.states, ["CA"])
assert.equal(parsedCalifornia.country, undefined)

const nationwideFilters = normalizeProspectSearchFilters({ location: "US" })
assert.equal(nationwideFilters.territory_filter?.country, "US")
assert.ok(!nationwideFilters.territory_filter?.cities?.includes("us"))

const usTerritory = normalizeTerritoryFilter(nationwideFilters.territory_filter)!
for (const state of ["TX", "FL", "CA", "OH", "TN"]) {
  assert.ok(
    rowMatchesTerritoryFilter({ state, country: "US" }, usTerritory),
    `Expected ${state} to pass nationwide US territory filter`,
  )
}

for (const country of ["CA", "MX", "GB"]) {
  assert.equal(
    rowMatchesTerritoryFilter({ state: "ON", country }, usTerritory),
    false,
    `Expected ${country} to fail US-only territory filter`,
  )
}
console.log("  ✓ Phase 1 — Nationwide US geography and non-US rejection")

const profile = nationwideProfileFixture()
const projection = projectApprovedBusinessProfileToLeadDiscovery(profile)
assert.equal(projection.geography.country, "US")
assert.equal(projection.geography.state, null)

const bpFilters = normalizeProspectSearchFilters(buildProspectSearchFiltersFromBusinessProfile(profile))
assert.equal(bpFilters.location, "US")
assert.equal(bpFilters.territory_filter?.country, "US")
console.log("  ✓ Phase 1b — Business Profile projects nationwide US filters")

// Phase 2 — Company mapping
const normalized = normalizeDatamoonAudienceRecord({
  first_name: "Alex",
  last_name: "Smith",
  personal_city: "Ann Arbor",
  personal_state: "MI",
  contact_country: "US",
  company_name: "Acme Biomedical",
  company_domain: "acmebio.com",
  company_city: "Austin",
  company_state: "TX",
  company_country: "US",
  company_linkedin_url: "https://linkedin.com/company/acmebio",
  company_id: "provider-co-99",
  primary_industry: "Medical equipment service",
  job_title: "Director of Biomedical Engineering",
  company_naics: ["811310"],
})

assert.equal(normalized.company_name, "Acme Biomedical")
assert.equal(normalized.company_domain, "acmebio.com")
assert.equal(normalized.company_city, "Austin")
assert.equal(normalized.company_state, "TX")
assert.equal(normalized.city, "Ann Arbor")
assert.equal(normalized.state, "MI")

const companyGeo = resolveDatamoonCompanyGeography(normalized)
assert.equal(companyGeo.state, "TX")
assert.equal(companyGeo.city, "Austin")
assert.notEqual(companyGeo.state, normalized.state)
console.log("  ✓ Phase 2 — Provider company fields preserved; personal geo kept separate")

const mappedCompanies = normalizeDatamoonProviderRecordsForProspectSearch([
  {
    first_name: "Alex",
    last_name: "Smith",
    company_name: "Acme Biomedical",
    company_domain: "acmebio.com",
    company_city: "Austin",
    company_state: "TX",
    company_country: "US",
    primary_industry: "Medical equipment service",
    job_title: "Director of Biomedical Engineering",
  },
])
assert.equal(mappedCompanies.length, 1)
assert.equal(mappedCompanies[0]!.state, "TX")
assert.equal(mappedCompanies[0]!.city, "Austin")
assert.ok(mappedCompanies[0]!.keywords.some((kw) => /equipment service|Medical equipment/i.test(kw)))
console.log("  ✓ Phase 2b — DataMoon mapper uses company geography and provider evidence")

// Phase 3 — External ICP
const icpFilters = normalizeProspectSearchFilters({
  location: "US",
  keywords: profile.problemsAndTriggers.keywords,
  industry: profile.idealCustomers.targetIndustries[0] ?? null,
})

const texasCompany = externalCompanyFixture({ id: "tx-co", state: "TX" })
assert.equal(explainProspectSearchFilterDrop(texasCompany, icpFilters, { external_discovery: true }), null)

const keywordOnlyFilters = normalizeProspectSearchFilters({
  location: "US",
  keywords: profile.problemsAndTriggers.keywords,
})

const keywordOnlyMiss = externalCompanyFixture({
  id: "tx-miss",
  state: "TX",
  keywords: ["unrelated widgets"],
  industry: "General retail",
})
keywordOnlyMiss.company_name = "Unrelated Widgets LLC"
keywordOnlyMiss.website = "https://unrelated-widgets.example.com"
keywordOnlyMiss.signals = []
keywordOnlyMiss.match_reasoning = []
assert.equal(
  explainProspectSearchFilterDrop(keywordOnlyMiss, keywordOnlyFilters, { external_discovery: true }),
  "keywords",
)

const filtered = applyProspectSearchExternalCompanyFilters(
  [
    texasCompany,
    externalCompanyFixture({ id: "fl-co", state: "FL" }),
    externalCompanyFixture({ id: "ca-co", state: "CA" }),
    externalCompanyFixture({ id: "oh-co", state: "OH" }),
    externalCompanyFixture({ id: "tn-co", state: "TN" }),
    externalCompanyFixture({ id: "ca-country", state: "ON", country: "CA" }),
  ],
  icpFilters,
)
assert.equal(filtered.companies.length, 5)
assert.equal(filtered.diagnostics.geography_accepted_count, 5)
assert.ok((filtered.diagnostics.keyword_accepted_count ?? 0) >= 5)
console.log("  ✓ Phase 3 — External ICP evaluates structured provider evidence")

// Phase 4 — Contact consolidation
const consolidated = normalizeDatamoonProviderRecordsForProspectSearch([
  {
    first_name: "Alex",
    last_name: "One",
    company_name: "Shared Co",
    company_domain: "sharedco.com",
    company_state: "TX",
    job_title: "Director",
  },
  {
    first_name: "Jamie",
    last_name: "Two",
    company_name: "Shared Co",
    company_domain: "sharedco.com",
    company_state: "TX",
    job_title: "Manager",
  },
])
assert.equal(consolidated.length, 1)
assert.equal(resolveDatamoonProspectCompanyIdentityKey(normalizeDatamoonAudienceRecord({
  company_domain: "sharedco.com",
})), "domain:sharedco.com")
console.log("  ✓ Phase 4 — Duplicate contacts consolidate to one company candidate")

// Phase 5 — Canonical handoff wiring
const discoverySource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
const datamoonDiscoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
const repositorySource = readSource("lib/growth/prospect-search/prospect-search-repository.ts")

assert.match(discoverySource, /runProspectSearch/)
assert.match(discoverySource, /executeBulkPushToLeadInbox/)
assert.doesNotMatch(discoverySource, /importDatamoonAudiencePreviewRecords/)
assert.match(datamoonDiscoverySource, /recordsToProspectCompanies/)
assert.match(datamoonDiscoverySource, /consolidateDatamoonAudienceImportRecords/)
assert.match(repositorySource, /runProspectSearchDatamoonAutonomousDiscovery/)
assert.match(repositorySource, /enrichProspectSearchExternalCompanies/)
console.log("  ✓ Phase 5 — Canonical Prospect Search → Intake handoff preserved")

// Phase 6 — Observability hooks
assert.match(datamoonDiscoverySource, /normalizationStats/)
assert.match(datamoonDiscoverySource, /prospect_search_datamoon_autonomous_discovery_normalized/)
assert.match(discoverySource, /external_filter_diagnostics/)
assert.match(readSource("lib/growth/prospect-search/prospect-search-external-filters.ts"), /geography_accepted_count/)
console.log("  ✓ Phase 6 — Extended existing telemetry surfaces")

// Phase 7 — Architecture guardrails
assert.doesNotMatch(discoverySource, /market-intelligence/)
assert.doesNotMatch(datamoonDiscoverySource, /executeBulkPushToLeadInbox/)
assert.doesNotMatch(repositorySource, /growth-market-intelligence/)
console.log("  ✓ Phase 7 — No duplicate engines; outbound/MI paths excluded")

console.log(`\n[${GE_AIOS_EXTERNAL_DISCOVERY_ICP_CLOSURE_1A_QA_MARKER}] PASS — External discovery ICP closure certified`)

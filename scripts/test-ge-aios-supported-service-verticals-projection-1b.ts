/**
 * GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B — Supported Service Verticals projection certification.
 * Run: pnpm test:ge-aios-supported-service-verticals-projection-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  projectApprovedBusinessProfileToLeadDiscovery,
} from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER,
  projectApprovedBusinessProfileToSupportedServiceVerticals,
} from "../lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import {
  GROWTH_SUPPORTED_SERVICE_VERTICALS_REGISTRY_QA_MARKER,
  SUPPORTED_SERVICE_VERTICAL_IDS,
} from "../lib/growth/business-profile/supported-service-verticals"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "../lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { explainProspectSearchFilterDrop, normalizeProspectSearchFilters } from "../lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

const PHASE = "GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertNoForbiddenProviderConcepts(source: string, label: string): void {
  assert.doesNotMatch(source, /topic_id|DatamoonAudienceFilter|buildAudience|EQUIPIFY_ICP_B2B_TOPIC/, `${label} must stay provider-neutral`)
}

function legacyProfileFixture(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Acme HVAC",
      website: "https://acme-hvac.example",
      shortDescription: "Acme provides HVAC service software.",
      productsServices: ["HVAC dispatch software"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Help HVAC contractors run smarter service teams.",
    },
    idealCustomers: {
      targetIndustries: ["HVAC contractors", "Mechanical service"],
      companySizeRanges: ["11–50", "51–200"],
      geography: ["United States"],
      buyerPersonas: ["Owner", "Operations Manager", "Service Manager"],
      disqualifiers: ["Residential-only handymen"],
    },
    problemsAndTriggers: {
      painPoints: ["Manual dispatch", "Missed maintenance visits"],
      buyingTriggers: ["Seasonal hiring", "Fleet expansion"],
      competitorsAlternatives: ["Spreadsheets", "Legacy FSM"],
      keywords: ["hvac software", "hvac dispatch", "mechanical service", "preventive maintenance"],
      negativeKeywords: ["consumer", "diy"],
    },
    salesAndMarketing: {
      averageDealSize: "$15k ACV",
      salesCycleEstimate: "45 days",
      messagingAngles: ["Fewer missed appointments"],
      qualificationCriteria: [
        "Employs field service technicians or maintenance personnel",
        "Uses work orders, dispatch, or recurring service workflows",
      ],
    },
    confidence: {
      score: 0.84,
      assumptions: ["Approved profile"],
      missingInformation: [],
    },
    draftSource: "ai_assisted",
  }
}

function externalCompany(industry: string): GrowthProspectSearchCompanyResult {
  return {
    id: "co-1",
    source_type: "external_discovered",
    company_name: "Example Service Co",
    website: "https://example-service.example.com",
    industry,
    subindustry: null,
    city: "Austin",
    state: "TX",
    country: "US",
    employees: null,
    revenue_range: null,
    location: "Austin, TX",
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: 0.75,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: [`Provider industry: ${industry}`],
    search_intent_category: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 0.5,
    match_reasoning: [],
    keywords: [industry],
    notes: null,
  } as unknown as GrowthProspectSearchCompanyResult
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Supported Service Verticals projection certification`)

  assert.equal(GROWTH_SUPPORTED_SERVICE_VERTICALS_REGISTRY_QA_MARKER, "ge-aios-supported-service-verticals-registry-1b-v1")
  assert.equal(
    GROWTH_SUPPORTED_SERVICE_VERTICALS_PROJECTION_1B_QA_MARKER,
    "ge-aios-supported-service-verticals-projection-1b-v1",
  )
  assert.equal(SUPPORTED_SERVICE_VERTICAL_IDS.length, 27)

  const registrySource = readSource("lib/growth/business-profile/supported-service-verticals.ts")
  const projectionSource = readSource(
    "lib/growth/business-profile/business-profile-supported-service-verticals-projection.ts",
  )
  const leadDiscoverySource = readSource("lib/growth/business-profile/business-profile-lead-discovery-projection.ts")
  const portfolioDiscoverySource = readSource(
    "lib/growth/business-profile/business-profile-prospect-search-projection-1b.ts",
  )

  assertNoForbiddenProviderConcepts(registrySource, "supported-service-verticals registry")
  assertNoForbiddenProviderConcepts(projectionSource, "supported-service-verticals projection")
  assert.doesNotMatch(portfolioDiscoverySource, /projection\.industries\[0\]/, "portfolio discovery must not collapse to industries[0]")
  assert.doesNotMatch(portfolioDiscoverySource, /industries\[0\]/, "portfolio discovery must not use first-industry collapse")
  assert.match(leadDiscoverySource, /projectApprovedBusinessProfileToSupportedServiceVerticals/)
  assert.match(portfolioDiscoverySource, /projectApprovedBusinessProfileToSupportedServiceVerticals/)

  const legacy = legacyProfileFixture()
  const legacyProjection = projectApprovedBusinessProfileToSupportedServiceVerticals(legacy, "Acme HVAC")
  const legacyLeadDiscovery = projectApprovedBusinessProfileToLeadDiscovery(legacy, "Acme HVAC")

  assert.ok(legacyProjection.supportedServiceVerticals.length >= 1)
  const hvacVertical = legacyProjection.supportedServiceVerticals.find((vertical) => vertical.id === "hvac_r")
  assert.ok(hvacVertical, "Expected HVAC-R registry vertical")
  assert.ok((hvacVertical?.profileLabels.length ?? 0) >= 2)
  assert.equal(legacyProjection.operationalModel.customerFacingService, true)
  assert.ok(legacyProjection.operationalModel.qualificationCriteria.length >= 2)
  assert.ok(legacyProjection.operationalModel.capabilities.includes("dispatch"))
  assert.ok(legacyProjection.operationalModel.capabilities.includes("work_orders"))
  assert.ok(legacyProjection.discoveryIntent.topicSeedPhrases.some((topic) => /hvac/i.test(topic)))
  assert.ok(legacyProjection.discoveryIntent.topicSeedPhrases.some((topic) => /preventive maintenance/i.test(topic)))
  assert.doesNotMatch(
    legacyProjection.discoveryIntent.topicSeedPhrases.join(" "),
    /HVAC dispatch software/i,
    "seller products must not pollute discovery topic seeds",
  )

  assert.deepEqual(
    projectApprovedBusinessProfileToSupportedServiceVerticals(legacy, "Acme HVAC"),
    legacyProjection,
    "projection must be deterministic",
  )

  assert.equal(legacyLeadDiscovery.qualificationCriteria.length, legacyProjection.operationalModel.qualificationCriteria.length)
  assert.ok(legacyLeadDiscovery.supportedServiceVerticals.length >= 1)
  assert.ok(legacyLeadDiscovery.industryAliases.length >= 2)
  assert.ok(legacyLeadDiscovery.topics.length >= legacyProjection.supportedServiceVerticals.length)

  const equipify = buildLive1bEquipifyCompanyProfileContent()
  const equipifyProjection = projectApprovedBusinessProfileToSupportedServiceVerticals(equipify, "Equipify")
  assert.ok(
    equipifyProjection.supportedServiceVerticals.length >= equipify.idealCustomers.targetIndustries.length - 5,
    "LIVE-1B profile verticals should resolve without collapsing",
  )
  for (const industry of equipify.idealCustomers.targetIndustries) {
    assert.ok(
      equipifyProjection.discoveryIntent.industryAliases.some(
        (alias) => alias.toLowerCase() === industry.toLowerCase() || alias.toLowerCase().includes(industry.toLowerCase().slice(0, 12)),
      ) || equipifyProjection.supportedServiceVerticals.some((vertical) =>
        vertical.profileLabels.some((label) => label.toLowerCase() === industry.toLowerCase()),
      ),
      `Expected industry alias or vertical profile label for ${industry}`,
    )
  }
  assert.ok(equipifyProjection.operationalModel.qualificationCriteria.length >= 5)
  assert.ok(equipifyProjection.operationalModel.capabilities.includes("technicians"))
  assert.ok(equipifyProjection.operationalModel.capabilities.includes("customer_assets"))

  const explicitProfile: BusinessProfileDraftContent = {
    ...legacy,
    idealCustomers: {
      ...legacy.idealCustomers,
      supportedServiceVerticals: [{ id: "hvac_r", label: "HVAC-R" }],
    },
  }
  const explicitProjection = projectApprovedBusinessProfileToSupportedServiceVerticals(explicitProfile)
  assert.ok(explicitProjection.supportedServiceVerticals.some((vertical) => vertical.id === "hvac_r"))

  const filters = normalizeProspectSearchFilters(buildProspectSearchFiltersFromBusinessProfile(legacy))
  assert.equal(filters.industry, null)
  assert.ok((filters.industry_aliases?.length ?? 0) >= 2)
  assert.ok((filters.supported_service_vertical_ids?.length ?? 0) >= 1)
  assert.ok((filters.qualification_criteria?.length ?? 0) >= 2)
  assert.ok((filters.operational_evidence_requirements?.length ?? 0) >= 2)
  assert.equal(
    explainProspectSearchFilterDrop(
      { ...externalCompany("HVAC service"), keywords: ["hvac dispatch", "HVAC service"] },
      filters,
      { external_discovery: true },
    ),
    null,
  )
  assert.equal(
    explainProspectSearchFilterDrop(externalCompany("Unrelated retail"), filters, { external_discovery: true }),
    "industry",
  )

  const query = buildProspectSearchQueryFromBusinessProfile(legacy, "Acme HVAC")
  assert.match(query, /HVAC|Mechanical|supported service vertical/i)
  assert.doesNotMatch(query, /industries\[0\]/)

  console.log(`[${PHASE}] PASS — Supported Service Verticals projection certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

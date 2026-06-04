/**
 * Phase 7.PS-D — Prospect Search readiness & prioritization regression tests.
 * Run: pnpm test:growth-prospect-search-readiness-7-ps-d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildProspectSearchEngineReadiness,
  companyMatchesProspectSearchEngineReadinessFilters,
  filterProspectSearchCompaniesByEngineReadiness,
  hasActiveProspectSearchEngineReadinessFilters,
  mergeEngineReadinessIntoContactIntelligence,
  prioritizeProspectSearchCompaniesByEngineReadiness,
} from "../lib/growth/prospect-search/prospect-search-engine-readiness"
import { GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-readiness-types"
import { GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-readiness-ux"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchEngineIntelligence } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES } from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

assert.equal(
  GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER,
  "growth-prospect-search-readiness-7-ps-d-v1",
)
assert.equal(GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER, "growth-prospect-search-readiness-ux-7-ps-d-v1")

const readinessModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-engine-readiness.ts"),
  "utf8",
)
assert.doesNotMatch(readinessModule, /openai|intent_score|lead_score|fit_score|opportunity_score/i)
assert.match(readinessModule, /buildProspectSearchEngineReadiness/)
assert.match(readinessModule, /resolvePrioritizationTier/)
assert.match(readinessModule, /resolveResearchCompleteness/)

const mergeModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-engine-intelligence-merge.ts"),
  "utf8",
)
assert.match(mergeModule, /mergeEngineReadinessIntoContactIntelligence/)

const orchestration = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-first-orchestration.ts"),
  "utf8",
)
assert.match(orchestration, /filterProspectSearchCompaniesByEngineReadiness/)
assert.match(orchestration, /prioritizeProspectSearchCompaniesByEngineReadiness/)

const discoveryHydration = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-discovery-hydration.ts"),
  "utf8",
)
assert.match(discoveryHydration, /filterProspectSearchCompaniesByEngineReadiness/)

const companyCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
  "utf8",
)
assert.match(companyCard, /ProspectSearchEngineReadinessBadges/)

const guidedIcp = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/guided-icp-builder.tsx"),
  "utf8",
)
assert.match(guidedIcp, /ProspectSearchEngineReadinessFiltersCard/)
assert.match(guidedIcp, /engine-readiness/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-engine-intelligence-panel.tsx"),
  "utf8",
)
assert.match(panel, /ProspectSearchEngineReadinessSummaryCard/)
assert.match(panel, /ProspectSearchEngineReadinessBreakdownPanel/)

const typesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-types.ts"),
  "utf8",
)
assert.match(typesSource, /prioritization_tiers/)
assert.match(typesSource, /research_completeness/)

function mockEngine(partial: Partial<GrowthProspectSearchEngineIntelligence>): GrowthProspectSearchEngineIntelligence {
  return {
    qa_marker: "growth-prospect-search-engine-intelligence-7-ps-a-v1",
    has_canonical_company: true,
    canonical_company_id: "cc-1",
    schema_ready: true,
    schema_health: null,
    verified_channels: {
      persons_with_verified_email: 2,
      persons_with_verified_phone: 1,
      persons_with_verified_profile: 1,
      by_person_id: {
        p1: {
          person_id: "p1",
          has_verified_email: true,
          verified_email: "a@acme.com",
          has_verified_phone: true,
          verified_phone: "+15551234567",
          has_verified_profile: false,
          verified_profile_url: null,
        },
      },
    },
    buying_committee: {
      verified_member_count: 2,
      coverage_score: 0.75,
      roles_present: ["economic_buyer", "champion", "influencer"],
      roles_missing: ["technical_buyer"],
      single_thread_risk: false,
      members: [
        {
          person_id: "p1",
          full_name: "Alex Buyer",
          job_title: "VP Sales",
          committee_role: "economic_buyer",
        },
        {
          person_id: "p2",
          full_name: "Casey Champion",
          job_title: "Director",
          committee_role: "champion",
        },
      ],
    },
    company_intelligence: {
      has_verified_intelligence: true,
      categories_present: ["description", "industry", "technology", "contactability", "website_signal"],
      discovery_status: "complete",
      snapshots: [],
    },
    source_labels: [],
    ...partial,
  } as GrowthProspectSearchEngineIntelligence
}

function mockCompany(engine: GrowthProspectSearchEngineIntelligence | null): GrowthProspectSearchCompanyResult {
  const contact_intelligence = {
    contacts: [],
    engine_intelligence: engine,
  } as NonNullable<GrowthProspectSearchCompanyResult["contact_intelligence"]>
  return {
    id: "c1",
    source_type: "growth_lead",
    company_name: "Acme",
    canonical_company_id: engine?.canonical_company_id ?? null,
    contact_intelligence: mergeEngineReadinessIntoContactIntelligence(contact_intelligence, {
      contact_intelligence,
      canonical_company_id: engine?.canonical_company_id ?? null,
      is_suppressed: false,
    }),
  } as GrowthProspectSearchCompanyResult
}

const readyCompany = mockCompany(mockEngine({}))
const readiness = readyCompany.contact_intelligence!.engine_readiness!
assert.equal(readiness.qa_marker, GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER)
assert.ok(readiness.overall.score > 0)
assert.ok(readiness.operator_summary.length > 10)
assert.ok(
  ["ready_for_outreach", "outreach_with_gaps"].includes(readiness.prioritization_tier),
  `expected outreach tier, got ${readiness.prioritization_tier}`,
)

const insufficient = buildProspectSearchEngineReadiness({
  company: {
    canonical_company_id: null,
    is_suppressed: false,
    contact_intelligence: { contacts: [], engine_intelligence: null } as never,
  },
})
assert.equal(insufficient.prioritization_tier, "insufficient_data")
assert.equal(insufficient.research_completeness, "insufficient_data")

const filtered = filterProspectSearchCompaniesByEngineReadiness(
  [readyCompany, mockCompany(mockEngine({ has_canonical_company: false, canonical_company_id: null }))],
  { prioritization_tiers: ["ready_for_outreach", "outreach_with_gaps"] },
)
assert.equal(filtered.length, 1)

assert.equal(hasActiveProspectSearchEngineReadinessFilters({ prioritization_tiers: ["research_first"] }), true)
assert.equal(
  companyMatchesProspectSearchEngineReadinessFilters(readyCompany, { research_completeness: ["fully_researched"] }),
  readiness.research_completeness === "fully_researched",
)

const low = mockCompany(
  mockEngine({
    verified_channels: {
      persons_with_verified_email: 0,
      persons_with_verified_phone: 0,
      persons_with_verified_profile: 0,
      by_person_id: {},
    },
    buying_committee: {
      verified_member_count: 0,
      coverage_score: 0,
      roles_present: [],
      roles_missing: [...GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES],
      single_thread_risk: false,
      members: [],
    },
    company_intelligence: {
      has_verified_intelligence: false,
      categories_present: [],
      discovery_status: "none",
      snapshots: [],
    },
  }),
)
const ordered = prioritizeProspectSearchCompaniesByEngineReadiness([low, readyCompany])
assert.equal(ordered[0]?.id, readyCompany.id)

console.log("growth-prospect-search-readiness-7-ps-d: PASS")

/**
 * Phase 7.PS-B — Prospect Search intelligence UX & filters regression tests.
 * Run: pnpm test:growth-prospect-search-intelligence-ux-7-ps-b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  companyMatchesProspectSearchEngineIntelligenceFilters,
  filterProspectSearchCompaniesByEngineIntelligence,
  buildProspectSearchEngineIntelligenceSummary,
  hasActiveProspectSearchEngineIntelligenceFilters,
  personMatchesProspectSearchEngineIntelligenceFilters,
  resolveProspectSearchPersonEngineChannelBadges,
} from "../lib/growth/prospect-search/prospect-search-engine-intelligence-filters"
import { GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-ux"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

assert.equal(GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER, "growth-prospect-search-intelligence-ux-7-ps-b-v1")

const filtersModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-engine-intelligence-filters.ts"),
  "utf8",
)
assert.doesNotMatch(filtersModule, /cron|orchestrator|promote|openai/i)

const orchestration = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-first-orchestration.ts"),
  "utf8",
)
assert.match(orchestration, /filterProspectSearchCompaniesByEngineIntelligence/)

const discoveryHydration = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-discovery-hydration.ts"),
  "utf8",
)
assert.match(discoveryHydration, /filterProspectSearchCompaniesByEngineIntelligence/)

const companyCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
  "utf8",
)
assert.match(companyCard, /ProspectSearchEngineIntelligenceSummary/)
assert.match(companyCard, /ProspectSearchLegacyIntelligenceNotice/)
assert.match(companyCard, /shouldGateLegacyProspectSearchCompanySignals/)

const guidedIcp = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/guided-icp-builder.tsx"),
  "utf8",
)
assert.match(guidedIcp, /ProspectSearchEngineIntelligenceFiltersCard/)
assert.match(guidedIcp, /engine-intelligence/)

const peopleTable = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-discover-people-table.tsx"),
  "utf8",
)
assert.match(peopleTable, /ProspectSearchEngineIntelligenceChannelBadges/)

const typesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-types.ts"),
  "utf8",
)
assert.match(typesSource, /engine_verified_email/)
assert.match(typesSource, /buying_committee_roles/)
assert.match(typesSource, /company_intelligence_categories/)

function mockCompany(
  engine: NonNullable<GrowthProspectSearchCompanyResult["contact_intelligence"]>["engine_intelligence"],
): GrowthProspectSearchCompanyResult {
  return {
    id: "c1",
    source_type: "growth_lead",
    company_name: "Acme",
    contact_intelligence: {
      contacts: [{ id: "ct1", canonical_person_id: "p1" } as never],
      engine_intelligence: engine,
    } as never,
  } as GrowthProspectSearchCompanyResult
}

const withEngine = mockCompany({
  qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
  schema_ready: true,
  schema_health: null,
  canonical_company_id: "co1",
  has_canonical_company: true,
  company_intelligence: {
    has_verified_intelligence: true,
    snapshot_count: 2,
    categories_present: ["technology", "hiring"],
    discovery_status: "completed",
    snapshots: [],
  },
  buying_committee: {
    member_count: 1,
    verified_member_count: 1,
    coverage_score: 0.25,
    single_thread_risk: true,
    roles_present: ["economic_buyer"],
    roles_missing: [],
    members: [
      {
        person_id: "p1",
        full_name: "Pat",
        job_title: "Owner",
        committee_role: "economic_buyer",
        confidence: 0.9,
      },
    ],
  },
  verified_channels: {
    person_count: 1,
    persons_with_verified_email: 1,
    persons_with_verified_phone: 0,
    persons_with_verified_profile: 1,
    by_person_id: {
      p1: {
        person_id: "p1",
        has_verified_email: true,
        verified_email: "pat@acme.com",
        has_verified_phone: false,
        verified_phone: null,
        has_verified_profile: true,
        verified_profile_url: "https://linkedin.com/in/pat",
      },
    },
  },
  source_labels: ["growth.engine_intelligence"],
})

assert.ok(
  companyMatchesProspectSearchEngineIntelligenceFilters(withEngine, { engine_verified_email: true }),
)
assert.ok(
  !companyMatchesProspectSearchEngineIntelligenceFilters(withEngine, { engine_verified_phone: true }),
)
assert.ok(
  companyMatchesProspectSearchEngineIntelligenceFilters(withEngine, {
    buying_committee_roles: ["economic_buyer"],
  }),
)
assert.ok(
  !companyMatchesProspectSearchEngineIntelligenceFilters(withEngine, {
    company_intelligence_categories: ["location"],
  }),
)

const filtered = filterProspectSearchCompaniesByEngineIntelligence(
  [withEngine, mockCompany(null)],
  { engine_verified_profile: true },
)
assert.equal(filtered.length, 1)

const summary = buildProspectSearchEngineIntelligenceSummary(withEngine)
assert.ok(summary?.headline.includes("Growth Engine"))
assert.ok(summary?.detail?.includes("Single-thread"))

assert.ok(hasActiveProspectSearchEngineIntelligenceFilters({ engine_verified_email: true }))
assert.ok(!hasActiveProspectSearchEngineIntelligenceFilters({}))

const personRow = {
  contact_id: "ct1",
  company: withEngine,
} as import("../lib/growth/prospect-search/prospect-search-contact-discovery").GrowthProspectSearchPeopleResultRow

assert.ok(personMatchesProspectSearchEngineIntelligenceFilters(personRow, { engine_verified_email: true }))
assert.ok(
  !personMatchesProspectSearchEngineIntelligenceFilters(personRow, {
    buying_committee_roles: ["champion"],
  }),
)

const badges = resolveProspectSearchPersonEngineChannelBadges(personRow)
assert.equal(badges.verified_email, true)
assert.equal(badges.committee_role, "economic_buyer")

console.log("growth-prospect-search-intelligence-ux-7-ps-b: PASS")

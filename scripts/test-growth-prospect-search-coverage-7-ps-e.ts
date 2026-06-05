/**
 * Phase 7.PS-E — Prospect Search coverage & resolution hardening regression tests.
 * Run: pnpm test:growth-prospect-search-coverage-7-ps-e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  aggregateProspectSearchCoverageMetrics,
  buildProspectSearchIntelligenceCoverage,
  buildProspectSearchIntelligenceCoverageMetrics,
  companyResolutionConfidence,
  personLinkageConfidence,
} from "../lib/growth/prospect-search/prospect-search-coverage-metrics"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-coverage-types"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-coverage-ux"
import {
  resolveProspectSearchCompanyCoverage,
  type ProspectSearchDomainResolutionIndex,
} from "../lib/growth/prospect-search/prospect-search-coverage-resolution-core"

assert.equal(GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER, "growth-prospect-search-coverage-7-ps-e-v1")
assert.equal(GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER, "growth-prospect-search-coverage-ux-7-ps-e-v1")

const resolutionModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-coverage-resolution.ts"),
  "utf8",
)
assert.doesNotMatch(resolutionModule, /openai|intent_score|lead_score|fit_score|opportunity_score/i)
const resolutionCore = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-coverage-resolution-core.ts"),
  "utf8",
)
assert.match(resolutionModule, /loadProspectSearchDomainResolutionIndex/)
assert.match(resolutionCore, /resolveProspectSearchCompanyCoverage/)
assert.match(resolutionModule, /resolveProspectSearchPersonLinkageBatch/)
assert.match(resolutionModule, /contact_candidates/)
assert.match(resolutionModule, /company_domains/)
assert.match(resolutionCore, /lead_staging_lineage/)

const canonicalReexport = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-canonical-resolution.ts"),
  "utf8",
)
assert.match(canonicalReexport, /prospect-search-coverage-resolution/)

const loader = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-intelligence-loader.ts"),
  "utf8",
)
assert.match(loader, /resolveProspectSearchCompanyCoverageBatch/)
assert.match(loader, /resolveProspectSearchPersonLinkageBatch/)
assert.match(loader, /mergeProspectSearchCoverageIntoContactIntelligence/)

const companyCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
  "utf8",
)
assert.match(companyCard, /ProspectSearchCoverageBadges/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-coverage-resolution-panel.tsx"),
  "utf8",
)
assert.match(panel, /ProspectSearchCoverageMetricsCard/)

const emptyIndex: ProspectSearchDomainResolutionIndex = {
  by_normalized_domain: new Map(),
  staging_candidate_by_id: new Map(),
  staging_candidate_by_domain: new Map(),
}

const fromLeadMeta = resolveProspectSearchCompanyCoverage({
  source_type: "growth_lead",
  id: "lead-row-1",
  growth_lead_id: "lead-1",
  website: "https://acme.com",
  lead_metadata: { canonical_company_id: "cc-direct" },
  index: emptyIndex,
})
assert.equal(fromLeadMeta.method, "lead_metadata_canonical")
assert.equal(fromLeadMeta.canonical_company_id, "cc-direct")
assert.equal(fromLeadMeta.confidence, companyResolutionConfidence("lead_metadata_canonical"))

const fromDomain: ProspectSearchDomainResolutionIndex = {
  by_normalized_domain: new Map([
    ["acme.com", { company_id: "cc-domain", method: "companies_primary_domain" }],
  ]),
  staging_candidate_by_id: new Map(),
  staging_candidate_by_domain: new Map(),
}
const domainResolved = resolveProspectSearchCompanyCoverage({
  source_type: "crm_prospect",
  id: "crm-1",
  growth_lead_id: null,
  website: "https://www.acme.com",
  index: fromDomain,
})
assert.equal(domainResolved.method, "companies_primary_domain")
assert.equal(domainResolved.canonical_company_id, "cc-domain")

const unresolved = resolveProspectSearchCompanyCoverage({
  source_type: "external_discovered",
  id: "ext-1",
  growth_lead_id: null,
  website: null,
  index: emptyIndex,
})
assert.equal(unresolved.method, "unresolved")
assert.equal(unresolved.unresolved_company, true)
assert.ok(unresolved.reasons.length > 0)

const coverage = buildProspectSearchIntelligenceCoverage({
  company: domainResolved,
  contacts: [
    {
      contact_id: "c1",
      canonical_person_id: "p1",
      linked: true,
      confidence: personLinkageConfidence("company_contacts_column"),
      method: "company_contacts_column",
      reasons: [],
      evidence: ["company_contacts.canonical_person_id is set"],
      unresolved_contact: false,
    },
    {
      contact_id: "c2",
      canonical_person_id: null,
      linked: false,
      confidence: 0,
      method: "unresolved",
      reasons: ["No canonical_person_id"],
      evidence: [],
      unresolved_contact: true,
    },
  ],
  contact_intelligence: {
    engine_intelligence: {
      verified_channels: {
        person_count: 1,
        persons_with_verified_email: 1,
        persons_with_verified_phone: 0,
        persons_with_verified_profile: 0,
        by_person_id: {},
      },
      buying_committee: {
        verified_member_count: 1,
        coverage_score: 0.5,
      },
      company_intelligence: {
        has_verified_intelligence: true,
        categories_present: ["description", "industry"],
      },
    } as never,
  } as never,
})
assert.equal(coverage.metrics.contact_count, 2)
assert.equal(coverage.metrics.contacts_with_canonical_person, 1)
assert.equal(coverage.unresolved_contact_count, 1)

const agg = aggregateProspectSearchCoverageMetrics([
  { metrics: coverage.metrics },
  { metrics: { ...coverage.metrics, canonical_company_linked: false } },
])
assert.equal(agg.account_count, 2)
assert.equal(agg.accounts_with_canonical_company, 1)

console.log("growth-prospect-search-coverage-7-ps-e: PASS")

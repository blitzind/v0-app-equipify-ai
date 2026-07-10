/** GE-AIOS-LIVE-1B — Industry code filter certification (client-safe). */
import assert from "node:assert/strict"
import {
  resolveIndustryCodesFromQuery,
  rowMatchesProspectSearchIndustryCodeFilters,
  validateIndustryCode,
} from "@/lib/growth/prospect-search/prospect-search-industry-code-filters"
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchIndexCompany } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  LIVE_1B_OPERATOR_APPROVED_NAICS,
  LIVE_1B_OPERATOR_EXCLUDED_SIC,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

function baseRow(overrides: Partial<GrowthProspectSearchIndexCompany>): GrowthProspectSearchIndexCompany {
  return {
    id: "row-1",
    source_type: "growth_lead",
    company_name: "Acme Biomedical Service",
    website: "https://example.com",
    industry: "Biomedical equipment service",
    subindustry: null,
    employees: "50",
    revenue_range: null,
    location: "Tennessee",
    city: "Nashville",
    state: "TN",
    service_area: null,
    notes: null,
    keywords: ["biomedical", "equipment repair", "preventive maintenance"],
    crm_detected: null,
    website_platform: null,
    field_service_software: null,
    intent_score: null,
    buying_stage: null,
    buying_stage_confidence: null,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: null,
    lead_engine_score: null,
    lead_engine_score_label: null,
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    company_match_confidence: null,
    decision_maker_count: 0,
    verification_status: "unknown",
    priority: null,
    signals: [],
    search_intent_category: null,
    returning_visitor: false,
    existing_account: false,
    in_revenue_queue: false,
    existing_customer: false,
    existing_prospect: false,
    already_pushed: false,
    is_suppressed: false,
    suppression_reason: null,
    suppression_scope: null,
    suppressed_at: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    ...overrides,
  }
}

// Valid NAICS accepted
for (const code of LIVE_1B_OPERATOR_APPROVED_NAICS) {
  const result = validateIndustryCode(code, "naics")
  assert.equal(result.ok, true, `expected valid NAICS ${code}`)
  if (result.ok) assert.ok(result.label.length > 0)
}

// Multiple NAICS supported
assert.ok(LIVE_1B_OPERATOR_APPROVED_NAICS.length >= 2)

// SIC supported
const sic = validateIndustryCode(LIVE_1B_OPERATOR_EXCLUDED_SIC[0]!, "sic")
assert.equal(sic.ok, true, "expected supported SIC from operator set")

// Invalid codes rejected
const invalid = validateIndustryCode("abc", "naics")
assert.equal(invalid.ok, false)
assert.equal(invalid.reason, "invalid_format")

const unsupported = validateIndustryCode("999999", "naics")
assert.equal(unsupported.ok, true)
assert.equal(unsupported.ok && unsupported.source, "format")

// Natural-language resolves to reviewable codes
const nl = resolveIndustryCodesFromQuery("biomedical equipment repair")
assert.ok(nl.some((row) => row.kind === "naics" && row.label.toLowerCase().includes("biomedical")))

// Include/exclude behavior
assert.equal(
  rowMatchesProspectSearchIndustryCodeFilters({
    industry: "Software publisher",
    keywords: ["saas"],
    preferredNaics: ["811310"],
  }),
  false,
)
assert.equal(
  rowMatchesProspectSearchIndustryCodeFilters({
    industry: "Industrial equipment service",
    keywords: ["machinery repair", "preventive maintenance"],
    preferredNaics: ["811310"],
  }),
  true,
)

// Filter drop integration — manufacturing keyword alone does not auto-pass NAICS include
const manufacturingRow = baseRow({
  company_name: "Generic Manufacturer",
  industry: "Manufacturing",
  keywords: ["factory", "assembly"],
})
const drop = explainProspectSearchFilterDrop(manufacturingRow, { naics_codes: ["811310"] })
assert.equal(drop, "naics_codes")

console.log("[GE-AIOS-LIVE-1B] industry code filter certification passed")

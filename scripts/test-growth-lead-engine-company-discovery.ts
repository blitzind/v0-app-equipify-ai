/**
 * Regression checks for Lead Engine Company Discovery Engine (Prompt 2).
 * Run: pnpm test:growth-lead-engine-company-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineCompanyDiscoverySystemPrompt,
  buildGrowthLeadEngineCompanyDiscoveryTemplateUserPrompt,
  buildGrowthLeadEngineCompanyDiscoveryUserPrompt,
  GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/company-discovery-prompt"
import { parseGrowthLeadEngineCompanyDiscoveryOutput } from "../lib/growth/lead-engine/company-discovery-parse"
import {
  GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_QA_MARKER,
  GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS,
} from "../lib/growth/lead-engine/company-discovery-types"

assert.equal(GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_QA_MARKER, "lead-engine-company-discovery-v1")
assert.equal(GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS.length, 4)
assert.equal(GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_OUTPUT_JSON_KEYS.length, 5)

const systemPrompt = buildGrowthLeadEngineCompanyDiscoverySystemPrompt()
assert.match(systemPrompt, /Do NOT invent missing facts/)
assert.match(systemPrompt, /Do NOT invent contacts/)
assert.match(systemPrompt, /Do NOT create outreach copy/)
assert.match(systemPrompt, /Do NOT score contacts/)
assert.match(systemPrompt, /company_profile/)
assert.match(systemPrompt, /fit_assessment/)
assert.match(systemPrompt, /source_evidence/)
assert.match(systemPrompt, /employee_estimate/)
assert.doesNotMatch(systemPrompt, /invent revenue|fabricate contacts/i)

const sampleIcp = {
  icp_summary: "Commercial HVAC contractors in TX.",
  qualification_rules: { must_have: ["Commercial HVAC"], nice_to_have: [], disqualifiers: ["Residential only"] },
  firmographic_filters: {
    industries: ["HVAC"],
    employee_ranges: ["10-75"],
    revenue_ranges: [],
    geographies: ["Texas"],
    business_models: [],
  },
  technology_filters: { required: [], preferred: [], excluded: [] },
  target_roles: { primary: [], secondary: [], avoid: [] },
  pain_point_patterns: [],
  buying_trigger_patterns: [],
  search_patterns: [],
  negative_search_patterns: [],
  fit_scoring_weights: {
    industry_fit: 25,
    company_size: 20,
    technology_fit: 15,
    pain_alignment: 20,
    buying_signal_strength: 10,
    title_match: 10,
  },
  confidence_rules: { high_fit: "", medium_fit: "", low_fit: "" },
}

const userPrompt = buildGrowthLeadEngineCompanyDiscoveryUserPrompt({
  icpTargeting: sampleIcp,
  candidateSource: "google_search",
  companyName: "Acme Commercial HVAC",
  domain: "acmehvac.example",
  websiteText: "Acme provides commercial heating and cooling across Dallas-Fort Worth. 40 technicians.",
  searchSnippets: "Acme Commercial HVAC — commercial HVAC contractor Dallas",
  knownMetadata: '{"source_rank": 1}',
})
assert.match(userPrompt, /Acme Commercial HVAC/)
assert.match(userPrompt, /Commercial HVAC/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineCompanyDiscoveryTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_TEMPLATE_PLACEHOLDERS.icp_targeting_json))
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_TEMPLATE_PLACEHOLDERS.domain))

const validJson = JSON.stringify({
  company_profile: {
    company_name: "Acme Commercial HVAC",
    domain: "acmehvac.example",
    industry: "HVAC",
    sub_industry: "Commercial HVAC",
    business_model: "B2B service contractor",
    service_area: ["Dallas-Fort Worth"],
    headquarters: "Dallas, TX",
    employee_estimate: null,
    revenue_estimate: null,
    phone: "",
    address: "",
    social_links: [],
  },
  fit_assessment: {
    fit_score: 78,
    fit_tier: "high",
    confidence: 0.72,
    matched_icp_rules: ["Commercial HVAC"],
    missing_evidence: ["Revenue not stated"],
    disqualifiers: [],
  },
  signals: {
    positive_fit_signals: ["Commercial service mix"],
    negative_fit_signals: [],
    pain_signals: [],
    buying_triggers: [],
    technology_signals: [],
    growth_signals: ["40 technicians mentioned"],
  },
  recommended_next_step: {
    action: "Promote to prospect queue",
    reason: "Strong ICP match with explicit commercial HVAC evidence.",
  },
  source_evidence: [
    {
      claim: "Commercial HVAC services",
      evidence: "provides commercial heating and cooling",
      source: "website_text",
    },
  ],
})

const parsed = parseGrowthLeadEngineCompanyDiscoveryOutput(validJson)
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.fit_assessment.fit_tier, "high")
  assert.equal(parsed.output.fit_assessment.fit_score, 78)
  assert.equal(parsed.output.company_profile.employee_estimate, null)
  assert.equal(parsed.output.source_evidence.length, 1)
}

const missingName = parseGrowthLeadEngineCompanyDiscoveryOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    company_profile: { ...JSON.parse(validJson).company_profile, company_name: "" },
  }),
)
assert.equal(missingName.ok, false)

const promptFile = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/company-discovery-prompt.ts"),
  "utf8",
)
assert.match(promptFile, /Company Discovery Engine/)
assert.match(promptFile, /GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_TEMPLATE_PLACEHOLDERS/)

console.log("growth-lead-engine-company-discovery-v1 checks passed")

/**
 * Regression checks for Lead Engine ICP + Targeting Engine (Prompt 1).
 * Run: pnpm test:growth-lead-engine-icp-targeting
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineIcpTargetingSystemPrompt,
  buildGrowthLeadEngineIcpTargetingTemplateUserPrompt,
  buildGrowthLeadEngineIcpTargetingUserPrompt,
  GROWTH_LEAD_ENGINE_ICP_TARGETING_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/icp-targeting-prompt"
import { parseGrowthLeadEngineIcpTargetingOutput } from "../lib/growth/lead-engine/icp-targeting-parse"
import {
  GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS,
  GROWTH_LEAD_ENGINE_ICP_TARGETING_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_ICP_TARGETING_QA_MARKER,
} from "../lib/growth/lead-engine/icp-targeting-types"

assert.equal(GROWTH_LEAD_ENGINE_ICP_TARGETING_QA_MARKER, "lead-engine-icp-targeting-v1")
assert.equal(GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS.length, 6)
assert.equal(GROWTH_LEAD_ENGINE_ICP_TARGETING_OUTPUT_JSON_KEYS.length, 11)

const systemPrompt = buildGrowthLeadEngineIcpTargetingSystemPrompt()
assert.match(systemPrompt, /Do NOT find companies/)
assert.match(systemPrompt, /Do NOT invent prospects/)
assert.match(systemPrompt, /Do NOT research contacts/)
assert.match(systemPrompt, /search_patterns/)
assert.match(systemPrompt, /negative_search_patterns/)
assert.match(systemPrompt, /fit_scoring_weights/)
assert.doesNotMatch(systemPrompt, /find specific companies|research contacts for/i)

const sampleInput = {
  industryFocus: "HVAC and commercial refrigeration service",
  targetGeography: "Texas, Tennessee, Illinois",
  employeeMin: "10",
  employeeMax: "75",
  revenueMin: "$2M",
  revenueMax: "$25M",
  targetTitles: "Owner, General Manager, Operations Manager",
  excludedTitles: "Intern, Student, Franchise corporate",
  requiredSignals: "Field service trucks, dispatch pain, multi-location",
  negativeSignals: "Residential-only, franchise HQ, PE rollup",
  targetTechnologies: "Housecall Pro, ServiceTitan",
  excludedTechnologies: "Salesforce-only SaaS",
  serviceTypes: "HVAC repair, refrigeration maintenance",
  businessModel: "B2B commercial service contractor",
  painPoints: "Manual dispatch, paper work orders, missed callbacks",
  buyingTriggers: "New ops manager, fleet expansion, competitor churn",
  competitors: "ServiceTitan, Housecall Pro",
  constraints: "Exclude government-only and residential-only shops",
}

const userPrompt = buildGrowthLeadEngineIcpTargetingUserPrompt(sampleInput)
assert.match(userPrompt, /HVAC and commercial refrigeration service/)
assert.match(userPrompt, /Texas, Tennessee, Illinois/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineIcpTargetingTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_ICP_TARGETING_TEMPLATE_PLACEHOLDERS.industry_focus))
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_ICP_TARGETING_TEMPLATE_PLACEHOLDERS.constraints))

const validJson = JSON.stringify({
  icp_summary: "Commercial HVAC and refrigeration contractors in TX/TN/IL with 10-75 employees.",
  qualification_rules: {
    must_have: ["Commercial service mix", "10-75 employees"],
    nice_to_have: ["Dispatch software in use"],
    disqualifiers: ["Residential-only", "Franchise HQ"],
  },
  firmographic_filters: {
    industries: ["HVAC", "Commercial refrigeration"],
    employee_ranges: ["10-75"],
    revenue_ranges: ["$2M-$25M"],
    geographies: ["Texas", "Tennessee", "Illinois"],
    business_models: ["B2B commercial service contractor"],
  },
  technology_filters: {
    required: [],
    preferred: ["Housecall Pro", "ServiceTitan"],
    excluded: ["Salesforce-only SaaS"],
  },
  target_roles: {
    primary: ["Owner", "General Manager"],
    secondary: ["Operations Manager"],
    avoid: ["Intern", "Franchise corporate"],
  },
  pain_point_patterns: ["manual dispatch", "paper work orders"],
  buying_trigger_patterns: ["new ops manager", "fleet expansion"],
  search_patterns: [
    "HVAC contractor 20 employees Texas",
    "commercial refrigeration service Illinois",
    "field service dispatch software Tennessee HVAC",
  ],
  negative_search_patterns: ["residential only HVAC", "franchise headquarters HVAC"],
  fit_scoring_weights: {
    industry_fit: 25,
    company_size: 20,
    technology_fit: 15,
    pain_alignment: 20,
    buying_signal_strength: 10,
    title_match: 10,
  },
  confidence_rules: {
    high_fit: "Meets all must_have with no disqualifiers and 2+ buying triggers.",
    medium_fit: "Meets must_have with one nice_to_have gap.",
    low_fit: "Missing must_have or hits disqualifier.",
  },
})

const parsed = parseGrowthLeadEngineIcpTargetingOutput(validJson)
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.search_patterns.length, 3)
  assert.equal(
    Object.values(parsed.output.fit_scoring_weights).reduce((sum, value) => sum + value, 0),
    100,
  )
}

const badWeights = parseGrowthLeadEngineIcpTargetingOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    fit_scoring_weights: {
      industry_fit: 10,
      company_size: 10,
      technology_fit: 10,
      pain_alignment: 10,
      buying_signal_strength: 10,
      title_match: 10,
    },
  }),
)
assert.equal(badWeights.ok, false)

const promptFile = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/icp-targeting-prompt.ts"),
  "utf8",
)
assert.match(promptFile, /ICP Intelligence Engine/)
assert.match(promptFile, /GROWTH_LEAD_ENGINE_ICP_TARGETING_TEMPLATE_PLACEHOLDERS/)

console.log("growth-lead-engine-icp-targeting-v1 checks passed")

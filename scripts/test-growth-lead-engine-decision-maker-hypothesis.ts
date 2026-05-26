/**
 * Regression checks for Lead Engine Decision Maker Hypothesis Engine (Prompt 3).
 * Run: pnpm test:growth-lead-engine-decision-maker-hypothesis
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineDecisionMakerHypothesisSystemPrompt,
  buildGrowthLeadEngineDecisionMakerHypothesisTemplateUserPrompt,
  buildGrowthLeadEngineDecisionMakerHypothesisUserPrompt,
  GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/decision-maker-hypothesis-prompt"
import { parseGrowthLeadEngineDecisionMakerHypothesisOutput } from "../lib/growth/lead-engine/decision-maker-hypothesis-parse"
import {
  GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_QA_MARKER,
  GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS,
} from "../lib/growth/lead-engine/decision-maker-hypothesis-types"

assert.equal(
  GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_QA_MARKER,
  "lead-engine-decision-maker-hypothesis-v1",
)
assert.equal(GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS.length, 6)
assert.equal(GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_OUTPUT_JSON_KEYS.length, 7)

const systemPrompt = buildGrowthLeadEngineDecisionMakerHypothesisSystemPrompt()
assert.match(systemPrompt, /Do NOT invent people/)
assert.match(systemPrompt, /Do NOT invent contacts/)
assert.match(systemPrompt, /Do NOT invent names/)
assert.match(systemPrompt, /Do NOT invent emails/)
assert.match(systemPrompt, /Do NOT create outreach/)
assert.match(systemPrompt, /buying_committee/)
assert.match(systemPrompt, /owner_patterns/)
assert.match(systemPrompt, /Operations Manager/)
assert.match(systemPrompt, /Biomedical Director/)
assert.match(systemPrompt, /committee_completeness/)
assert.doesNotMatch(systemPrompt, /fabricate contacts|draft outreach|guess the name of/i)

const sampleIcp = {
  icp_summary: "Medical equipment service companies serving hospitals.",
  qualification_rules: { must_have: ["Biomedical service"], nice_to_have: [], disqualifiers: [] },
  firmographic_filters: {
    industries: ["Medical equipment service"],
    employee_ranges: ["25-150"],
    revenue_ranges: [],
    geographies: ["US"],
    business_models: ["B2B field service"],
  },
  technology_filters: { required: [], preferred: [], excluded: [] },
  target_roles: {
    primary: ["Operations Director", "Biomedical Director"],
    secondary: ["Field Service Manager", "Clinical Engineering"],
    avoid: ["Intern", "Billing clerk"],
  },
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

const sampleDiscovery = {
  company_profile: {
    company_name: "Precision Biomedical Services",
    domain: "precisionbiomed.example",
    industry: "Medical equipment service",
    sub_industry: "Biomedical maintenance",
    business_model: "B2B field service",
    service_area: ["Midwest"],
    headquarters: "Chicago, IL",
    employee_estimate: "45",
    revenue_estimate: null,
    phone: "",
    address: "",
    social_links: [],
  },
  fit_assessment: {
    fit_score: 82,
    fit_tier: "high",
    confidence: 0.78,
    matched_icp_rules: ["Biomedical service"],
    missing_evidence: [],
    disqualifiers: [],
  },
  signals: {
    positive_fit_signals: ["Hospital service mix"],
    negative_fit_signals: [],
    pain_signals: ["Dispatch coordination"],
    buying_triggers: [],
    technology_signals: [],
    growth_signals: [],
  },
  recommended_next_step: {
    action: "Promote to prospect queue",
    reason: "Strong biomedical service fit.",
  },
  source_evidence: [
    {
      claim: "Biomedical maintenance services",
      evidence: "biomedical equipment maintenance",
      source: "website_text",
    },
  ],
}

const userPrompt = buildGrowthLeadEngineDecisionMakerHypothesisUserPrompt({
  icpTargeting: sampleIcp,
  companyDiscovery: sampleDiscovery,
})
assert.match(userPrompt, /Precision Biomedical Services/)
assert.match(userPrompt, /Operations Director/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineDecisionMakerHypothesisTemplateUserPrompt()
assert.ok(
  templatePrompt.includes(GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_TEMPLATE_PLACEHOLDERS.icp_targeting_json),
)
assert.ok(
  templatePrompt.includes(
    GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_TEMPLATE_PLACEHOLDERS.company_discovery_json,
  ),
)

const validJson = JSON.stringify({
  recommended_targeting_strategy: {
    primary_motion: "Operations-led service expansion",
    reason: "ICP and discovery evidence point to field service and hospital maintenance motion.",
  },
  buying_committee: {
    primary_targets: [
      {
        role: "Operations Director",
        confidence: 0.88,
        reason: "Listed in ICP primary roles; medium company with 45 employees.",
      },
      {
        role: "Biomedical Director",
        confidence: 0.84,
        reason: "Industry pattern for medical equipment service; matched ICP primary.",
      },
    ],
    secondary_targets: [
      {
        role: "Field Service Manager",
        confidence: 0.76,
        reason: "ICP secondary role; dispatch pain signal supports service leadership.",
      },
      {
        role: "Clinical Engineering",
        confidence: 0.7,
        reason: "Hospital-facing technical influencer per ICP secondary roles.",
      },
    ],
    avoid_roles: [
      {
        role: "Intern",
        reason: "ICP avoid list; no buying authority.",
      },
    ],
  },
  role_patterns: {
    owner_patterns: [],
    operations_patterns: ["Operations Director", "Director of Operations"],
    service_patterns: ["Field Service Manager", "Service Manager"],
    executive_patterns: ["Executive sponsor", "VP Operations"],
    procurement_patterns: ["Hospital Procurement", "Procurement Manager"],
    technical_patterns: ["Biomedical Director", "Clinical Engineering"],
  },
  committee_completeness: {
    recommended_contacts: 5,
    minimum_contacts: 3,
    critical_missing_roles: ["Hospital Procurement"],
  },
  escalation_path: [
    "Field Service Manager",
    "Operations Director",
    "Biomedical Director",
    "Executive sponsor",
  ],
  engagement_priority: [
    "Operations Director",
    "Biomedical Director",
    "Field Service Manager",
    "Clinical Engineering",
  ],
  confidence_assessment: {
    score: 78,
    reasoning: [
      "Strong ICP role alignment",
      "Employee estimate supports medium-company committee sizing",
    ],
  },
})

const parsed = parseGrowthLeadEngineDecisionMakerHypothesisOutput(validJson)
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.buying_committee.primary_targets.length, 2)
  assert.equal(parsed.output.buying_committee.primary_targets[0]!.confidence, 0.88)
  assert.equal(parsed.output.role_patterns.operations_patterns.length, 2)
  assert.equal(parsed.output.committee_completeness.recommended_contacts, 5)
}

const rejectsEmail = parseGrowthLeadEngineDecisionMakerHypothesisOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    buying_committee: {
      ...JSON.parse(validJson).buying_committee,
      primary_targets: [
        { role: "jane.doe@hospital.org", confidence: 0.9, reason: "Known contact" },
      ],
    },
  }),
)
assert.equal(rejectsEmail.ok, false)

const missingPrimary = parseGrowthLeadEngineDecisionMakerHypothesisOutput(
  JSON.stringify({
    ...JSON.parse(validJson),
    buying_committee: {
      ...JSON.parse(validJson).buying_committee,
      primary_targets: [],
    },
  }),
)
assert.equal(missingPrimary.ok, false)

const promptFile = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/decision-maker-hypothesis-prompt.ts"),
  "utf8",
)
assert.match(promptFile, /Decision Maker Hypothesis Engine/)
assert.match(promptFile, /GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_TEMPLATE_PLACEHOLDERS/)

console.log("growth-lead-engine-decision-maker-hypothesis-v1 checks passed")

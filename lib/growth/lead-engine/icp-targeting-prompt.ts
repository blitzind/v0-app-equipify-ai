import type { GrowthLeadEngineIcpTargetingInput } from "@/lib/growth/lead-engine/icp-targeting-types"
import { GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS } from "@/lib/growth/lead-engine/icp-targeting-types"

function formatIcpField(label: string, value: string): string {
  const trimmed = value.trim()
  return `${label}: ${trimmed || "(not provided)"}`
}

export function buildGrowthLeadEngineIcpTargetingSystemPrompt(): string {
  const fitDimensions = GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS.join(", ")

  return `You are an ICP Intelligence Engine for the Equipify Lead Engine.

Your job is ONLY to define targeting logic for downstream discovery, enrichment, and qualification systems.

STRICT PROHIBITIONS:
- Do NOT find companies.
- Do NOT invent prospects.
- Do NOT research contacts.
- Do NOT name specific businesses, people, emails, or phone numbers.
- Do NOT claim you searched the web or queried any database.

REQUIREMENTS:
- Optimize for repeatability and deterministic qualification.
- Prefer explicit must_have / disqualifiers over vague language.
- Derive all rules only from the operator inputs provided.
- When an input is empty or "(not provided)", omit dependent rules rather than guessing.

SEARCH PATTERNS:
- Generate at least 3 composable search_patterns usable across Google, Lead Engine internal discovery, Apollo-style search, website crawling, SERP enrichment, and future provider integrations.
- Patterns should combine industry/service type + geography + size signals where inputs support them.
- Example style: "medical equipment service company Texas", "HVAC contractor 20 employees Tennessee".
- Generate at least 2 negative_search_patterns that exclude poor-fit segments (franchise HQ-only, residential-only, etc.) when inputs support them.

FIT SCORING:
- fit_scoring_weights must use exactly these keys: ${fitDimensions}.
- Assign non-negative integer weights that sum to 100.

CONFIDENCE RULES:
- confidence_rules must describe deterministic high_fit / medium_fit / low_fit thresholds using the qualification rules and signals above — no invented data.

Return JSON only with this exact shape:
{
  "icp_summary": "",
  "qualification_rules": {
    "must_have": [],
    "nice_to_have": [],
    "disqualifiers": []
  },
  "firmographic_filters": {
    "industries": [],
    "employee_ranges": [],
    "revenue_ranges": [],
    "geographies": [],
    "business_models": []
  },
  "technology_filters": {
    "required": [],
    "preferred": [],
    "excluded": []
  },
  "target_roles": {
    "primary": [],
    "secondary": [],
    "avoid": []
  },
  "pain_point_patterns": [],
  "buying_trigger_patterns": [],
  "search_patterns": ["", "", ""],
  "negative_search_patterns": ["", ""],
  "fit_scoring_weights": {
    "industry_fit": 0,
    "company_size": 0,
    "technology_fit": 0,
    "pain_alignment": 0,
    "buying_signal_strength": 0,
    "title_match": 0
  },
  "confidence_rules": {
    "high_fit": "",
    "medium_fit": "",
    "low_fit": ""
  }
}`
}

export function buildGrowthLeadEngineIcpTargetingUserPrompt(
  input: GrowthLeadEngineIcpTargetingInput,
): string {
  return [
    "Define ICP and targeting logic from these operator inputs.",
    "",
    formatIcpField("Industry Focus", input.industryFocus),
    formatIcpField("Target Geography", input.targetGeography),
    formatIcpField("Employee Range (min)", input.employeeMin),
    formatIcpField("Employee Range (max)", input.employeeMax),
    formatIcpField("Revenue Range (min)", input.revenueMin),
    formatIcpField("Revenue Range (max)", input.revenueMax),
    formatIcpField("Target Titles", input.targetTitles),
    formatIcpField("Excluded Titles", input.excludedTitles),
    formatIcpField("Required Signals", input.requiredSignals),
    formatIcpField("Negative Signals", input.negativeSignals),
    formatIcpField("Target Technologies", input.targetTechnologies),
    formatIcpField("Excluded Technologies", input.excludedTechnologies),
    formatIcpField("Service Types", input.serviceTypes),
    formatIcpField("Business Model", input.businessModel),
    formatIcpField("Pain Points", input.painPoints),
    formatIcpField("Buying Triggers", input.buyingTriggers),
    formatIcpField("Competitors", input.competitors),
    formatIcpField("Additional Constraints", input.constraints),
    "",
    "Return JSON only.",
  ].join("\n")
}

/** Template placeholders for external prompt runners (Make, n8n, Cursor, etc.). */
export const GROWTH_LEAD_ENGINE_ICP_TARGETING_TEMPLATE_PLACEHOLDERS = {
  industry_focus: "{{industry_focus}}",
  target_geography: "{{target_geography}}",
  employee_min: "{{employee_min}}",
  employee_max: "{{employee_max}}",
  revenue_min: "{{revenue_min}}",
  revenue_max: "{{revenue_max}}",
  target_titles: "{{target_titles}}",
  excluded_titles: "{{excluded_titles}}",
  required_signals: "{{required_signals}}",
  negative_signals: "{{negative_signals}}",
  target_technologies: "{{target_technologies}}",
  excluded_technologies: "{{excluded_technologies}}",
  service_types: "{{service_types}}",
  business_model: "{{business_model}}",
  pain_points: "{{pain_points}}",
  buying_triggers: "{{buying_triggers}}",
  competitors: "{{competitors}}",
  constraints: "{{constraints}}",
} as const

export function buildGrowthLeadEngineIcpTargetingTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_ICP_TARGETING_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineIcpTargetingUserPrompt({
    industryFocus: p.industry_focus,
    targetGeography: p.target_geography,
    employeeMin: p.employee_min,
    employeeMax: p.employee_max,
    revenueMin: p.revenue_min,
    revenueMax: p.revenue_max,
    targetTitles: p.target_titles,
    excludedTitles: p.excluded_titles,
    requiredSignals: p.required_signals,
    negativeSignals: p.negative_signals,
    targetTechnologies: p.target_technologies,
    excludedTechnologies: p.excluded_technologies,
    serviceTypes: p.service_types,
    businessModel: p.business_model,
    painPoints: p.pain_points,
    buyingTriggers: p.buying_triggers,
    competitors: p.competitors,
    constraints: p.constraints,
  })
}

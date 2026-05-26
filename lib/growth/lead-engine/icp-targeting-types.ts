/** Lead Engine slice — ICP + Targeting Engine types (Prompt 1). Client-safe. */

export const GROWTH_LEAD_ENGINE_ICP_TARGETING_QA_MARKER = "lead-engine-icp-targeting-v1" as const

export const GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS = [
  "industry_fit",
  "company_size",
  "technology_fit",
  "pain_alignment",
  "buying_signal_strength",
  "title_match",
] as const

export type GrowthLeadEngineIcpFitScoringDimension =
  (typeof GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS)[number]

/** Operator-provided targeting inputs — no company or contact records. */
export type GrowthLeadEngineIcpTargetingInput = {
  industryFocus: string
  targetGeography: string
  employeeMin: string
  employeeMax: string
  revenueMin: string
  revenueMax: string
  targetTitles: string
  excludedTitles: string
  requiredSignals: string
  negativeSignals: string
  targetTechnologies: string
  excludedTechnologies: string
  serviceTypes: string
  businessModel: string
  painPoints: string
  buyingTriggers: string
  competitors: string
  constraints: string
}

export type GrowthLeadEngineIcpQualificationRules = {
  must_have: string[]
  nice_to_have: string[]
  disqualifiers: string[]
}

export type GrowthLeadEngineIcpFirmographicFilters = {
  industries: string[]
  employee_ranges: string[]
  revenue_ranges: string[]
  geographies: string[]
  business_models: string[]
}

export type GrowthLeadEngineIcpTechnologyFilters = {
  required: string[]
  preferred: string[]
  excluded: string[]
}

export type GrowthLeadEngineIcpTargetRoles = {
  primary: string[]
  secondary: string[]
  avoid: string[]
}

export type GrowthLeadEngineIcpFitScoringWeights = Record<GrowthLeadEngineIcpFitScoringDimension, number>

export type GrowthLeadEngineIcpConfidenceRules = {
  high_fit: string
  medium_fit: string
  low_fit: string
}

/** Deterministic targeting logic output — no invented companies or contacts. */
export type GrowthLeadEngineIcpTargetingOutput = {
  icp_summary: string
  qualification_rules: GrowthLeadEngineIcpQualificationRules
  firmographic_filters: GrowthLeadEngineIcpFirmographicFilters
  technology_filters: GrowthLeadEngineIcpTechnologyFilters
  target_roles: GrowthLeadEngineIcpTargetRoles
  pain_point_patterns: string[]
  buying_trigger_patterns: string[]
  search_patterns: string[]
  negative_search_patterns: string[]
  fit_scoring_weights: GrowthLeadEngineIcpFitScoringWeights
  confidence_rules: GrowthLeadEngineIcpConfidenceRules
}

export const GROWTH_LEAD_ENGINE_ICP_TARGETING_OUTPUT_JSON_KEYS = [
  "icp_summary",
  "qualification_rules",
  "firmographic_filters",
  "technology_filters",
  "target_roles",
  "pain_point_patterns",
  "buying_trigger_patterns",
  "search_patterns",
  "negative_search_patterns",
  "fit_scoring_weights",
  "confidence_rules",
] as const

import {
  GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS,
  GROWTH_LEAD_ENGINE_ICP_TARGETING_OUTPUT_JSON_KEYS,
  type GrowthLeadEngineIcpFitScoringWeights,
  type GrowthLeadEngineIcpTargetingOutput,
} from "@/lib/growth/lead-engine/icp-targeting-types"

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRuleGroup(value: unknown): GrowthLeadEngineIcpTargetingOutput["qualification_rules"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    must_have: asStringArray(group.must_have),
    nice_to_have: asStringArray(group.nice_to_have),
    disqualifiers: asStringArray(group.disqualifiers),
  }
}

function asFirmographicFilters(
  value: unknown,
): GrowthLeadEngineIcpTargetingOutput["firmographic_filters"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    industries: asStringArray(group.industries),
    employee_ranges: asStringArray(group.employee_ranges),
    revenue_ranges: asStringArray(group.revenue_ranges),
    geographies: asStringArray(group.geographies),
    business_models: asStringArray(group.business_models),
  }
}

function asTechnologyFilters(
  value: unknown,
): GrowthLeadEngineIcpTargetingOutput["technology_filters"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    required: asStringArray(group.required),
    preferred: asStringArray(group.preferred),
    excluded: asStringArray(group.excluded),
  }
}

function asTargetRoles(value: unknown): GrowthLeadEngineIcpTargetingOutput["target_roles"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    primary: asStringArray(group.primary),
    secondary: asStringArray(group.secondary),
    avoid: asStringArray(group.avoid),
  }
}

function asFitScoringWeights(value: unknown): GrowthLeadEngineIcpFitScoringWeights {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const weights = {} as GrowthLeadEngineIcpFitScoringWeights
  for (const key of GROWTH_LEAD_ENGINE_ICP_FIT_SCORING_DIMENSIONS) {
    const raw = group[key]
    weights[key] = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0
  }
  return weights
}

function asConfidenceRules(value: unknown): GrowthLeadEngineIcpTargetingOutput["confidence_rules"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    high_fit: asString(group.high_fit),
    medium_fit: asString(group.medium_fit),
    low_fit: asString(group.low_fit),
  }
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

export function parseGrowthLeadEngineIcpTargetingOutput(
  raw: string,
): { ok: true; output: GrowthLeadEngineIcpTargetingOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "ICP targeting response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const output: GrowthLeadEngineIcpTargetingOutput = {
      icp_summary: asString(record.icp_summary),
      qualification_rules: asRuleGroup(record.qualification_rules),
      firmographic_filters: asFirmographicFilters(record.firmographic_filters),
      technology_filters: asTechnologyFilters(record.technology_filters),
      target_roles: asTargetRoles(record.target_roles),
      pain_point_patterns: asStringArray(record.pain_point_patterns),
      buying_trigger_patterns: asStringArray(record.buying_trigger_patterns),
      search_patterns: asStringArray(record.search_patterns),
      negative_search_patterns: asStringArray(record.negative_search_patterns),
      fit_scoring_weights: asFitScoringWeights(record.fit_scoring_weights),
      confidence_rules: asConfidenceRules(record.confidence_rules),
    }

    if (!output.icp_summary) {
      return { ok: false, message: "ICP targeting response missing icp_summary." }
    }
    if (output.search_patterns.length < 3) {
      return { ok: false, message: "ICP targeting response must include at least 3 search_patterns." }
    }

    const weightSum = Object.values(output.fit_scoring_weights).reduce((sum, value) => sum + value, 0)
    if (weightSum !== 100) {
      return { ok: false, message: `fit_scoring_weights must sum to 100 (got ${weightSum}).` }
    }

    return { ok: true, output }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse ICP targeting JSON.",
    }
  }
}

export function assertGrowthLeadEngineIcpTargetingOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_ICP_TARGETING_OUTPUT_JSON_KEYS
}

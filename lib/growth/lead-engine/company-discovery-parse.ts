import {
  GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS,
  type GrowthLeadEngineCompanyDiscoveryOutput,
  type GrowthLeadEngineCompanyFitTier,
} from "@/lib/growth/lead-engine/company-discovery-types"

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const trimmed = asString(value)
  return trimmed || null
}

function asFitTier(value: unknown): GrowthLeadEngineCompanyFitTier {
  const raw = asString(value).toLowerCase()
  return GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS.includes(raw as GrowthLeadEngineCompanyFitTier)
    ? (raw as GrowthLeadEngineCompanyFitTier)
    : "low"
}

function asScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
}

function asCompanyProfile(value: unknown): GrowthLeadEngineCompanyDiscoveryOutput["company_profile"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    company_name: asString(group.company_name),
    domain: asString(group.domain),
    industry: asString(group.industry),
    sub_industry: asString(group.sub_industry),
    business_model: asString(group.business_model),
    service_area: asStringArray(group.service_area),
    headquarters: asString(group.headquarters),
    employee_estimate: asNullableString(group.employee_estimate),
    revenue_estimate: asNullableString(group.revenue_estimate),
    phone: asString(group.phone),
    address: asString(group.address),
    social_links: asStringArray(group.social_links),
  }
}

function asFitAssessment(value: unknown): GrowthLeadEngineCompanyDiscoveryOutput["fit_assessment"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    fit_score: asScore(group.fit_score),
    fit_tier: asFitTier(group.fit_tier),
    confidence: asConfidence(group.confidence),
    matched_icp_rules: asStringArray(group.matched_icp_rules),
    missing_evidence: asStringArray(group.missing_evidence),
    disqualifiers: asStringArray(group.disqualifiers),
  }
}

function asSignals(value: unknown): GrowthLeadEngineCompanyDiscoveryOutput["signals"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    positive_fit_signals: asStringArray(group.positive_fit_signals),
    negative_fit_signals: asStringArray(group.negative_fit_signals),
    pain_signals: asStringArray(group.pain_signals),
    buying_triggers: asStringArray(group.buying_triggers),
    technology_signals: asStringArray(group.technology_signals),
    growth_signals: asStringArray(group.growth_signals),
  }
}

function asRecommendedNextStep(
  value: unknown,
): GrowthLeadEngineCompanyDiscoveryOutput["recommended_next_step"] {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    action: asString(group.action),
    reason: asString(group.reason),
  }
}

function asSourceEvidence(value: unknown): GrowthLeadEngineCompanyDiscoveryOutput["source_evidence"] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      return {
        claim: asString(row.claim),
        evidence: asString(row.evidence),
        source: asString(row.source),
      }
    })
    .filter((row) => row.claim.length > 0 || row.evidence.length > 0)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

export function parseGrowthLeadEngineCompanyDiscoveryOutput(
  raw: string,
): { ok: true; output: GrowthLeadEngineCompanyDiscoveryOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Company discovery response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const output: GrowthLeadEngineCompanyDiscoveryOutput = {
      company_profile: asCompanyProfile(record.company_profile),
      fit_assessment: asFitAssessment(record.fit_assessment),
      signals: asSignals(record.signals),
      recommended_next_step: asRecommendedNextStep(record.recommended_next_step),
      source_evidence: asSourceEvidence(record.source_evidence),
    }

    if (!output.company_profile.company_name) {
      return { ok: false, message: "Company discovery response missing company_profile.company_name." }
    }
    if (!output.recommended_next_step.action) {
      return { ok: false, message: "Company discovery response missing recommended_next_step.action." }
    }

    return { ok: true, output }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse company discovery JSON.",
    }
  }
}

export function assertGrowthLeadEngineCompanyDiscoveryOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_OUTPUT_JSON_KEYS
}

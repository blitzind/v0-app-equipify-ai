import type { GrowthCompanyEnrichmentProviderResult } from "@/lib/growth/enrichment/enrichment-provider-types"
import {
  scoreCompanyEnrichmentConfidence,
  topAttributionTier,
} from "@/lib/growth/enrichment/verification-confidence"
import type { GrowthCompanyEnrichment } from "@/lib/growth/enrichment/enrichment-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => asString(v)).filter(Boolean)
}

export function normalizeCompanyEnrichmentResult(
  raw: GrowthCompanyEnrichmentProviderResult,
  provider_name: string,
  provider_type: string,
): Omit<GrowthCompanyEnrichment, "id" | "created_at" | "updated_at"> {
  const tiers = raw.source_attribution.map((a) => a.tier)
  const signal_count =
    raw.technology_signals.length +
    raw.crm_signals.length +
    raw.service_signals.length +
    raw.location_signals.length

  const confidence = scoreCompanyEnrichmentConfidence({
    signal_count,
    top_tier: topAttributionTier(tiers),
    has_industry: Boolean(raw.industry),
  })

  return {
    company_candidate_id: raw.company_candidate_id,
    provider_name,
    provider_type,
    employee_estimate: asString(raw.employee_estimate) || null,
    revenue_estimate: asString(raw.revenue_estimate) || null,
    industry: asString(raw.industry) || null,
    subindustry: asString(raw.subindustry) || null,
    technology_signals: stringArray(raw.technology_signals),
    crm_signals: stringArray(raw.crm_signals),
    service_signals: stringArray(raw.service_signals),
    location_signals: stringArray(raw.location_signals),
    confidence,
    evidence: raw.evidence,
    source_attribution: raw.source_attribution,
    metadata: {
      dedupe_hash: `${raw.company_candidate_id}:${provider_name}`,
      ...(raw.raw_payload ? { raw_payload: raw.raw_payload } : {}),
    },
  }
}

export function mergeCompanyEnrichments(
  rows: GrowthCompanyEnrichment[],
): GrowthCompanyEnrichment | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => b.confidence - a.confidence)[0]!
}

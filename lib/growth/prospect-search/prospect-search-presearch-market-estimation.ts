/** Pre-search market estimation — broad tiers, not post-filter validation. Client-safe. */

import { countActiveProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-estimation-format"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER = "growth-market-estimation-tier-v1" as const
export const GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER =
  "growth-presearch-estimation-vs-results-v1" as const
export const GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER = "growth-no-false-negative-estimates-v1" as const

export const GROWTH_MARKET_ESTIMATION_TIERS = [
  "tiny",
  "small",
  "moderate",
  "large",
  "massive",
] as const

export type GrowthMarketEstimationTier = (typeof GROWTH_MARKET_ESTIMATION_TIERS)[number]

export type GrowthPresearchMarketEstimateSource =
  | "industry_breadth"
  | "query_category"
  | "provider_searchability"
  | "indexed_hint"
  | "territory_density"
  | "filter_restrictiveness"
  | "market_heuristic"

export type GrowthPresearchMarketEstimate = {
  qa_marker: typeof GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER
  presearch_marker: typeof GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER
  false_negative_guard_marker: typeof GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER
  phase: "presearch"
  tier: GrowthMarketEstimationTier
  headline: string
  helper: string
  confidence_label: string
  display_label: string
  indexed_count_hint: number | null
  impossibly_restrictive: boolean
  broad_market_category: boolean
  sources: GrowthPresearchMarketEstimateSource[]
}

const BROAD_MARKET_PATTERNS: RegExp[] = [
  /medical equipment/i,
  /biomedical/i,
  /healthcare field service/i,
  /healthcare/i,
  /hvac/i,
  /electrical/i,
  /plumbing/i,
  /commercial cleaning/i,
  /roofing/i,
  /it services/i,
  /field service/i,
  /garage door/i,
  /locksmith/i,
  /mep/i,
  /property management/i,
  /medical device/i,
  /contractor/i,
  /service compan/i,
]

const TIER_ORDER: GrowthMarketEstimationTier[] = [
  "tiny",
  "small",
  "moderate",
  "large",
  "massive",
]

const TIER_COPY: Record<
  GrowthMarketEstimationTier,
  { headline: string; helper: string; confidence_label: string }
> = {
  tiny: {
    headline: "Tiny market",
    helper: "Likely a very narrow slice — consider broadening filters before search.",
    confidence_label: "Narrow estimate",
  },
  small: {
    headline: "Small market",
    helper: "Likely dozens of companies in this slice.",
    confidence_label: "Limited structured data available",
  },
  moderate: {
    headline: "Moderate market",
    helper: "Likely hundreds of companies.",
    confidence_label: "Estimate based on market heuristics",
  },
  large: {
    headline: "Large market",
    helper: "Likely thousands of companies.",
    confidence_label: "Broad estimate",
  },
  massive: {
    headline: "Massive market",
    helper: "Wide search coverage expected — likely thousands of companies.",
    confidence_label: "Broad estimate",
  },
}

function tierIndex(tier: GrowthMarketEstimationTier): number {
  return TIER_ORDER.indexOf(tier)
}

function maxTier(a: GrowthMarketEstimationTier, b: GrowthMarketEstimationTier): GrowthMarketEstimationTier {
  return tierIndex(a) >= tierIndex(b) ? a : b
}

function minTier(a: GrowthMarketEstimationTier, b: GrowthMarketEstimationTier): GrowthMarketEstimationTier {
  return tierIndex(a) <= tierIndex(b) ? a : b
}

function marketHaystack(query: string, filters: GrowthProspectSearchFilters): string {
  return [
    query,
    filters.industry,
    filters.subindustry,
    filters.location,
    filters.service_area,
    ...(filters.keywords ?? []),
    ...(filters.technologies ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase()
}

const KNOWN_BROAD_INDUSTRIES = [
  "HVAC",
  "Biomedical",
  "Medical Equipment Service",
  "Electrical",
  "MEP",
  "Garage Door",
  "Locksmith",
  "Commercial Equipment",
  "Field Service",
  "Property Management",
  "Healthcare Field Service",
  "Medical Device Repair",
  "Plumbing",
  "Commercial Cleaning",
  "Roofing",
  "IT Services",
] as const

export function isBroadMarketCategory(query: string, filters: GrowthProspectSearchFilters): boolean {
  const haystack = marketHaystack(query, filters)
  if (BROAD_MARKET_PATTERNS.some((pattern) => pattern.test(haystack))) return true
  const industry = filters.industry?.trim().toLowerCase() ?? ""
  return KNOWN_BROAD_INDUSTRIES.some(
    (label) =>
      industry.includes(label.toLowerCase()) ||
      label.toLowerCase().includes(industry) ||
      haystack.includes(label.toLowerCase()),
  )
}

export function isImpossiblyRestrictivePresearchFilters(
  query: string,
  filters: GrowthProspectSearchFilters,
): boolean {
  const active = countActiveProspectSearchFilters(filters)
  const haystack = marketHaystack(query, filters)
  const hasMarketSignal = haystack.trim().length >= 3 || isBroadMarketCategory(query, filters)

  if (!hasMarketSignal && active >= 6) return true

  const strictExternalStructured =
    (filters.revenue_bands?.length ?? 0) > 0 &&
    (filters.employee_size_bands?.length ?? 0) > 0 &&
    (filters.lead_score_min ?? 0) > 0 &&
    (filters.buying_stages?.length ?? 0) > 0 &&
    (filters.company_identification_confidence_min ?? 0) >= 70

  if (strictExternalStructured && active >= 7 && !isBroadMarketCategory(query, filters)) return true

  return false
}

function tierFromIndexedHint(count: number | null | undefined): GrowthMarketEstimationTier | null {
  if (count == null || !Number.isFinite(count)) return null
  if (count >= 10000) return "massive"
  if (count >= 2500) return "large"
  if (count >= 500) return "moderate"
  if (count >= 50) return "small"
  if (count > 0) return "tiny"
  return null
}

function tierFromBreadth(query: string, filters: GrowthProspectSearchFilters): GrowthMarketEstimationTier {
  if (isBroadMarketCategory(query, filters)) return "large"

  const haystack = marketHaystack(query, filters)
  if (!haystack.trim()) return "moderate"

  const tokens = haystack.split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) return "moderate"
  if (tokens.length >= 4) return "small"
  return "moderate"
}

function applyTerritoryAdjustment(
  tier: GrowthMarketEstimationTier,
  filters: GrowthProspectSearchFilters,
): GrowthMarketEstimationTier {
  const territory = filters.territory_filter
  const hasTerritory =
    Boolean(territory?.states?.length) ||
    Boolean(territory?.cities?.length) ||
    Boolean(territory?.metros?.length) ||
    Boolean(territory?.postal_codes?.length) ||
    Boolean(territory?.radius) ||
    Boolean(filters.location?.trim())

  if (!hasTerritory) return tier
  if (tier === "massive") return "large"
  if (tier === "large") return "moderate"
  return minTier(tier, "small")
}

function applyExternalStructuredPenalty(
  tier: GrowthMarketEstimationTier,
  filters: GrowthProspectSearchFilters,
  discovery_mode: GrowthProspectSearchDiscoveryMode,
): GrowthMarketEstimationTier {
  if (discovery_mode !== "discover_external") return tier

  let adjusted = tier
  const structuredFilters =
    (filters.employee_size_bands?.length ?? 0) > 0 ||
    (filters.revenue_bands?.length ?? 0) > 0 ||
    (filters.technologies?.length ?? 0) > 0 ||
    (filters.lead_score_min ?? 0) > 0 ||
    (filters.buying_stages?.length ?? 0) > 0

  if (structuredFilters && tierIndex(adjusted) > tierIndex("moderate")) {
    adjusted = "moderate"
  }

  return adjusted
}

function applyRestrictivenessFloor(
  tier: GrowthMarketEstimationTier,
  query: string,
  filters: GrowthProspectSearchFilters,
): GrowthMarketEstimationTier {
  if (isBroadMarketCategory(query, filters)) {
    return maxTier(tier, "large")
  }
  return tier
}

export function computePresearchMarketEstimate(input: {
  query: string
  filters: GrowthProspectSearchFilters
  discovery_mode: GrowthProspectSearchDiscoveryMode
  indexed_count_hint?: number | null
  provider_searchable?: boolean
}): GrowthPresearchMarketEstimate {
  const sources: GrowthPresearchMarketEstimateSource[] = []
  const broad_market_category = isBroadMarketCategory(input.query, input.filters)
  const impossibly_restrictive = isImpossiblyRestrictivePresearchFilters(input.query, input.filters)

  if (broad_market_category) sources.push("industry_breadth")
  if (input.query.trim()) sources.push("query_category")
  if (input.provider_searchable !== false && input.discovery_mode === "discover_external") {
    sources.push("provider_searchability")
  }

  let tier: GrowthMarketEstimationTier = tierFromBreadth(input.query, input.filters)
  sources.push("market_heuristic")

  const indexedTier = tierFromIndexedHint(input.indexed_count_hint)
  if (indexedTier) {
    tier = maxTier(tier, indexedTier)
    sources.push("indexed_hint")
  }

  tier = applyTerritoryAdjustment(tier, input.filters)
  if (input.filters.territory_filter || input.filters.location) sources.push("territory_density")

  tier = applyExternalStructuredPenalty(tier, input.filters, input.discovery_mode)
  if (countActiveProspectSearchFilters(input.filters) >= 3) sources.push("filter_restrictiveness")

  tier = applyRestrictivenessFloor(tier, input.query, input.filters)

  if (impossibly_restrictive) {
    tier = minTier(tier, "tiny")
  } else if (broad_market_category) {
    tier = maxTier(tier, "large")
  }

  const copy = TIER_COPY[tier]
  const external = input.discovery_mode === "discover_external"
  const helper = external
    ? `${copy.helper} Broad external discovery expected — runs only when you click Search.`
    : `${copy.helper} Based on indexed CRM and Growth Engine coverage.`

  return {
    qa_marker: GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER,
    presearch_marker: GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER,
    false_negative_guard_marker: GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER,
    phase: "presearch",
    tier,
    headline: copy.headline,
    helper,
    confidence_label: copy.confidence_label,
    display_label: copy.headline,
    indexed_count_hint: input.indexed_count_hint ?? null,
    impossibly_restrictive,
    broad_market_category,
    sources,
  }
}

export function formatPresearchMarketHeadline(
  estimate: Pick<
    GrowthPresearchMarketEstimate,
    "headline" | "helper" | "confidence_label" | "impossibly_restrictive" | "broad_market_category"
  >,
): { headline: string; helper: string; confidence_label: string } {
  if (estimate.impossibly_restrictive && !estimate.broad_market_category) {
    return {
      headline: "Very narrow market",
      helper: "Filters may be too restrictive — broaden ICP or run search to verify.",
      confidence_label: "Narrow estimate",
    }
  }

  return {
    headline: estimate.headline,
    helper: estimate.helper,
    confidence_label: estimate.confidence_label,
  }
}

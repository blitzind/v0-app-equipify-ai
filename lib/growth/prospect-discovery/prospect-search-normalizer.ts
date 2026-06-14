/** Normalize parsed intent into GrowthProspectSearchFilters (client-safe). */

import type { GrowthProspectSearchEmployeeSizeBand } from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  NormalizedProspectSearchIntent,
  ProspectSearchIntent,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

function employeeRangeToBands(range: string): GrowthProspectSearchEmployeeSizeBand[] {
  const lower = range.toLowerCase()
  if (lower.includes("enterprise") || lower.includes("1000")) return ["1000+"]
  const rangeMatch = lower.match(/(\d+)\s*-\s*(\d+)/)
  if (rangeMatch) {
    const min = Number(rangeMatch[1])
    const max = Number(rangeMatch[2])
    const bands: GrowthProspectSearchEmployeeSizeBand[] = []
    if (min <= 10 && max >= 1) bands.push("1-10")
    if (min <= 20 && max >= 11) bands.push("11-20")
    if (min <= 50 && max >= 21) bands.push("21-50")
    if (min <= 100 && max >= 51) bands.push("51-100")
    if (min <= 250 && max >= 101) bands.push("101-250")
    if (min <= 500 && max >= 251) bands.push("251-500")
    if (min <= 1000 && max >= 501) bands.push("501-1000")
    return bands.length ? bands : ["51-100"]
  }
  const plusMatch = lower.match(/(\d+)\+/)
  if (plusMatch) {
    const min = Number(plusMatch[1])
    if (min >= 1000) return ["1000+"]
    if (min >= 501) return ["501-1000", "1000+"]
    if (min >= 251) return ["251-500", "501-1000", "1000+"]
    if (min >= 101) return ["101-250", "251-500", "501-1000"]
    if (min >= 51) return ["51-100", "101-250", "251-500"]
    if (min >= 21) return ["21-50", "51-100", "101-250"]
    if (min >= 11) return ["11-20", "21-50", "51-100"]
    return ["1-10", "11-20", "21-50"]
  }
  return []
}

function primaryLocation(locations: string[]): string | null {
  if (locations.length === 0) return null
  if (locations.length <= 3) return locations.join(", ")
  return `${locations.slice(0, 3).join(", ")} (+${locations.length - 3} more)`
}

function mapRevenueBands(ranges: string[]): import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchRevenueBand[] {
  const allowed = new Set([
    "under_1m",
    "1m_5m",
    "5m_10m",
    "10m_50m",
    "50m_100m",
    "100m+",
  ])
  return ranges.filter((r): r is import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchRevenueBand =>
    allowed.has(r),
  )
}

function mapSignalsToGrowthFilters(signals: string[]): Partial<
  import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchFilters
> {
  const out: Partial<
    import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchFilters
  > = {}
  if (signals.includes("hiring")) {
    out.growth_signal_tiers = ["hot", "warm"]
    out.growth_signal_score_min = 40
  }
  if (signals.includes("website_intent")) {
    out.search_intent_categories = ["demo_intent", "pricing_research", "solution_aware"]
    out.intent_score_min = 30
  }
  if (signals.includes("funding") || signals.includes("expansion")) {
    out.growth_signal_tiers = ["hot", "warm"]
    out.company_intelligence_categories = ["hiring", "company_size"]
  }
  return out
}

/**
 * Convert ProspectSearchIntent into normalized intent + GrowthProspectSearchFilters.
 * Reuses existing prospect search filter contract — no duplicate stores.
 */
export function normalizeProspectSearchIntent(intent: ProspectSearchIntent): NormalizedProspectSearchIntent {
  const employeeBands = intent.employee_ranges.flatMap(employeeRangeToBands)
  const uniqueBands = [...new Set(employeeBands)] as GrowthProspectSearchEmployeeSizeBand[]

  const prospect_search_filters: import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchFilters =
    {
      industry: intent.industries[0] ?? null,
      subindustry: intent.industries[1] ?? null,
      location: primaryLocation(intent.locations),
      employee_size_bands: uniqueBands.length ? uniqueBands : undefined,
      revenue_bands: mapRevenueBands(intent.revenue_ranges).length
        ? mapRevenueBands(intent.revenue_ranges)
        : undefined,
      keywords: intent.keywords.length ? intent.keywords : undefined,
      technologies: intent.technologies.length ? intent.technologies : undefined,
      title_contains: intent.titles[0] ?? null,
      decision_maker_role: intent.titles.some((t) => /decision|director|owner|ceo|vp/i.test(t))
        ? intent.titles.find((t) => /decision|director|owner|ceo|vp/i.test(t)) ?? null
        : null,
      ...mapSignalsToGrowthFilters(intent.signals),
    }

  if (intent.company_characteristics.includes("servicing hospitals")) {
    prospect_search_filters.keywords = [
      ...(prospect_search_filters.keywords ?? []),
      "hospitals",
    ]
  }

  return {
    raw_query: intent.raw_query,
    industries: intent.industries,
    locations: intent.locations,
    employee_ranges: intent.employee_ranges,
    revenue_ranges: intent.revenue_ranges,
    titles: intent.titles,
    technologies: intent.technologies,
    keywords: intent.keywords,
    signals: intent.signals,
    exclusions: intent.exclusions,
    company_characteristics: intent.company_characteristics,
    prospect_search_filters,
  }
}

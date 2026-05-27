import type { GrowthBuyingStage } from "@/lib/growth/buying-stage/buying-stage-types"
import {
  GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS,
  GROWTH_PROSPECT_SEARCH_REVENUE_BANDS,
  type GrowthProspectSearchEmployeeSizeBand,
  type GrowthProspectSearchFilters,
  type GrowthProspectSearchRevenueBand,
} from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchIndexCompany } from "@/lib/growth/prospect-search/prospect-search-index"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function parseEmployeeCount(raw: string | null | undefined): number | null {
  const text = (raw ?? "").toLowerCase()
  const match = text.match(/(\d[\d,]*)/)
  if (!match) return null
  const n = Number(match[1].replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

export function inferEmployeeSizeBand(raw: string | null | undefined): GrowthProspectSearchEmployeeSizeBand {
  const n = parseEmployeeCount(raw)
  if (n == null) return "unknown"
  if (n <= 10) return "1-10"
  if (n <= 20) return "11-20"
  if (n <= 50) return "21-50"
  if (n <= 100) return "51-100"
  if (n <= 250) return "101-250"
  if (n <= 500) return "251-500"
  if (n <= 1000) return "501-1000"
  return "1000+"
}

export function inferRevenueBand(raw: string | null | undefined): GrowthProspectSearchRevenueBand {
  const text = (raw ?? "").toLowerCase()
  if (!text) return "unknown"
  if (text.includes("100m") || text.includes("100 m")) return "100m+"
  if (text.includes("50m") || text.includes("50 m")) return "50m_100m"
  if (text.includes("10m") || text.includes("10 m")) return "10m_50m"
  if (text.includes("5m") || text.includes("5 m")) return "5m_10m"
  if (text.includes("1m") || text.includes("1 m")) return "1m_5m"
  return "under_1m"
}

export function normalizeProspectSearchFilters(
  input: Partial<GrowthProspectSearchFilters> | null | undefined,
): GrowthProspectSearchFilters {
  const raw = input ?? {}
  return {
    industry: asString(raw.industry) || null,
    subindustry: asString(raw.subindustry) || null,
    employee_size_bands: Array.isArray(raw.employee_size_bands)
      ? raw.employee_size_bands.filter((b): b is GrowthProspectSearchEmployeeSizeBand =>
          GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS.includes(b as GrowthProspectSearchEmployeeSizeBand),
        )
      : undefined,
    revenue_bands: Array.isArray(raw.revenue_bands)
      ? raw.revenue_bands.filter((b): b is GrowthProspectSearchRevenueBand =>
          GROWTH_PROSPECT_SEARCH_REVENUE_BANDS.includes(b as GrowthProspectSearchRevenueBand),
        )
      : undefined,
    location: asString(raw.location) || null,
    service_area: asString(raw.service_area) || null,
    company_age_years_min:
      typeof raw.company_age_years_min === "number" ? raw.company_age_years_min : null,
    company_age_years_max:
      typeof raw.company_age_years_max === "number" ? raw.company_age_years_max : null,
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => asString(k)).filter(Boolean)
      : undefined,
    naics_codes: Array.isArray(raw.naics_codes)
      ? raw.naics_codes.map((k) => asString(k)).filter(Boolean)
      : undefined,
    sic_codes: Array.isArray(raw.sic_codes)
      ? raw.sic_codes.map((k) => asString(k)).filter(Boolean)
      : undefined,
    technologies: Array.isArray(raw.technologies)
      ? raw.technologies.map((k) => asString(k)).filter(Boolean)
      : undefined,
    crm_detected: asString(raw.crm_detected) || null,
    website_platform: asString(raw.website_platform) || null,
    field_service_software: asString(raw.field_service_software) || null,
    intent_score_min: typeof raw.intent_score_min === "number" ? raw.intent_score_min : null,
    buying_stages: Array.isArray(raw.buying_stages)
      ? (raw.buying_stages as GrowthBuyingStage[])
      : undefined,
    search_intent_categories: Array.isArray(raw.search_intent_categories)
      ? raw.search_intent_categories
      : undefined,
    company_identification_confidence_min:
      typeof raw.company_identification_confidence_min === "number"
        ? raw.company_identification_confidence_min
        : null,
    returning_visitor_only: raw.returning_visitor_only === true,
    existing_account_mode: raw.existing_account_mode ?? "any",
    lead_score_min: typeof raw.lead_score_min === "number" ? raw.lead_score_min : null,
    decision_maker_role: asString(raw.decision_maker_role) || null,
    title_contains: asString(raw.title_contains) || null,
    verification_status: asString(raw.verification_status) || null,
    priority: asString(raw.priority) || null,
    source_types: Array.isArray(raw.source_types) ? raw.source_types : undefined,
  }
}

export function applyProspectSearchFilters(
  companies: GrowthProspectSearchIndexCompany[],
  filters: GrowthProspectSearchFilters,
): GrowthProspectSearchIndexCompany[] {
  return companies.filter((row) => {
    if (filters.source_types?.length && !filters.source_types.includes(row.source_type)) {
      return false
    }
    if (filters.industry && !includesFold(row.industry, filters.industry)) {
      const blob = [row.industry, row.subindustry, ...row.keywords, row.company_name, row.notes].join(" ")
      if (!includesFold(blob, filters.industry)) return false
    }
    if (filters.subindustry && !includesFold(row.subindustry ?? row.industry, filters.subindustry)) {
      return false
    }
    if (filters.location) {
      const loc = [row.location, row.city, row.state, row.service_area].join(" ")
      if (!includesFold(loc, filters.location)) return false
    }
    if (filters.service_area && !includesFold(row.service_area, filters.service_area)) {
      return false
    }
    if (filters.employee_size_bands?.length) {
      const band = inferEmployeeSizeBand(row.employees)
      if (!filters.employee_size_bands.includes(band)) return false
    }
    if (filters.revenue_bands?.length) {
      const band = inferRevenueBand(row.revenue_range)
      if (!filters.revenue_bands.includes(band)) return false
    }
    if (filters.keywords?.length) {
      const blob = [row.company_name, row.website, row.industry, row.notes, ...row.keywords].join(" ")
      if (!filters.keywords.every((kw) => includesFold(blob, kw))) return false
    }
    if (filters.technologies?.length) {
      const blob = [
        row.crm_detected,
        row.field_service_software,
        row.website_platform,
        row.notes,
        ...row.keywords,
        ...(row.company_signal_summary?.technology_signals ?? []),
      ]
        .filter(Boolean)
        .join(" ")
      if (!filters.technologies.every((tech) => includesFold(blob, tech))) return false
    }
    if (filters.crm_detected && !includesFold(row.crm_detected, filters.crm_detected)) return false
    if (filters.website_platform && !includesFold(row.website_platform, filters.website_platform)) {
      return false
    }
    if (
      filters.field_service_software &&
      !includesFold(row.field_service_software, filters.field_service_software)
    ) {
      return false
    }
    if (filters.intent_score_min != null && (row.intent_score ?? 0) < filters.intent_score_min) {
      return false
    }
    if (filters.lead_score_min != null && (row.lead_score ?? 0) < filters.lead_score_min) {
      return false
    }
    if (filters.buying_stages?.length) {
      if (!row.buying_stage || !filters.buying_stages.includes(row.buying_stage as GrowthBuyingStage)) {
        return false
      }
    }
    if (filters.search_intent_categories?.length) {
      if (
        !row.search_intent_category ||
        !filters.search_intent_categories.includes(row.search_intent_category)
      ) {
        return false
      }
    }
    if (
      filters.company_identification_confidence_min != null &&
      (row.company_match_confidence ?? 0) < filters.company_identification_confidence_min
    ) {
      return false
    }
    if (filters.returning_visitor_only && !row.returning_visitor) return false
    if (filters.existing_account_mode === "include_only" && !row.existing_account) return false
    if (filters.existing_account_mode === "exclude" && row.existing_account) return false
    if (filters.verification_status && row.verification_status !== filters.verification_status) {
      return false
    }
    if (filters.priority && row.priority !== filters.priority) return false
    if (filters.decision_maker_role) {
      if ((row.decision_maker_count ?? 0) === 0) return false
    }
    return true
  })
}

function matchTitleToken(blob: string, token: string): boolean {
  if (!token.trim()) return true
  return includesFold(blob, token.trim())
}

function matchTitleFilter(blob: string, raw: string | null | undefined): boolean {
  const value = asString(raw)
  if (!value) return true
  if (value.includes("|")) {
    return value
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .some((token) => matchTitleToken(blob, token))
  }
  return matchTitleToken(blob, value)
}

export function filterProspectPeopleByTitle<T extends { title: string | null; role: string | null }>(
  people: T[],
  titleContains: string | null | undefined,
  role: string | null | undefined,
): T[] {
  return people.filter((p) => {
    const blob = `${p.title ?? ""} ${p.role ?? ""}`.trim()
    if (!matchTitleFilter(blob, titleContains)) return false
    if (role && role !== titleContains && !matchTitleFilter(blob, role)) return false
    return true
  })
}

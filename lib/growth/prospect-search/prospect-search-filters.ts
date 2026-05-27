import type { GrowthBuyingStage } from "@/lib/growth/buying-stage/buying-stage-types"
import type { GrowthSignalTier } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import { GROWTH_SIGNAL_TIERS } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import {
  GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS,
  GROWTH_PROSPECT_SEARCH_REVENUE_BANDS,
  GROWTH_PROSPECT_SEARCH_SUPPRESSION_MODES,
  type GrowthProspectSearchEmployeeSizeBand,
  type GrowthProspectSearchFilters,
  type GrowthProspectSearchRevenueBand,
  type GrowthProspectSearchSuppressionMode,
} from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchIndexCompany } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  mergeLocationTextIntoTerritoryFilter,
  normalizeTerritoryFilter,
  rowMatchesTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-geo"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

const INDUSTRY_FILTER_ALIAS_TOKENS: Record<string, readonly string[]> = {
  "medical equipment service": [
    "medical equipment",
    "biomedical",
    "biomed",
    "biomedical equipment",
    "clinical engineering",
    "healthcare equipment",
    "hospital equipment",
    "medical device",
    "medical device repair",
    "equipment repair",
    "equipment service",
    "equipment maintenance",
    "healthcare equipment service",
    "hospital equipment service",
    "medical equipment repair",
    "field service",
    "calibration",
  ],
}

function industryFilterAliasMatch(blob: string, filterIndustry: string): boolean {
  const aliases = INDUSTRY_FILTER_ALIAS_TOKENS[normalizeKey(filterIndustry)]
  if (!aliases?.length) return false
  const lower = blob.toLowerCase()
  return aliases.some((token) => lower.includes(token))
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function matchesProspectSearchIndustryFilter(
  row: Pick<
    GrowthProspectSearchIndexCompany | GrowthProspectSearchCompanyResult,
    "industry" | "subindustry" | "keywords" | "company_name" | "notes"
  >,
  filterIndustry: string,
): boolean {
  if (includesFold(row.industry, filterIndustry)) return true
  const blob = [row.industry, row.subindustry, ...row.keywords, row.company_name, row.notes].join(" ")
  if (includesFold(blob, filterIndustry)) return true
  return industryFilterAliasMatch(blob, filterIndustry)
}

export type ProspectSearchFilterOptions = {
  external_discovery?: boolean
}

export function explainProspectSearchFilterDrop<
  T extends GrowthProspectSearchIndexCompany | GrowthProspectSearchCompanyResult,
>(row: T, filters: GrowthProspectSearchFilters, options?: ProspectSearchFilterOptions): string | null {
  if (filters.source_types?.length && !filters.source_types.includes(row.source_type)) {
    return "source_type"
  }
  if (filters.industry && !matchesProspectSearchIndustryFilter(row, filters.industry)) {
    return "industry"
  }
  if (filters.subindustry && !includesFold(row.subindustry ?? row.industry, filters.subindustry)) {
    return "subindustry"
  }
  if (filters.location) {
    const loc = [row.location, row.city, row.state, row.service_area].join(" ")
    if (!includesFold(loc, filters.location)) return "location"
  }
  if (filters.service_area && !includesFold(row.service_area, filters.service_area)) {
    return "service_area"
  }
  if (
    filters.territory_filter &&
    !rowMatchesTerritoryFilter(
      {
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        country: row.country,
        location: row.location,
        service_area: row.service_area,
        metro: row.metro,
        lat: row.lat,
        lng: row.lng,
      },
      filters.territory_filter,
    )
  ) {
    return "territory"
  }
  if (filters.employee_size_bands?.length) {
    const band = inferEmployeeSizeBand(row.employees)
    if (options?.external_discovery && band === "unknown") {
      // External listings rarely include headcount — do not drop on unknown.
    } else if (!filters.employee_size_bands.includes(band)) {
      return "employee_size_band"
    }
  }
  if (filters.revenue_bands?.length) {
    const band = inferRevenueBand(row.revenue_range)
    if (options?.external_discovery && band === "unknown") {
      // External listings rarely include revenue — do not drop on unknown.
    } else if (!filters.revenue_bands.includes(band)) {
      return "revenue_band"
    }
  }
  if (filters.keywords?.length) {
    const blob = [row.company_name, row.website, row.industry, row.notes, ...row.keywords].join(" ")
    const keywordMatch = options?.external_discovery
      ? filters.keywords.some((kw) => includesFold(blob, kw))
      : filters.keywords.every((kw) => includesFold(blob, kw))
    if (!keywordMatch) return "keywords"
  }
  if (filters.technologies?.length) {
    if (options?.external_discovery) {
      // External listings rarely expose stack data — do not drop on technology filters.
    } else {
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
    if (!filters.technologies.every((tech) => includesFold(blob, tech))) return "technologies"
    }
  }
  if (filters.crm_detected && !includesFold(row.crm_detected, filters.crm_detected)) return "crm_detected"
  if (filters.website_platform && !includesFold(row.website_platform, filters.website_platform)) {
    return "website_platform"
  }
  if (
    filters.field_service_software &&
    !includesFold(row.field_service_software, filters.field_service_software)
  ) {
    return "field_service_software"
  }
  if (!options?.external_discovery) {
    if (filters.intent_score_min != null && (row.intent_score ?? 0) < filters.intent_score_min) {
      return "intent_score_min"
    }
    if (filters.lead_score_min != null && (row.lead_score ?? 0) < filters.lead_score_min) {
      return "lead_score_min"
    }
    if (
      filters.growth_signal_score_min != null &&
      (row.growth_signal_score ?? 0) < filters.growth_signal_score_min
    ) {
      return "growth_signal_score_min"
    }
    if (filters.growth_signal_tiers?.length) {
      if (!row.growth_signal_tier || !filters.growth_signal_tiers.includes(row.growth_signal_tier)) {
        return "growth_signal_tier"
      }
    }
    if (filters.buying_stages?.length) {
      if (!row.buying_stage || !filters.buying_stages.includes(row.buying_stage as GrowthBuyingStage)) {
        return "buying_stage"
      }
    }
    if (filters.search_intent_categories?.length) {
      if (
        !row.search_intent_category ||
        !filters.search_intent_categories.includes(row.search_intent_category)
      ) {
        return "search_intent_category"
      }
    }
  }
  if (
    filters.company_identification_confidence_min != null &&
    (row.company_match_confidence ?? 0) < filters.company_identification_confidence_min
  ) {
    return "company_identification_confidence_min"
  }
  if (filters.returning_visitor_only && !row.returning_visitor) return "returning_visitor_only"

  const status = row.existing_customer || row.existing_prospect || row.existing_account
  if (filters.existing_account_mode === "include_only" && !status) return "existing_account_mode"
  if (filters.existing_account_mode === "exclude" && status) return "existing_account_mode"
  if (filters.existing_account_mode === "exclude_customers" && row.existing_customer) {
    return "existing_account_mode"
  }
  if (
    filters.existing_account_mode === "exclude_crm" &&
    (row.existing_customer || row.existing_prospect)
  ) {
    return "existing_account_mode"
  }

  if (filters.suppression_mode === "exclude" && row.is_suppressed) return "suppression_mode"
  if (filters.suppression_mode === "include_only" && !row.is_suppressed) return "suppression_mode"
  if (filters.suppression_mode === "suppressed_only" && !row.is_suppressed) return "suppression_mode"

  if (filters.verification_status && row.verification_status !== filters.verification_status) {
    return "verification_status"
  }
  if (filters.priority && row.priority !== filters.priority) return "priority"
  if (filters.decision_maker_role) {
    if ((row.decision_maker_count ?? 0) === 0) return "decision_maker_role"
  }
  return null
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
    territory_filter: mergeLocationTextIntoTerritoryFilter({
      location: asString(raw.location) || null,
      territory_filter: normalizeTerritoryFilter(raw.territory_filter),
    }),
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
    suppression_mode:
      raw.suppression_mode &&
      GROWTH_PROSPECT_SEARCH_SUPPRESSION_MODES.includes(
        raw.suppression_mode as GrowthProspectSearchSuppressionMode,
      )
        ? (raw.suppression_mode as GrowthProspectSearchSuppressionMode)
        : "exclude",
    lead_score_min: typeof raw.lead_score_min === "number" ? raw.lead_score_min : null,
    decision_maker_role: asString(raw.decision_maker_role) || null,
    title_contains: asString(raw.title_contains) || null,
    verification_status: asString(raw.verification_status) || null,
    priority: asString(raw.priority) || null,
    source_types: Array.isArray(raw.source_types) ? raw.source_types : undefined,
    growth_signal_score_min:
      typeof raw.growth_signal_score_min === "number" ? raw.growth_signal_score_min : null,
    growth_signal_tiers: Array.isArray(raw.growth_signal_tiers)
      ? raw.growth_signal_tiers.filter((tier): tier is GrowthSignalTier =>
          GROWTH_SIGNAL_TIERS.includes(tier as GrowthSignalTier),
        )
      : undefined,
    territory_id: asString(raw.territory_id) || null,
  }
}

export function applyProspectSearchFilters<
  T extends GrowthProspectSearchIndexCompany | GrowthProspectSearchCompanyResult,
>(companies: T[], filters: GrowthProspectSearchFilters, options?: ProspectSearchFilterOptions): T[] {
  return companies.filter((row) => !explainProspectSearchFilterDrop(row, filters, options))
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

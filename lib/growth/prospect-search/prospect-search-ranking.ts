import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchIndexCompany,
  GrowthProspectSearchIndexPerson,
  GrowthProspectSearchParsedQuery,
  GrowthProspectSearchPersonResult,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { inferEmployeeSizeBand, inferRevenueBand } from "@/lib/growth/prospect-search/prospect-search-filters"
import { clampProspectSearchPageSize } from "@/lib/growth/prospect-search/prospect-search-scalable-pagination"
import { finalizeProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-result-finalize"
import { computeContactCoverageRankBoost } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import { computeProspectSearchIndexContactabilityBoost } from "@/lib/growth/prospect-search/prospect-search-contactability-ranking"
import { growthSignalRankBoost } from "@/lib/growth/company-growth-signals/growth-signal-scoring"

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

const MAX_ENRICHMENT_RANK_BOOST = 0.1
const MAX_QUALIFICATION_RANK_BOOST = 0.1
const MAX_CONTACT_RANK_BOOST = 0.05

function computeQualificationRankBoost(row: GrowthProspectSearchIndexCompany): number {
  let boost = 0

  const engineScore = row.lead_engine_score ?? row.lead_score
  if (engineScore != null && engineScore >= 70) boost += 0.03
  else if (engineScore != null && engineScore >= 50) boost += 0.015

  const stage = (row.buying_stage ?? "").toLowerCase()
  if (stage.includes("purchase") || stage.includes("active_opportunity")) boost += 0.025
  else if (row.buying_stage) boost += 0.01

  if (row.company_match_confidence != null && row.company_match_confidence >= 0.7) boost += 0.02
  else if (row.company_match_confidence != null && row.company_match_confidence >= 0.5) boost += 0.01

  if (row.intent_score != null && row.intent_score >= 15) boost += 0.02
  else if (row.intent_score != null && row.intent_score >= 12) boost += 0.01

  return Math.min(MAX_QUALIFICATION_RANK_BOOST, boost)
}

function computeContactRankBoost(row: GrowthProspectSearchIndexCompany): number {
  return Math.min(MAX_CONTACT_RANK_BOOST, computeContactCoverageRankBoost(row.decision_maker_count))
}

function computeEnrichmentRankBoost(
  row: GrowthProspectSearchIndexCompany,
  parsed: GrowthProspectSearchParsedQuery,
  filters?: GrowthProspectSearchFilters,
): number {
  let boost = 0

  const industryNeedle = filters?.industry?.trim()
  if (industryNeedle && row.industry && includesFold(row.industry, industryNeedle)) {
    boost += 0.025
  } else if (
    parsed.industry_hints.length > 0 &&
    row.industry &&
    parsed.industry_hints.some((hint) => includesFold(row.industry, hint))
  ) {
    boost += 0.02
  }

  if (filters?.service_area && row.service_area && includesFold(row.service_area, filters.service_area)) {
    boost += 0.025
  }
  if (filters?.location && row.service_area && includesFold(row.service_area, filters.location)) {
    boost += 0.015
  }

  if (filters?.crm_detected && row.crm_detected && includesFold(row.crm_detected, filters.crm_detected)) {
    boost += 0.025
  }
  if (
    filters?.field_service_software &&
    row.field_service_software &&
    includesFold(row.field_service_software, filters.field_service_software)
  ) {
    boost += 0.025
  }
  if (
    filters?.website_platform &&
    row.website_platform &&
    includesFold(row.website_platform, filters.website_platform)
  ) {
    boost += 0.025
  }

  if (filters?.employee_size_bands?.length && row.employees) {
    const band = inferEmployeeSizeBand(row.employees)
    if (filters.employee_size_bands.includes(band)) boost += 0.015
  }
  if (filters?.revenue_bands?.length && row.revenue_range) {
    const band = inferRevenueBand(row.revenue_range)
    if (filters.revenue_bands.includes(band)) boost += 0.015
  }

  if (filters?.technologies?.length) {
    const blob = [
      row.crm_detected,
      row.field_service_software,
      row.website_platform,
      ...(row.company_signal_summary?.technology_signals ?? []),
    ]
      .filter(Boolean)
      .join(" ")
    if (filters.technologies.every((tech) => includesFold(blob, tech))) boost += 0.02
  }

  return Math.min(MAX_ENRICHMENT_RANK_BOOST, boost)
}

function textMatchScore(query: string, blob: string): number {
  const q = query.trim().toLowerCase()
  const b = blob.toLowerCase()
  if (!q || !b) return 0
  if (b === q) return 1
  if (b.includes(q)) return 0.85
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const hits = tokens.filter((t) => b.includes(t)).length
  return hits / tokens.length
}

export function rankProspectSearchCompanies(
  rows: GrowthProspectSearchIndexCompany[],
  query: string,
  parsed: GrowthProspectSearchParsedQuery,
  limit = 100,
  filters?: GrowthProspectSearchFilters,
): GrowthProspectSearchCompanyResult[] {
  const scored = rows.map((row) => {
    const blob = [
      row.company_name,
      row.website,
      row.industry,
      row.location,
      row.city,
      row.state,
      row.notes,
      ...row.keywords,
      ...parsed.industry_hints,
      ...parsed.location_hints,
    ]
      .filter(Boolean)
      .join(" ")

    let rank = textMatchScore(query, blob)
    if (parsed.keywords.length) {
      rank = Math.max(rank, textMatchScore(parsed.keywords.join(" "), blob))
    }
    rank += computeQualificationRankBoost(row)
    const contactability = computeProspectSearchIndexContactabilityBoost(row)
    rank += contactability.boost
    rank += computeContactRankBoost(row) * 0.35
    rank += growthSignalRankBoost(row.growth_signal_score) * 0.5

    const summary = row.company_signal_summary
    if (summary?.technology_signals.length) rank += 0.02
    if (summary?.growth_indicators.length) rank += 0.02
    if (row.crm_detected?.trim()) rank += 0.02
    if (summary?.operational_maturity === "Mature operations") rank += 0.02
    rank += computeEnrichmentRankBoost(row, parsed, filters)

    const reasoning: string[] = []
    if (rank > 0.5) reasoning.push("Strong text match to search query.")
    if (row.intent_score != null && row.intent_score >= 12) {
      reasoning.push(`Intent score ${row.intent_score} from observable traffic.`)
    }
    if (row.lead_engine_score != null) {
      reasoning.push(`Lead Engine score ${row.lead_engine_score}.`)
    } else if (row.lead_score != null && row.lead_score >= 50) {
      reasoning.push(`Lead score ${row.lead_score}.`)
    }
    if (row.buying_stage) reasoning.push(`Buying stage: ${row.buying_stage.replace(/_/g, " ")}.`)
    if (row.decision_maker_count > 0) {
      reasoning.push(`${row.decision_maker_count} evidence-backed decision maker(s) indexed.`)
    }
    if (contactability.reasons[0]) reasoning.push(contactability.reasons[0])
    if (row.signals.length) reasoning.push(row.signals[0]!)
    if (summary?.technology_signals[0]) {
      reasoning.push(`Technology signal: ${summary.technology_signals[0]}.`)
    }
    if (summary?.growth_indicators[0]) {
      reasoning.push(`Growth signal: ${summary.growth_indicators[0]}.`)
    }

    const baseConfidence = 0.35 + rank
    const signalConfidence = row.signal_confidence ?? null
    const confidence = Number(
      Math.min(0.95, signalConfidence != null ? Math.max(baseConfidence, signalConfidence) : baseConfidence).toFixed(3),
    )

    return finalizeProspectSearchCompanyResult(
      {
      id: row.id,
      source_type: row.source_type,
      company_name: row.company_name,
      website: row.website,
      industry: row.industry,
      subindustry: row.subindustry,
      employees: row.employees,
      revenue_range: row.revenue_range,
      location: row.location,
      city: row.city,
      state: row.state,
      postal_code: row.postal_code,
      country: row.country,
      metro: row.metro,
      lat: row.lat,
      lng: row.lng,
      intent_score: row.intent_score,
      buying_stage: row.buying_stage,
      buying_stage_confidence: row.buying_stage_confidence,
      buying_stage_reason: row.buying_stage_reason,
      buying_stage_last_assessed_at: row.buying_stage_last_assessed_at,
      lead_score: row.lead_score,
      lead_engine_score: row.lead_engine_score,
      lead_engine_score_label: row.lead_engine_score_label,
      lead_engine_score_explanation: row.lead_engine_score_explanation,
      lead_engine_last_run_at: row.lead_engine_last_run_at,
      confidence,
      company_match_confidence: row.company_match_confidence,
      decision_maker_coverage:
        row.decision_maker_count != null && row.decision_maker_count > 0
          ? Math.min(1, row.decision_maker_count / 5)
          : null,
      verification_status: row.verification_status,
      signals: row.signals,
      search_intent_category: row.search_intent_category,
      growth_lead_id: row.growth_lead_id,
      prospect_id: row.prospect_id,
      customer_id: row.customer_id,
      rank_score: Number(rank.toFixed(4)),
      match_reasoning: reasoning,
      company_signal_summary: row.company_signal_summary ?? null,
      signal_confidence: row.signal_confidence ?? null,
      signal_count: row.signal_count ?? 0,
      service_area: row.service_area,
      crm_detected: row.crm_detected,
      website_platform: row.website_platform,
      field_service_software: row.field_service_software,
      existing_account: row.existing_account,
      in_revenue_queue: row.in_revenue_queue,
      existing_customer: row.existing_customer,
      existing_prospect: row.existing_prospect,
      already_pushed: row.already_pushed,
      is_suppressed: row.is_suppressed,
      suppression_reason: row.suppression_reason,
      suppression_scope: row.suppression_scope,
      suppressed_at: row.suppressed_at,
    },
      { query, filters, parsed },
    )
  })

  return scored
    .filter((r) => r.rank_score > 0.05 || query.trim().length < 3)
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, limit)
}

export function paginateRankedProspectSearchCompanies(
  rows: GrowthProspectSearchIndexCompany[],
  query: string,
  parsed: GrowthProspectSearchParsedQuery,
  page: number,
  pageSize: number,
  filters?: GrowthProspectSearchFilters,
): {
  companies: GrowthProspectSearchCompanyResult[]
  total_count: number
  page: number
  page_size: number
  has_next_page: boolean
} {
  const safePage = Math.max(1, page)
  const safePageSize = clampProspectSearchPageSize(pageSize)
  const ranked = rankProspectSearchCompanies(rows, query, parsed, rows.length || 1, filters)
  const offset = (safePage - 1) * safePageSize
  const companies = ranked.slice(offset, offset + safePageSize)

  return {
    companies,
    total_count: ranked.length,
    page: safePage,
    page_size: safePageSize,
    has_next_page: offset + safePageSize < ranked.length,
  }
}

export function rankProspectSearchPeople(
  rows: GrowthProspectSearchIndexPerson[],
  query: string,
  limit = 100,
): GrowthProspectSearchPersonResult[] {
  const scored = rows.map((row) => {
    const blob = [row.company_name, row.full_name, row.title, row.role, row.email].join(" ")
    const rank = textMatchScore(query, blob)
    return {
      id: row.id,
      source_type: row.source_type,
      company_id: row.company_id,
      company_name: row.company_name,
      full_name: row.full_name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      role: row.role,
      verification_status: row.verification_status,
      rank_score: Number(rank.toFixed(4)),
    }
  })

  return scored
    .filter((r) => r.rank_score > 0.05 || query.trim().length < 3)
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, limit)
}

export function paginateRankedProspectSearchPeople(
  rows: GrowthProspectSearchIndexPerson[],
  query: string,
  page: number,
  pageSize: number,
): {
  people: GrowthProspectSearchPersonResult[]
  total_count: number
  page: number
  page_size: number
  has_next_page: boolean
} {
  const safePage = Math.max(1, page)
  const safePageSize = clampProspectSearchPageSize(pageSize)
  const ranked = rankProspectSearchPeople(rows, query, rows.length || 1)
  const offset = (safePage - 1) * safePageSize
  const people = ranked.slice(offset, offset + safePageSize)

  return {
    people,
    total_count: ranked.length,
    page: safePage,
    page_size: safePageSize,
    has_next_page: offset + safePageSize < ranked.length,
  }
}

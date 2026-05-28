import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyProspectSearchFilters,
  filterProspectPeopleByTitle,
  normalizeProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import { buildProspectSearchIndex } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  isProspectSearchMaterializedIndexAvailable,
  loadProspectSearchMaterializedCompanies,
  loadProspectSearchPeopleForQuery,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index"
import type { GrowthProspectSearchEstimateConfidence } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import type {
  GrowthProspectSearchFilters,
  GrowthProspectSearchIndexCompany,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { applyTerritoryFiltersToSearchInput } from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"

export type GrowthProspectSearchInternalEstimateSource = "internal_index" | "cached_metadata" | "mixed"

export type GrowthProspectSearchInternalEstimate = {
  company_count: number
  contact_count: number | null
  decision_maker_count: number | null
  confidence: GrowthProspectSearchEstimateConfidence
  unavailable_filter_reasons: string[]
  estimated_from: GrowthProspectSearchInternalEstimateSource
  credits_used: false
  cached_metadata_count: number
  internal_index_count: number
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildUnavailableFilterReasons(filters: GrowthProspectSearchFilters): string[] {
  const reasons: string[] = []
  if (filters.intent_signal_tiers?.length) {
    reasons.push("Intent signal tiers apply to internal records only")
  }
  if (filters.search_intent_categories?.length) {
    reasons.push("Search intent categories apply to internal records only")
  }
  if ((filters.lead_score_min ?? 0) > 0 || (filters.lead_score_max ?? 0) > 0) {
    reasons.push("Lead score filters apply to indexed Growth records only")
  }
  if (filters.buying_stages?.length) {
    reasons.push("Buying stage filters may not match cached discovery rows")
  }
  if (filters.technologies?.length) {
    reasons.push("Technology filters are limited in the internal index")
  }
  if (filters.revenue_bands?.length) {
    reasons.push("Revenue bands are limited in the internal index")
  }
  if (filters.employee_size_bands?.length) {
    reasons.push("Employee size bands are limited in the internal index")
  }
  return reasons
}

async function countCachedRealWorldCandidates(
  admin: SupabaseClient,
  input: { query: string; filters: GrowthProspectSearchFilters },
): Promise<number> {
  try {
    let query = admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id", { count: "exact", head: true })

    const industry = input.filters.industry?.trim()
    if (industry) {
      query = query.or(`industry.ilike.%${industry}%,category.ilike.%${industry}%`)
    }

    const location = input.filters.location?.trim()
    if (location) {
      query = query.or(
        `city.ilike.%${location}%,state.ilike.%${location}%,location.ilike.%${location}%`,
      )
    }

    const territory = input.filters.territory_filter
    if (territory?.states?.length === 1) {
      query = query.ilike("state", `%${territory.states[0]}%`)
    }

    const sanitized = input.query.trim()
    if (sanitized && !industry) {
      query = query.or(
        `company_name.ilike.%${sanitized}%,industry.ilike.%${sanitized}%,category.ilike.%${sanitized}%`,
      )
    }

    const { count, error } = await query
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

async function countContactsForCompanies(
  admin: SupabaseClient,
  input: {
    companies: GrowthProspectSearchIndexCompany[]
    query: string
    filters: GrowthProspectSearchFilters
  },
): Promise<{ contact_count: number; decision_maker_count: number } | null> {
  const leadIds = [
    ...new Set(
      input.companies
        .map((row) => asString(row.growth_lead_id))
        .filter(Boolean),
    ),
  ]

  const leadNames = new Map<string, string>()
  for (const company of input.companies) {
    if (company.growth_lead_id) {
      leadNames.set(company.growth_lead_id, company.company_name)
    }
  }

  let people = await loadProspectSearchPeopleForQuery(admin, input.query, leadNames)

  if (leadIds.length > 0) {
    try {
      const { data } = await admin
        .schema("growth")
        .from("lead_decision_makers")
        .select("id, lead_id, full_name, email, title, phone, verification_status")
        .in("lead_id", leadIds.slice(0, 500))
      const byId = new Map(people.map((person) => [person.id, person]))
      for (const raw of data ?? []) {
        const row = raw as Record<string, unknown>
        const id = asString(row.id)
        const leadId = asString(row.lead_id)
        if (!id || !leadId) continue
        byId.set(id, {
          id,
          source_type: "growth_lead",
          company_id: leadId,
          company_name: leadNames.get(leadId) ?? "Growth lead",
          full_name: asString(row.full_name) || null,
          title: asString(row.title) || null,
          email: asString(row.email) || null,
          phone: asString(row.phone) || null,
          role: asString(row.title) || null,
          verification_status: asString(row.verification_status) || "unverified",
        })
      }
      people = [...byId.values()]
    } catch {
      /* optional */
    }
  }

  if (people.length === 0) return null

  const filtered = filterProspectPeopleByTitle(
    people,
    input.filters.title_contains,
    input.filters.decision_maker_role,
  )

  return {
    contact_count: filtered.length,
    decision_maker_count: filtered.length,
  }
}

function resolveEstimateConfidence(input: {
  company_count: number
  internal_index_count: number
  cached_metadata_count: number
  unavailable_filter_reasons: string[]
}): GrowthProspectSearchEstimateConfidence {
  if (input.internal_index_count > 0 && input.unavailable_filter_reasons.length === 0) return "high"
  if (input.internal_index_count > 0 || input.cached_metadata_count > 0) return "medium"
  if (input.company_count > 0) return "heuristic"
  return "broad"
}

/** Count filtered matches using materialized index + cached metadata only — no provider calls. */
export async function countProspectSearchMatchesInternalDetailed(
  admin: SupabaseClient,
  input: { query: string; filters?: Partial<GrowthProspectSearchFilters> },
): Promise<GrowthProspectSearchInternalEstimate> {
  const parsed = parseProspectSearchQuery(input.query)
  const baseFilters = mergeParsedQueryIntoFilters(parsed, input.filters ?? {}) as GrowthProspectSearchFilters
  const mergedFilters = normalizeProspectSearchFilters(
    await applyTerritoryFiltersToSearchInput(admin, baseFilters),
  )
  const unavailable_filter_reasons = buildUnavailableFilterReasons(mergedFilters)

  const materializedAvailable = await isProspectSearchMaterializedIndexAvailable(admin)
  let indexCompanies: GrowthProspectSearchIndexCompany[]

  if (materializedAvailable) {
    indexCompanies = await loadProspectSearchMaterializedCompanies(admin, {
      query: input.query,
      territory_filter: mergedFilters.territory_filter,
    })
  } else {
    const built = await buildProspectSearchIndex(admin, input.query)
    indexCompanies = built.companies
  }

  const filteredCompanies = applyProspectSearchFilters(indexCompanies, mergedFilters)
  const internal_index_count = filteredCompanies.length
  const cached_metadata_count = await countCachedRealWorldCandidates(admin, {
    query: input.query,
    filters: mergedFilters,
  })

  const company_count = Math.max(internal_index_count, cached_metadata_count)
  let estimated_from: GrowthProspectSearchInternalEstimateSource = "internal_index"
  if (internal_index_count > 0 && cached_metadata_count > 0) {
    estimated_from = "mixed"
  } else if (internal_index_count <= 0 && cached_metadata_count > 0) {
    estimated_from = "cached_metadata"
  }

  const contacts = await countContactsForCompanies(admin, {
    companies: filteredCompanies,
    query: input.query,
    filters: mergedFilters,
  })

  return {
    company_count,
    contact_count: contacts?.contact_count ?? null,
    decision_maker_count: contacts?.decision_maker_count ?? null,
    confidence: resolveEstimateConfidence({
      company_count,
      internal_index_count,
      cached_metadata_count,
      unavailable_filter_reasons,
    }),
    unavailable_filter_reasons,
    estimated_from,
    credits_used: false,
    cached_metadata_count,
    internal_index_count,
  }
}

/** Backward-compatible company count helper. */
export async function countProspectSearchMatchesInternal(
  admin: SupabaseClient,
  input: { query: string; filters?: Partial<GrowthProspectSearchFilters> },
): Promise<number> {
  const detailed = await countProspectSearchMatchesInternalDetailed(admin, input)
  return detailed.company_count
}

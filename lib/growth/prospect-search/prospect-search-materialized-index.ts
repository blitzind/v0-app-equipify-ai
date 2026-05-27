import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildProspectSearchIlikePattern,
  sanitizeProspectSearchQuery,
  type GrowthProspectSearchIndexCompany,
  type GrowthProspectSearchIndexPerson,
} from "@/lib/growth/prospect-search/prospect-search-index"
import {
  materializedRowToIndexCompany,
  type ProspectSearchMaterializedIndexRow,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index-map"
import {
  applyProspectSearchSuppressionOverlay,
  loadProspectSearchSuppressionLookup,
} from "@/lib/growth/prospect-search/prospect-search-suppression-overlays"
import { deriveProspectSearchCompanyStatus } from "@/lib/growth/prospect-search/prospect-search-status"
import type { GrowthProspectSearchSourceType, GrowthProspectSearchTerritoryFilter } from "@/lib/growth/prospect-search/prospect-search-types"
import { normalizeState } from "@/lib/growth/prospect-search/prospect-search-geo"

export const GROWTH_PROSPECT_SEARCH_MATERIALIZED_INDEX_QA_MARKER =
  "growth-prospect-search-materialized-index-v1" as const

export {
  indexCompanyToMaterializedRow,
  materializedRowToIndexCompany,
  type ProspectSearchMaterializedIndexRow,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index-map"

export type ProspectSearchIndexDiagnostics = {
  index_mode: "materialized" | "fallback"
  index_row_count: number | null
  last_indexed_at: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function isProspectSearchMaterializedIndexAvailable(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("prospect_search_index")
    .select("id")
    .limit(1)
  return !error
}

export async function getProspectSearchMaterializedIndexStats(
  admin: SupabaseClient,
): Promise<{ row_count: number; last_indexed_at: string | null }> {
  try {
    const { count } = await admin
      .schema("growth")
      .from("prospect_search_index")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)

    const { data } = await admin
      .schema("growth")
      .from("prospect_search_index")
      .select("indexed_at")
      .eq("is_active", true)
      .order("indexed_at", { ascending: false })
      .limit(1)

    return {
      row_count: count ?? 0,
      last_indexed_at: asString(data?.[0]?.indexed_at) || null,
    }
  } catch {
    return { row_count: 0, last_indexed_at: null }
  }
}

export async function loadProspectSearchMaterializedCompanies(
  admin: SupabaseClient,
  input: {
    query?: string
    source_type?: GrowthProspectSearchSourceType
    source_ids?: string[]
    territory_filter?: GrowthProspectSearchTerritoryFilter
  },
): Promise<GrowthProspectSearchIndexCompany[]> {
  let query = admin
    .schema("growth")
    .from("prospect_search_index")
    .select("*")
    .eq("is_active", true)

  if (input.source_type) {
    query = query.eq("source_type", input.source_type)
  }
  if (input.source_ids?.length) {
    query = query.in("source_id", input.source_ids.slice(0, 200))
  }

  const territory = input.territory_filter
  if (territory?.country) query = query.eq("country", territory.country)
  if (territory?.states?.length) {
    query = query.in(
      "state",
      territory.states.map((state) => normalizeState(state)).filter(Boolean) as string[],
    )
  }
  if (territory?.postal_codes?.length) query = query.in("postal_code", territory.postal_codes)
  if (territory?.metros?.length) query = query.in("metro", territory.metros)
  if (territory?.cities?.length && territory.cities.length === 1) {
    query = query.ilike("city", `%${territory.cities[0]}%`)
  }

  const sanitized = sanitizeProspectSearchQuery(input.query ?? "")
  if (sanitized && !input.source_ids?.length) {
    const tokens = sanitized.split(/\s+/).filter(Boolean)
    const tsQuery = tokens.map((token) => `${token}:*`).join(" & ")
    try {
      query = query.textSearch("search_text", tsQuery, { type: "websearch", config: "simple" })
    } catch {
      query = query.or(
        `company_name.ilike.%${sanitized}%,industry.ilike.%${sanitized}%,location_label.ilike.%${sanitized}%`,
      )
    }
  }

  query = query.order("indexed_at", { ascending: false }).limit(input.source_ids?.length ? 200 : 10000)

  const { data, error } = await query
  if (error || !data?.length) return []

  const suppressionLookup = await loadProspectSearchSuppressionLookup(admin)

  return (data as ProspectSearchMaterializedIndexRow[]).map((row) => {
    const company = materializedRowToIndexCompany(row)
    const status = deriveProspectSearchCompanyStatus(company)
    return applyProspectSearchSuppressionOverlay(
      {
        ...company,
        ...status,
      },
      suppressionLookup,
    )
  })
}

export async function loadProspectSearchCompaniesByRefs(
  admin: SupabaseClient,
  refs: Array<{ source_type: GrowthProspectSearchSourceType; id: string }>,
): Promise<Map<string, GrowthProspectSearchIndexCompany>> {
  const map = new Map<string, GrowthProspectSearchIndexCompany>()
  if (refs.length === 0) return map

  const byType = new Map<GrowthProspectSearchSourceType, string[]>()
  for (const ref of refs) {
    const ids = byType.get(ref.source_type) ?? []
    ids.push(ref.id)
    byType.set(ref.source_type, ids)
  }

  const available = await isProspectSearchMaterializedIndexAvailable(admin)
  if (!available) return map

  for (const [source_type, ids] of byType.entries()) {
    const companies = await loadProspectSearchMaterializedCompanies(admin, {
      source_type,
      source_ids: ids,
    })
    for (const company of companies) {
      map.set(`${company.source_type}:${company.id}`, company)
    }
  }

  return map
}

export async function loadProspectSearchPeopleForQuery(
  admin: SupabaseClient,
  query: string,
  leadNames: Map<string, string>,
): Promise<GrowthProspectSearchIndexPerson[]> {
  const pattern = buildProspectSearchIlikePattern(query)
  const hasQuery = sanitizeProspectSearchQuery(query).length > 0
  const people: GrowthProspectSearchIndexPerson[] = []

  try {
    let dmQuery = admin
      .schema("growth")
      .from("lead_decision_makers")
      .select("id, lead_id, full_name, email, title, phone, verification_status")
      .order("updated_at", { ascending: false })
      .limit(hasQuery ? 200 : 100)
    if (hasQuery) {
      dmQuery = dmQuery.or(
        `full_name.ilike.${pattern},email.ilike.${pattern},title.ilike.${pattern}`,
      )
    }
    const { data } = await dmQuery
    for (const raw of data ?? []) {
      const r = raw as Record<string, unknown>
      const leadId = asString(r.lead_id)
      const id = asString(r.id)
      if (!id || !leadId) continue
      people.push({
        id,
        source_type: "growth_lead",
        company_id: leadId,
        company_name: leadNames.get(leadId) ?? "Growth lead",
        full_name: asString(r.full_name) || null,
        title: asString(r.title) || null,
        email: asString(r.email) || null,
        phone: asString(r.phone) || null,
        role: asString(r.title) || null,
        verification_status: asString(r.verification_status) || "unverified",
      })
    }
  } catch {
    /* optional */
  }

  return people
}

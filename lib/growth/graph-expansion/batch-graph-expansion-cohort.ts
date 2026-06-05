/** Phase 7.PS-IB — Select promoted companies needing enrichment. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import {
  DEFAULT_BATCH_GRAPH_EXPANSION_STALE_ENRICHMENT_DAYS,
  type BatchGraphExpansionCohortCompany,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isStaleEnrichment(updated_at: string | null, contact_count: number): boolean {
  if (contact_count === 0) return true
  if (!updated_at) return true
  const ageMs = Date.now() - new Date(updated_at).getTime()
  const staleMs = DEFAULT_BATCH_GRAPH_EXPANSION_STALE_ENRICHMENT_DAYS * 24 * 60 * 60 * 1000
  return ageMs > staleMs
}

export async function loadBatchGraphExpansionCohort(
  admin: SupabaseClient,
  input: {
    limit?: number
    include_anchors?: boolean
    only_unenriched?: boolean
    exclude_company_ids?: string[]
  } = {},
): Promise<BatchGraphExpansionCohortCompany[]> {
  const limit = input.limit ?? 250
  const exclude = new Set(input.exclude_company_ids ?? [])
  const cohort: BatchGraphExpansionCohortCompany[] = []
  const seen = new Set<string>()

  const { data: promotedRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, canonical_company_id, industry, updated_at")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit * 2, 300))

  const canonicalIds = [
    ...new Set(
      (promotedRows ?? [])
        .map((row) => asString((row as Record<string, unknown>).canonical_company_id))
        .filter(Boolean),
    ),
  ]

  const contactCountByCompany = new Map<string, { count: number; last_updated: string | null }>()
  if (canonicalIds.length > 0) {
    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("company_id, updated_at")
      .in("company_id", canonicalIds)
      .neq("contact_status", "archived")

    for (const row of contacts ?? []) {
      const company_id = asString((row as Record<string, unknown>).company_id)
      if (!company_id) continue
      const prior = contactCountByCompany.get(company_id) ?? { count: 0, last_updated: null }
      const updated_at = asString((row as Record<string, unknown>).updated_at) || null
      contactCountByCompany.set(company_id, {
        count: prior.count + 1,
        last_updated:
          !prior.last_updated || (updated_at && updated_at > prior.last_updated)
            ? updated_at
            : prior.last_updated,
      })
    }
  }

  for (const row of promotedRows ?? []) {
    const canonical_company_id = asString((row as Record<string, unknown>).canonical_company_id)
    const company_candidate_id = asString((row as Record<string, unknown>).company_id)
    const company_name = asString((row as Record<string, unknown>).company_name)
    if (!canonical_company_id || !company_candidate_id || seen.has(canonical_company_id)) continue
    if (exclude.has(canonical_company_id)) continue

    const contactMeta = contactCountByCompany.get(canonical_company_id) ?? {
      count: 0,
      last_updated: null,
    }
    const enrichment_stale = isStaleEnrichment(contactMeta.last_updated, contactMeta.count)
    if (input.only_unenriched !== false && contactMeta.count > 0 && !enrichment_stale) continue

    seen.add(canonical_company_id)
    cohort.push({
      company_candidate_id,
      canonical_company_id,
      company_name: company_name || "Unknown",
      search_query: "biomedical equipment service companies",
      contact_count: contactMeta.count,
      enrichment_stale,
      cohort_kind: contactMeta.count === 0 ? "unenriched" : "stale",
    })
    if (cohort.length >= limit) break
  }

  if (input.include_anchors !== false) {
    for (const anchor of GROWTH_PS_HE_ANCHOR_COMPANIES) {
      if (seen.has(anchor.canonical_company_id) || exclude.has(anchor.canonical_company_id)) continue
      seen.add(anchor.canonical_company_id)
      const contactMeta = contactCountByCompany.get(anchor.canonical_company_id)
      cohort.unshift({
        company_candidate_id: anchor.company_candidate_id,
        canonical_company_id: anchor.canonical_company_id,
        company_name: anchor.company_name,
        search_query: anchor.search_query,
        contact_count: contactMeta?.count ?? 0,
        enrichment_stale: true,
        cohort_kind: "ps_he_anchor",
      })
    }
  }

  return cohort
}

export function chunkBatchGraphExpansionCohort<T>(items: T[], waveSize: number): T[][] {
  const size = Math.max(1, Math.min(30, waveSize))
  const waves: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    waves.push(items.slice(i, i + size))
  }
  return waves
}

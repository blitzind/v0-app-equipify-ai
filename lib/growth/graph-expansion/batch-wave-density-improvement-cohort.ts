/** Phase 7.PS-IE — Load wave-1 enriched companies from PS-IB batch. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BATCH_GRAPH_EXPANSION_MANIFEST_REASON,
  BATCH_GRAPH_EXPANSION_QUEUE_REASON,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import { deserializeBatchGraphExpansionManifest } from "@/lib/growth/graph-expansion/batch-graph-expansion-queue"
import type { BatchWaveDensityImprovementCohortCompany } from "@/lib/growth/graph-expansion/batch-wave-density-improvement-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function resolveLatestBatchGraphExpansionBatchId(
  admin: SupabaseClient,
  input: { batch_id?: string } = {},
): Promise<string | null> {
  if (input.batch_id) return input.batch_id

  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, updated_at")
    .eq("reason", BATCH_GRAPH_EXPANSION_MANIFEST_REASON)
    .order("updated_at", { ascending: false })
    .limit(8)

  for (const row of data ?? []) {
    const manifest = deserializeBatchGraphExpansionManifest(asString(row.last_error))
    if (!manifest?.batch_id) continue
    if (manifest.wave_index >= 1 || manifest.companies_completed > 0) {
      return manifest.batch_id
    }
  }
  return null
}

export async function loadCompletedBatchGraphExpansionCompanyIds(
  admin: SupabaseClient,
  batch_id: string,
): Promise<string[]> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("segment_key, status")
    .eq("reason", BATCH_GRAPH_EXPANSION_QUEUE_REASON)
    .like("segment_key", `bgx_co:${batch_id}:%`)
    .eq("status", "completed")

  const ids: string[] = []
  for (const row of data ?? []) {
    const segment = asString(row.segment_key)
    const company_id = segment.split(":").pop() ?? ""
    if (company_id) ids.push(company_id)
  }
  return ids
}

export async function loadBatchWaveDensityImprovementCohort(
  admin: SupabaseClient,
  input: {
    batch_id?: string
    only_enriched?: boolean
    limit?: number
  } = {},
): Promise<{ batch_id: string; companies: BatchWaveDensityImprovementCohortCompany[] }> {
  const batch_id = await resolveLatestBatchGraphExpansionBatchId(admin, {
    batch_id: input.batch_id,
  })
  if (!batch_id) return { batch_id: "", companies: [] }

  const completedIds = await loadCompletedBatchGraphExpansionCompanyIds(admin, batch_id)
  if (completedIds.length === 0) return { batch_id, companies: [] }

  const contactCountByCompany = new Map<string, number>()
  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("company_id")
    .in("company_id", completedIds)
    .neq("contact_status", "archived")

  for (const row of contacts ?? []) {
    const company_id = asString((row as Record<string, unknown>).company_id)
    if (!company_id) continue
    contactCountByCompany.set(company_id, (contactCountByCompany.get(company_id) ?? 0) + 1)
  }

  const enrichedIds = completedIds.filter((id) => {
    const count = contactCountByCompany.get(id) ?? 0
    return input.only_enriched === false ? true : count > 0
  })

  const { data: discoveryRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, canonical_company_id")
    .in("canonical_company_id", enrichedIds)

  const candidateByCanonical = new Map<string, { company_candidate_id: string; company_name: string }>()
  for (const row of discoveryRows ?? []) {
    const canonical_company_id = asString((row as Record<string, unknown>).canonical_company_id)
    const company_candidate_id = asString((row as Record<string, unknown>).company_id)
    const company_name = asString((row as Record<string, unknown>).company_name)
    if (!canonical_company_id || !company_candidate_id) continue
    candidateByCanonical.set(canonical_company_id, { company_candidate_id, company_name })
  }

  const companies: BatchWaveDensityImprovementCohortCompany[] = []
  for (const canonical_company_id of enrichedIds) {
    const meta = candidateByCanonical.get(canonical_company_id)
    if (!meta) continue
    companies.push({
      company_candidate_id: meta.company_candidate_id,
      canonical_company_id,
      company_name: meta.company_name || "Unknown",
      search_query: "biomedical equipment service companies",
      contact_count: contactCountByCompany.get(canonical_company_id) ?? 0,
      batch_id,
      cohort_kind: "wave_enriched",
    })
    if (input.limit && companies.length >= input.limit) break
  }

  return { batch_id, companies }
}

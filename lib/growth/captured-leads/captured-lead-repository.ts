import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  countCapturedLeadFilters,
  matchesCapturedLeadFilter,
  projectGrowthCapturedLeadRow,
} from "@/lib/growth/captured-leads/captured-lead-projection"
import {
  GROWTH_CAPTURED_LEAD_SOURCE_KINDS,
  type GrowthCapturedLeadFilter,
  type GrowthCapturedLeadRow,
} from "@/lib/growth/captured-leads/captured-lead-types"
import { fetchGrowthLeadById, listGrowthLeads } from "@/lib/growth/lead-repository"

export async function listCapturedGrowthLeads(
  admin: SupabaseClient,
  input: {
    filter?: GrowthCapturedLeadFilter
    limit?: number
  } = {},
): Promise<{
  rows: GrowthCapturedLeadRow[]
  filter_counts: Record<string, number>
}> {
  const leads = await listGrowthLeads(admin, {
    sourceKinds: [...GROWTH_CAPTURED_LEAD_SOURCE_KINDS],
    limit: input.limit ?? 150,
  })

  const projected = leads
    .map((lead) => projectGrowthCapturedLeadRow(lead))
    .filter((row): row is GrowthCapturedLeadRow => row != null)

  const filterCounts = countCapturedLeadFilters(projected)
  const filter = input.filter ?? "all"
  const rows =
    filter === "all"
      ? projected
      : projected.filter((row) => matchesCapturedLeadFilter(row, filter))

  logGrowthEngine("captured_leads_list_success", {
    total: projected.length,
    filtered: rows.length,
    filter,
  })

  return { rows, filter_counts: filterCounts }
}

export async function fetchCapturedGrowthLeadRow(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthCapturedLeadRow | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  return projectGrowthCapturedLeadRow(lead)
}

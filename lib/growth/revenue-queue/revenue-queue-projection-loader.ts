/**
 * GE-LEADS-CANONICAL-3A — Load canonical Revenue Queue projections from growth.leads.
 * Reads ONLY growth.leads — never growth.lead_inbox.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import { buildRevenueQueueLeadProjections } from "@/lib/growth/revenue-queue/revenue-queue-projection"
import {
  GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER,
  type RevenueQueueProjectionLoadFilters,
  type RevenueQueueProjectionLoadResult,
} from "@/lib/growth/revenue-queue/revenue-queue-projection-types"

export async function loadRevenueQueueProjections(
  admin: SupabaseClient,
  filters: RevenueQueueProjectionLoadFilters = {},
): Promise<RevenueQueueProjectionLoadResult> {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200)
  const leads = await listGrowthLeads(admin, {
    limit,
    offset: filters.offset ?? 0,
    status: filters.status,
    assignedTo: filters.assignedTo ?? undefined,
    unassigned: filters.unassigned,
    includeArchived: filters.includeArchived,
    sourceKinds: filters.sourceKinds,
  })

  return {
    qa_marker: GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER,
    items: buildRevenueQueueLeadProjections(leads),
    total: leads.length,
  }
}

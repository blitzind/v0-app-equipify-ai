/**
 * GE-LEADS-CANONICAL-4D — Revenue Queue API bridge (canonical-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import { GROWTH_REVENUE_QUEUE_BATCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"
import type {
  RevenueQueueDashboardSectionPayload,
  RevenueQueueSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"

export const GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER =
  "growth-revenue-queue-api-bridge-v1" as const

export const REVENUE_QUEUE_API_SOURCES = ["canonical"] as const

export type RevenueQueueApiSource = (typeof REVENUE_QUEUE_API_SOURCES)[number]

export type RevenueQueueApiDashboardPayload = {
  sections: RevenueQueueDashboardSectionPayload[]
  total: number
  queue_source: RevenueQueueApiSource
}

/** Legacy `?source=` values are ignored — canonical is the only queue source (GE-LEADS-CANONICAL-4D). */
export function parseRevenueQueueApiSource(_raw?: string | null): RevenueQueueApiSource {
  return "canonical"
}

/** Reads growth.leads only — never growth.lead_inbox. */
export async function loadRevenueQueueDashboardPayload(
  admin: SupabaseClient,
  input: { sort: RevenueQueueSortMode; limit?: number; source?: string | null },
): Promise<RevenueQueueApiDashboardPayload> {
  const leads = await listGrowthLeads(admin, {
    limit: input.limit ?? GROWTH_REVENUE_QUEUE_BATCH_LIMIT,
    includeArchived: false,
  })
  return {
    sections: buildRevenueQueueDashboardSectionsFromLeads(leads, input.sort),
    total: leads.length,
    queue_source: "canonical",
  }
}

/** @deprecated Use loadRevenueQueueDashboardPayload — canonical-only alias for cert compatibility. */
export async function loadCanonicalRevenueQueueDashboardPayload(
  admin: SupabaseClient,
  sort: RevenueQueueSortMode,
  limit = GROWTH_REVENUE_QUEUE_BATCH_LIMIT,
): Promise<RevenueQueueApiDashboardPayload> {
  return loadRevenueQueueDashboardPayload(admin, { sort, limit })
}

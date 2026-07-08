/**
 * GE-LEADS-CANONICAL-3B — Revenue Queue API bridge (legacy vs canonical source).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import { loadLeadInbox } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { buildLeadInboxDashboardSections } from "@/lib/growth/lead-operator-workspace/lead-inbox-dashboard"
import type {
  GrowthLeadInboxDashboardSectionPayload,
  GrowthLeadInboxSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"

export const GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER =
  "growth-revenue-queue-api-bridge-v1" as const

export const REVENUE_QUEUE_API_SOURCES = ["legacy", "canonical"] as const

export type RevenueQueueApiSource = (typeof REVENUE_QUEUE_API_SOURCES)[number]

export type RevenueQueueApiDashboardPayload = {
  sections: GrowthLeadInboxDashboardSectionPayload[]
  total: number
  queue_source: RevenueQueueApiSource
}

export function parseRevenueQueueApiSource(raw: string | null | undefined): RevenueQueueApiSource {
  const normalized = (raw ?? "").trim().toLowerCase()
  return normalized === "legacy" ? "legacy" : "canonical"
}

export async function loadLegacyRevenueQueueDashboardPayload(
  admin: SupabaseClient,
  sort: GrowthLeadInboxSortMode,
  limit = 100,
): Promise<RevenueQueueApiDashboardPayload> {
  const result = await loadLeadInbox(admin, { limit })
  return {
    sections: buildLeadInboxDashboardSections(result.items, sort),
    total: result.total,
    queue_source: "legacy",
  }
}

/** Reads growth.leads only — never growth.lead_inbox. */
export async function loadCanonicalRevenueQueueDashboardPayload(
  admin: SupabaseClient,
  sort: GrowthLeadInboxSortMode,
  limit = 100,
): Promise<RevenueQueueApiDashboardPayload> {
  const leads = await listGrowthLeads(admin, { limit, includeArchived: false })
  return {
    sections: buildRevenueQueueDashboardSectionsFromLeads(leads, sort),
    total: leads.length,
    queue_source: "canonical",
  }
}

export async function loadRevenueQueueDashboardPayload(
  admin: SupabaseClient,
  input: { sort: GrowthLeadInboxSortMode; source: RevenueQueueApiSource; limit?: number },
): Promise<RevenueQueueApiDashboardPayload> {
  if (input.source === "legacy") {
    return loadLegacyRevenueQueueDashboardPayload(admin, input.sort, input.limit)
  }
  return loadCanonicalRevenueQueueDashboardPayload(admin, input.sort, input.limit)
}

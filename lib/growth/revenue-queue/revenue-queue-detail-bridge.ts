/**
 * GE-LEADS-CANONICAL-4D — Revenue Queue detail resolution (canonical growth.leads only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildLeadOperatorWorkspacePayloadFromGrowthLead } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead"
import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export const GROWTH_REVENUE_QUEUE_DETAIL_BRIDGE_QA_MARKER =
  "growth-revenue-queue-detail-bridge-v1" as const

export type RevenueQueueDetailSource = "canonical_lead"

export type RevenueQueueDetailResolution = {
  source: RevenueQueueDetailSource
  growth_lead_id: string
  inbox_id: null
}

export type RevenueQueueDetailPayload = {
  workspace: GrowthLeadOperatorWorkspacePayload
  resolution: RevenueQueueDetailResolution
}

/** Resolve workspace by canonical growth.leads id only. */
export async function loadRevenueQueueOperatorWorkspace(
  admin: SupabaseClient,
  leadId: string,
): Promise<RevenueQueueDetailPayload | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  return {
    workspace: await buildLeadOperatorWorkspacePayloadFromGrowthLead(admin, lead),
    resolution: {
      source: "canonical_lead",
      growth_lead_id: lead.id,
      inbox_id: null,
    },
  }
}

/** Residual gaps when canonical lead metadata is sparse. */
export const REVENUE_QUEUE_CANONICAL_DETAIL_GAPS = [
  "intent_pixel visit history (requires site_key + visitor_key on intake metadata)",
] as const

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadRevenueReadinessInput } from "@/lib/growth/revenue-workflow/fetch-revenue-readiness-input"
import { computeRevenueReadiness } from "@/lib/growth/revenue-workflow/revenue-readiness-score"
import {
  GROWTH_REVENUE_WORKFLOW_METADATA_KEY,
  type GrowthRevenueReadinessSnapshot,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadRevenueReadiness(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthRevenueReadinessSnapshot | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadRevenueReadinessInput(admin, lead)
  const snapshot = computeRevenueReadiness(input)
  const metadata = {
    ...(lead.metadata ?? {}),
    [GROWTH_REVENUE_WORKFLOW_METADATA_KEY]: snapshot,
  }

  const { error } = await growthLeadsTable(admin).update({ metadata }).eq("id", leadId)
  if (error) {
    logGrowthEngine("revenue_readiness_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  logGrowthEngine("revenue_readiness_recomputed", {
    leadId,
    score: snapshot.score,
    tier: snapshot.tier,
  })

  return snapshot
}

export async function fetchGrowthLeadRevenueReadinessSnapshot(
  admin: SupabaseClient,
  leadId: string,
  options?: { readonly?: boolean },
): Promise<GrowthRevenueReadinessSnapshot | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  const snapshot = readGrowthLeadRevenueReadinessSnapshot(lead.metadata)
  if (snapshot) return snapshot
  if (options?.readonly) return null
  return recomputeGrowthLeadRevenueReadiness(admin, leadId)
}

export function readGrowthLeadRevenueReadinessSnapshot(
  metadata: Record<string, unknown> | null | undefined,
): GrowthRevenueReadinessSnapshot | null {
  const raw = metadata?.[GROWTH_REVENUE_WORKFLOW_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const snapshot = raw as Partial<GrowthRevenueReadinessSnapshot>
  if (typeof snapshot.score !== "number" || !snapshot.tier) return null
  return snapshot as GrowthRevenueReadinessSnapshot
}

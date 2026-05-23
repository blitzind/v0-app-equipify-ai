import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { computeGrowthCallPriority } from "@/lib/growth/call-priority"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  fetchGrowthLeadResearchNotes,
  fetchLatestUsableGrowthLeadResearchRun,
} from "@/lib/growth/research-repository"
import { emitGrowthLeadPriorityChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadCallPriority(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const [latestRun, manualNotes] = await Promise.all([
    lead.latestResearchRunId
      ? fetchLatestUsableGrowthLeadResearchRun(admin, leadId)
      : Promise.resolve(null),
    fetchGrowthLeadResearchNotes(admin, leadId),
  ])

  const priority = computeGrowthCallPriority({
    researchPriority: lead.researchPriority,
    score: lead.score,
    status: lead.status,
    lastResearchedAt: lead.lastResearchedAt,
    recommendedNextAction: latestRun?.result?.recommendedNextAction ?? null,
    leadNotes: lead.notes,
    manualResearchNotes: manualNotes?.body ?? null,
    callDisposition: lead.callDisposition,
    followUpAt: lead.followUpAt,
    callPriorityOverride: lead.callPriorityOverride,
  })

  const now = new Date().toISOString()
  const { error } = await growthLeadsTable(admin)
    .update({
      call_priority_score: priority.effectiveScore,
      call_priority_tier: priority.tier,
      call_priority_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("call_priority_recompute_failed", {
      leadId,
      message: error.message,
    })
    throw new Error(error.message)
  }

  if (
    lead.callPriorityScore !== priority.effectiveScore ||
    lead.callPriorityTier !== priority.tier
  ) {
    await emitGrowthLeadPriorityChangedTimeline(admin, {
      leadId,
      fromScore: lead.callPriorityScore,
      toScore: priority.effectiveScore,
      fromTier: lead.callPriorityTier,
      toTier: priority.tier,
    })
  }

  logGrowthEngine("call_priority_recomputed", {
    leadId,
    computedScore: priority.computedScore,
    effectiveScore: priority.effectiveScore,
    tier: priority.tier,
    excludedFromQueue: priority.excludedFromQueue,
  })

  return fetchGrowthLeadById(admin, leadId)
}

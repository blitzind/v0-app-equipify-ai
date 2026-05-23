import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { computeGrowthLeadExecutiveOperating } from "@/lib/growth/executive-operating-score"
import { fetchGrowthLeadExecutiveOperatingInput } from "@/lib/growth/executive-operating-signals"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  emitGrowthLeadExecutiveInterventionRecommendedTimeline,
  emitGrowthLeadExecutivePriorityChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadExecutiveOperatingIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = fetchGrowthLeadExecutiveOperatingInput(lead)
  const result = computeGrowthLeadExecutiveOperating(input)
  const now = new Date().toISOString()

  const { error } = await growthLeadsTable(admin)
    .update({
      executive_priority_score: result.score,
      executive_priority_tier: result.tier,
      executive_priority_summary: result.summary,
      executive_priority_top_signals: result.topSignals,
      executive_priority_volatility: result.volatility,
      executive_priority_previous_score: lead.executivePriorityScore,
      intelligence_conflicts: result.conflicts,
      intelligence_conflict_severity_score: result.conflictSeverityScore,
      executive_recommendation: result.recommendation,
      executive_owner: result.owner,
      executive_intervention_opened_at: result.interventionOpenedAt,
      executive_intervention_age_bucket: result.interventionAgeBucket,
      executive_operating_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("executive_operating_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.executivePriorityScore
  const prevTier = lead.executivePriorityTier
  const prevIntervention = lead.executiveInterventionOpenedAt != null

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadExecutivePriorityChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
  } else if (prevTier !== result.tier) {
    await emitGrowthLeadExecutivePriorityChangedTimeline(admin, {
      leadId,
      from: prevScore ?? 0,
      to: result.score,
      summary: `${prevTier ?? "none"} → ${result.tier}: ${result.summary}`,
    })
  }

  if (result.interventionNeeded && !prevIntervention) {
    await emitGrowthLeadExecutiveInterventionRecommendedTimeline(admin, {
      leadId,
      summary: result.recommendation,
      tier: result.tier,
    })
  }

  logGrowthEngine("executive_operating_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    volatility: result.volatility,
    conflictSeverityScore: result.conflictSeverityScore,
    interventionNeeded: result.interventionNeeded,
    interventionAgeBucket: result.interventionAgeBucket,
  })

  return fetchGrowthLeadById(admin, leadId)
}

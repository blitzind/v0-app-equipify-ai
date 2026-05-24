import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  fetchGrowthSequenceTouchTimeline,
  listGrowthSequencePatterns,
} from "@/lib/growth/sequence-pattern-repository"
import { detectAndPersistLeadSequenceOutcomes } from "@/lib/growth/sequence-dashboard-repository"
import { recommendGrowthSequencePattern } from "@/lib/growth/sequence/sequence-recommendation"
import { emitGrowthLeadSequenceRecommendationChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadSequenceIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const patterns = await listGrowthSequencePatterns(admin)
  const touches = await fetchGrowthSequenceTouchTimeline(admin, lead)
  await detectAndPersistLeadSequenceOutcomes(admin, lead)
  const recommendation = recommendGrowthSequencePattern({ lead, patterns, touches })
  const now = new Date().toISOString()

  const { error } = await growthLeadsTable(admin)
    .update({
      recommended_sequence_pattern_id: recommendation.patternId,
      recommended_sequence_reason: recommendation.reason,
      recommended_sequence_confidence: recommendation.confidence,
      recommended_sequence_next_step: recommendation.nextStep ?? {},
      sequence_fatigue_risk: recommendation.fatigueRisk,
      recommended_sequence_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("sequence_intelligence_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  if (lead.recommendedSequencePatternId !== recommendation.patternId) {
    await emitGrowthLeadSequenceRecommendationChangedTimeline(admin, {
      leadId,
      fromPatternId: lead.recommendedSequencePatternId,
      toPatternId: recommendation.patternId,
      reason: recommendation.reason,
      confidence: recommendation.confidence,
    })
  }

  logGrowthEngine("sequence_intelligence_recomputed", {
    leadId,
    patternKey: recommendation.patternKey,
    confidence: recommendation.confidence,
    fatigueRisk: recommendation.fatigueRisk,
  })

  return fetchGrowthLeadById(admin, leadId)
}

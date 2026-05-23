import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { computeGrowthLeadRelationshipStrength } from "@/lib/growth/relationship-score"
import {
  countNewRelationshipRecoveryTouches,
  fetchGrowthLeadRelationshipInput,
} from "@/lib/growth/relationship-signals"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  emitGrowthLeadRelationshipBecameStrategicTimeline,
  emitGrowthLeadRelationshipBecameTrustedTimeline,
  emitGrowthLeadRelationshipCooledTimeline,
  emitGrowthLeadRelationshipStrengthChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadRelationshipIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadRelationshipInput(admin, lead)
  const result = computeGrowthLeadRelationshipStrength(input)
  const now = new Date().toISOString()

  let recoveryAttemptCount = lead.relationshipRecoveryAttemptCount ?? 0
  const prevTrend = lead.relationshipTrend
  const prevLastTouch = lead.relationshipLastMeaningfulTouchAt

  if (result.trend === "improving" && prevTrend === "cooling") {
    recoveryAttemptCount = 0
  } else if (result.trend === "cooling") {
    const newRecoveryTouches = countNewRelationshipRecoveryTouches(input.signals, prevLastTouch)
    if (newRecoveryTouches > 0 && prevTrend === "cooling") {
      recoveryAttemptCount += 1
    }
  } else if (prevTrend === "cooling" && result.trend !== "cooling") {
    recoveryAttemptCount = 0
  }

  const { error } = await growthLeadsTable(admin)
    .update({
      relationship_strength_score: result.score,
      relationship_strength_tier: result.tier,
      relationship_last_meaningful_touch_at: result.lastMeaningfulTouchAt,
      relationship_summary: result.summary,
      relationship_top_signals: result.topSignals,
      relationship_trend: result.trend,
      relationship_previous_score: lead.relationshipStrengthScore,
      relationship_owner_attention_level: result.ownerAttentionLevel,
      relationship_recovery_attempt_count: recoveryAttemptCount,
      relationship_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("relationship_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.relationshipStrengthScore
  const prevTier = lead.relationshipStrengthTier

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadRelationshipStrengthChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
  }

  if (prevTier !== "trusted" && result.tier === "trusted") {
    await emitGrowthLeadRelationshipBecameTrustedTimeline(admin, { leadId, score: result.score })
  }

  if (prevTier !== "strategic" && result.tier === "strategic") {
    await emitGrowthLeadRelationshipBecameStrategicTimeline(admin, { leadId, score: result.score })
  }

  if (prevTrend !== "cooling" && result.trend === "cooling") {
    await emitGrowthLeadRelationshipCooledTimeline(admin, {
      leadId,
      score: result.score,
      lastMeaningfulTouchAt: result.lastMeaningfulTouchAt,
    })
  }

  logGrowthEngine("relationship_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    trend: result.trend,
    ownerAttentionLevel: result.ownerAttentionLevel,
    recoveryAttemptCount,
  })

  return fetchGrowthLeadById(admin, leadId)
}

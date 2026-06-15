import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadEngagementInput } from "@/lib/growth/engagement-signals"
import { computeGrowthLeadEngagementScore } from "@/lib/growth/engagement-score"
import { isEngagementDormant } from "@/lib/growth/engagement-decay"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { emitGrowthEngagementSpikeNotification } from "@/lib/growth/notifications/notification-integrations"
import {
  emitGrowthLeadBecameDormantTimeline,
  emitGrowthLeadBecameHotTimeline,
  emitGrowthLeadEngagementScoreChangedTimeline,
  emitGrowthLeadEngagementTierChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import { dispatchSequenceWakeForLeadEvent } from "@/lib/growth/sequences/conditions/sequence-event-wake-engine"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadEngagementIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadEngagementInput(admin, lead)
  const result = computeGrowthLeadEngagementScore(input)
  const now = new Date().toISOString()

  const { error } = await growthLeadsTable(admin)
    .update({
      engagement_score: result.score,
      engagement_tier: result.tier,
      engagement_last_activity_at: result.lastActivityAt,
      engagement_summary: result.summary,
      engagement_top_signals: result.topSignals,
      engagement_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("engagement_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.engagementScore
  const prevTier = lead.engagementTier
  const recomputeNow = new Date()

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadEngagementScoreChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
    if (result.score - prevScore >= 20) {
      await emitGrowthEngagementSpikeNotification(admin, {
        leadId,
        companyName: lead.companyName,
        fromScore: prevScore,
        toScore: result.score,
        ownerUserId: lead.assignedTo,
      })
    }
  }

  if (prevTier && prevTier !== result.tier) {
    await emitGrowthLeadEngagementTierChangedTimeline(admin, {
      leadId,
      from: prevTier,
      to: result.tier,
    })
    dispatchSequenceWakeForLeadEvent(admin, {
      leadId,
      source: "lead",
      event: "lead.hot_tier",
    })
    dispatchSequenceWakeForLeadEvent(admin, {
      leadId,
      source: "engagement",
      event: "engagement.tier",
    })
  }

  if (prevScore != null && prevScore !== result.score) {
    dispatchSequenceWakeForLeadEvent(admin, {
      leadId,
      source: "engagement",
      event: "engagement.score_threshold",
    })
  }

  if (result.tier === "hot" && prevTier !== "hot") {
    await emitGrowthLeadBecameHotTimeline(admin, { leadId, score: result.score })
  }

  const prevDormant = isEngagementDormant(
    lead.engagementLastActivityAt,
    lead.engagementDormancyExemptUntil,
    recomputeNow,
  )

  if (result.isDormant && !prevDormant) {
    await emitGrowthLeadBecameDormantTimeline(admin, {
      leadId,
      lastActivityAt: result.lastActivityAt,
    })
  }

  logGrowthEngine("engagement_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    dormant: result.isDormant,
  })

  return fetchGrowthLeadById(admin, leadId)
}

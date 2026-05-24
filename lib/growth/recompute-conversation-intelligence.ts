import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { computeGrowthLeadConversationIntelligence } from "@/lib/growth/conversation-score"
import { fetchGrowthLeadConversationInput } from "@/lib/growth/conversation-signals"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  emitGrowthLeadBuyingIntentDetectedTimeline,
  emitGrowthLeadCompetitorDetectedTimeline,
  emitGrowthLeadConversationHealthChangedTimeline,
  emitGrowthLeadConversationRiskDetectedTimeline,
  emitGrowthLeadUrgencyDetectedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadConversationIntelligence(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadConversationInput(admin, lead)
  const result = computeGrowthLeadConversationIntelligence(input)
  const now = new Date().toISOString()

  const { error } = await growthLeadsTable(admin)
    .update({
      conversation_health_score: result.score,
      conversation_health_tier: result.tier,
      conversation_summary: result.summary,
      conversation_top_signals: result.topSignals,
      conversation_sentiment: result.sentiment,
      conversation_urgency_level: result.urgencyLevel,
      conversation_buying_intent: result.buyingIntent,
      conversation_objection_profile: result.objectionProfile,
      conversation_competitor_mentions: result.competitorMentions,
      conversation_competitor_pressure: result.competitorPressure,
      conversation_last_meaningful_conversation_at: result.lastMeaningfulConversationAt,
      conversation_previous_score: lead.conversationHealthScore,
      conversation_trend: result.trend,
      conversation_confidence: result.confidence,
      conversation_momentum: result.momentum,
      conversation_response_pattern: result.responsePattern,
      conversation_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("conversation_intelligence_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.conversationHealthScore
  const prevTier = lead.conversationHealthTier

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadConversationHealthChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
  } else if (prevTier !== result.tier) {
    await emitGrowthLeadConversationHealthChangedTimeline(admin, {
      leadId,
      from: prevScore ?? 0,
      to: result.score,
      summary: `${prevTier ?? "none"} → ${result.tier}: ${result.summary}`,
    })
  }

  const prevBuyingIntent = lead.conversationBuyingIntent
  if (
    (result.buyingIntent === "strong" || result.buyingIntent === "urgent") &&
    prevBuyingIntent !== result.buyingIntent
  ) {
    await emitGrowthLeadBuyingIntentDetectedTimeline(admin, {
      leadId,
      intent: result.buyingIntent,
      summary: result.summary,
    })
  }

  const prevCompetitorPressure = lead.conversationCompetitorPressure ?? 0
  if (result.competitorPressure >= 40 && result.competitorPressure > prevCompetitorPressure + 10) {
    await emitGrowthLeadCompetitorDetectedTimeline(admin, {
      leadId,
      pressure: result.competitorPressure,
      mentions: result.competitorMentions.map((entry) => entry.name),
    })
  }

  const prevUrgency = lead.conversationUrgencyLevel
  if (
    (result.urgencyLevel === "high" || result.urgencyLevel === "critical") &&
    prevUrgency !== result.urgencyLevel
  ) {
    await emitGrowthLeadUrgencyDetectedTimeline(admin, {
      leadId,
      urgency: result.urgencyLevel,
      summary: result.summary,
    })
  }

  const hadRisk =
    lead.conversationHealthTier === "critical" ||
    lead.conversationTrend === "at_risk" ||
    lead.conversationMomentum === "stalling"
  const hasRisk =
    result.tier === "critical" ||
    result.trend === "at_risk" ||
    result.momentum === "stalling"

  if (hasRisk && !hadRisk) {
    await emitGrowthLeadConversationRiskDetectedTimeline(admin, {
      leadId,
      tier: result.tier,
      momentum: result.momentum,
      summary: result.summary,
    })
  }

  logGrowthEngine("conversation_intelligence_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    buyingIntent: result.buyingIntent,
    momentum: result.momentum,
  })

  return fetchGrowthLeadById(admin, leadId)
}

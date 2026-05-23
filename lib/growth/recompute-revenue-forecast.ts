import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { computeGrowthLeadRevenueForecast } from "@/lib/growth/revenue-forecast-score"
import { fetchGrowthLeadRevenueForecastInput } from "@/lib/growth/revenue-forecast-signals"
import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"
import {
  emitGrowthLeadBecameCommitCandidateTimeline,
  emitGrowthLeadBecameForecastedTimeline,
  emitGrowthLeadForecastConfidenceChangedTimeline,
  emitGrowthLeadForecastRegressionDetectedTimeline,
  emitGrowthLeadRevenueProbabilityChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function recomputeGrowthLeadRevenueForecast(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLead | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const input = await fetchGrowthLeadRevenueForecastInput(admin, lead)
  const result = computeGrowthLeadRevenueForecast(input)
  const now = new Date().toISOString()

  const attentionChanged = lead.forecastAttentionLevel !== result.attentionLevel
  const forecastAttentionLastChangedAt = attentionChanged
    ? now
    : lead.forecastAttentionLastChangedAt

  const { error } = await growthLeadsTable(admin)
    .update({
      revenue_probability_score: result.score,
      revenue_probability_tier: result.tier,
      revenue_probability_summary: result.summary,
      revenue_probability_top_signals: result.topSignals,
      revenue_probability_confidence: result.confidence,
      revenue_probability_previous_score: lead.revenueProbabilityScore,
      revenue_trajectory: result.trajectory,
      revenue_probability_volatility: result.volatility,
      forecast_contribution_weight: result.contributionWeight,
      forecast_attention_level: result.attentionLevel,
      forecast_attention_last_changed_at: forecastAttentionLastChangedAt,
      revenue_forecast_computed_at: now,
    })
    .eq("id", leadId)

  if (error) {
    logGrowthEngine("revenue_forecast_recompute_failed", { leadId, message: error.message })
    throw new Error(error.message)
  }

  const prevScore = lead.revenueProbabilityScore
  const prevTier = lead.revenueProbabilityTier
  const prevConfidence = lead.revenueProbabilityConfidence

  if (prevScore != null && Math.abs(prevScore - result.score) >= 5) {
    await emitGrowthLeadRevenueProbabilityChangedTimeline(admin, {
      leadId,
      from: prevScore,
      to: result.score,
      summary: result.summary,
    })
  }

  if (prevTier !== "forecasted" && result.tier === "forecasted") {
    await emitGrowthLeadBecameForecastedTimeline(admin, { leadId, score: result.score })
  }

  if (prevTier !== "commit_candidate" && result.tier === "commit_candidate") {
    await emitGrowthLeadBecameCommitCandidateTimeline(admin, { leadId, score: result.score })
  }

  if (
    prevConfidence != null &&
    Math.abs(prevConfidence - result.confidence) >= 10
  ) {
    await emitGrowthLeadForecastConfidenceChangedTimeline(admin, {
      leadId,
      from: prevConfidence,
      to: result.confidence,
    })
  }

  if (
    isForecastRegression({
      previousScore: prevScore,
      currentScore: result.score,
      previousTier: prevTier,
      currentTier: result.tier,
      trajectory: result.trajectory,
    })
  ) {
    await emitGrowthLeadForecastRegressionDetectedTimeline(admin, {
      leadId,
      fromScore: prevScore,
      toScore: result.score,
      fromTier: prevTier,
      toTier: result.tier,
      trajectory: result.trajectory,
    })
  }

  logGrowthEngine("revenue_forecast_recomputed", {
    leadId,
    score: result.score,
    tier: result.tier,
    confidence: result.confidence,
    trajectory: result.trajectory,
    volatility: result.volatility,
    attentionLevel: result.attentionLevel,
  })

  return fetchGrowthLeadById(admin, leadId)
}

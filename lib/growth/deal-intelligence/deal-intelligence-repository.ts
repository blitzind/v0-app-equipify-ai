import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import type {
  DealIntelligenceDashboardSummary,
  DealIntelligenceOperatorAction,
  DealIntelligenceScorePublicView,
  DealIntelligenceScoreStatus,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import {
  DEAL_INTELLIGENCE_SCORE_VERSION,
  GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import type { ComputedDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-score-engine"

const SCORE_SELECT =
  "id, organization_id, lead_id, opportunity_id, owner_user_id, score_version, score_status, close_probability, deal_risk_score, forecast_confidence, momentum_score, engagement_score, meeting_score, reply_score, research_fit_score, followup_discipline_score, stage_health_score, risk_level, predicted_close_window, recommended_operator_action, risk_factors, positive_signals, explanation, computed_at"

type DealScoreRow = {
  id: string
  organization_id: string
  lead_id: string
  opportunity_id: string | null
  owner_user_id: string | null
  score_version: string
  score_status: string
  close_probability: number | null
  deal_risk_score: number | null
  forecast_confidence: number | null
  momentum_score: number | null
  engagement_score: number | null
  meeting_score: number | null
  reply_score: number | null
  research_fit_score: number | null
  followup_discipline_score: number | null
  stage_health_score: number | null
  risk_level: string | null
  predicted_close_window: string | null
  recommended_operator_action: string | null
  risk_factors: unknown
  positive_signals: unknown
  explanation: string | null
  computed_at: string
}

function scoresTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deal_intelligence_scores")
}

function opportunitiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunities")
}

function mapSignalLabels(raw: unknown): DealIntelligenceScorePublicView["riskFactors"] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as Record<string, unknown>
      return {
        key: String(row.key ?? "signal"),
        label: String(row.label ?? "Signal"),
      }
    })
}

export function mapDealIntelligenceScoreRow(row: DealScoreRow): DealIntelligenceScorePublicView {
  return {
    id: row.id,
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    ownerUserId: row.owner_user_id,
    scoreStatus: row.score_status as DealIntelligenceScoreStatus,
    closeProbability: row.close_probability ?? 0,
    dealRiskScore: row.deal_risk_score ?? 0,
    forecastConfidence: row.forecast_confidence ?? 0,
    momentumScore: row.momentum_score ?? 0,
    engagementScore: row.engagement_score ?? 0,
    meetingScore: row.meeting_score ?? 0,
    replyScore: row.reply_score ?? 0,
    researchFitScore: row.research_fit_score ?? 0,
    followupDisciplineScore: row.followup_discipline_score ?? 0,
    stageHealthScore: row.stage_health_score ?? 0,
    riskLevel: (row.risk_level ?? "medium") as DealIntelligenceScorePublicView["riskLevel"],
    predictedCloseWindow: (row.predicted_close_window ?? "unknown") as DealIntelligenceScorePublicView["predictedCloseWindow"],
    recommendedOperatorAction: (row.recommended_operator_action ?? "manual_review") as DealIntelligenceScorePublicView["recommendedOperatorAction"],
    riskFactors: mapSignalLabels(row.risk_factors),
    positiveSignals: mapSignalLabels(row.positive_signals),
    explanation: row.explanation ?? "",
    computedAt: row.computed_at,
  }
}

export async function fetchActiveDealIntelligenceScore(
  admin: SupabaseClient,
  input: { opportunityId?: string | null; leadId?: string | null },
): Promise<DealIntelligenceScorePublicView | null> {
  let query = scoresTable(admin).select(SCORE_SELECT).eq("score_status", "active")

  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId)
  else if (input.leadId) query = query.eq("lead_id", input.leadId).is("opportunity_id", null)
  else return null

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDealIntelligenceScoreRow(data as DealScoreRow) : null
}

export async function fetchActiveDealIntelligenceScoreById(
  admin: SupabaseClient,
  scoreId: string,
): Promise<DealIntelligenceScorePublicView | null> {
  const { data, error } = await scoresTable(admin).select(SCORE_SELECT).eq("id", scoreId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDealIntelligenceScoreRow(data as DealScoreRow) : null
}

export async function markDealIntelligenceScoresStale(
  admin: SupabaseClient,
  input: { opportunityId?: string | null; leadId: string },
): Promise<void> {
  let query = scoresTable(admin).update({ score_status: "stale" }).eq("score_status", "active").eq("lead_id", input.leadId)
  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId)
  else query = query.is("opportunity_id", null)

  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function insertDealIntelligenceScore(
  admin: SupabaseClient,
  input: {
    leadId: string
    opportunityId: string | null
    ownerUserId: string | null
    computed: ComputedDealIntelligenceScore
  },
): Promise<DealIntelligenceScorePublicView> {
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("Deal intelligence is not configured. Set GROWTH_ENGINE_AI_ORG_ID on the server.")

  await markDealIntelligenceScoresStale(admin, {
    leadId: input.leadId,
    opportunityId: input.opportunityId,
  })

  const { data, error } = await scoresTable(admin)
    .insert({
      organization_id: organizationId,
      lead_id: input.leadId,
      opportunity_id: input.opportunityId,
      owner_user_id: input.ownerUserId,
      score_version: DEAL_INTELLIGENCE_SCORE_VERSION,
      score_status: "active",
      close_probability: input.computed.closeProbability,
      deal_risk_score: input.computed.dealRiskScore,
      forecast_confidence: input.computed.forecastConfidence,
      momentum_score: input.computed.momentumScore,
      engagement_score: input.computed.engagementScore,
      meeting_score: input.computed.meetingScore,
      reply_score: input.computed.replyScore,
      research_fit_score: input.computed.researchFitScore,
      followup_discipline_score: input.computed.followupDisciplineScore,
      stage_health_score: input.computed.stageHealthScore,
      risk_level: input.computed.riskLevel,
      predicted_close_window: input.computed.predictedCloseWindow,
      recommended_operator_action: input.computed.recommendedOperatorAction,
      score_inputs: input.computed.scoreInputs,
      risk_factors: input.computed.riskFactors,
      positive_signals: input.computed.positiveSignals,
      explanation: input.computed.explanation,
      computed_at: new Date().toISOString(),
    })
    .select(SCORE_SELECT)
    .single()

  if (error) throw new Error(error.message)

  const score = mapDealIntelligenceScoreRow(data as DealScoreRow)

  if (input.opportunityId) {
    const { error: cacheError } = await opportunitiesTable(admin)
      .update({
        latest_deal_intelligence_score_id: score.id,
        deal_close_probability: score.closeProbability,
        deal_risk_level: score.riskLevel,
        deal_predicted_close_window: score.predictedCloseWindow,
        deal_recommended_action: score.recommendedOperatorAction,
      })
      .eq("id", input.opportunityId)
    if (cacheError) throw new Error(cacheError.message)
  }

  return score
}

export async function fetchDealIntelligenceDashboardSummary(
  admin: SupabaseClient,
): Promise<DealIntelligenceDashboardSummary> {
  const { data, error } = await scoresTable(admin)
    .select(SCORE_SELECT)
    .eq("score_status", "active")
    .not("opportunity_id", "is", null)
    .order("computed_at", { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as DealScoreRow[]).map(mapDealIntelligenceScoreRow)
  const scoredOpportunities = rows.length
  const highProbabilityDeals = rows.filter((row) => row.closeProbability >= 70).length
  const criticalRiskDeals = rows.filter((row) => row.riskLevel === "critical").length
  const averageForecastConfidence =
    scoredOpportunities > 0
      ? Math.round(rows.reduce((sum, row) => sum + row.forecastConfidence, 0) / scoredOpportunities)
      : 0
  const averageCloseProbability =
    scoredOpportunities > 0
      ? Math.round(rows.reduce((sum, row) => sum + row.closeProbability, 0) / scoredOpportunities)
      : 0
  const dealsNeedingAction = rows.filter((row) => row.recommendedOperatorAction !== "wait").length

  const actionCounts = new Map<DealIntelligenceOperatorAction, number>()
  for (const row of rows) {
    if (row.recommendedOperatorAction === "wait") continue
    actionCounts.set(row.recommendedOperatorAction, (actionCounts.get(row.recommendedOperatorAction) ?? 0) + 1)
  }

  const topRecommendedActions = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([action, count]) => ({ action, count }))

  return {
    qaMarker: GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER,
    scoredOpportunities,
    highProbabilityDeals,
    criticalRiskDeals,
    averageForecastConfidence,
    dealsNeedingAction,
    topRecommendedActions,
    averageCloseProbability,
  }
}

export function logDealIntelligence(event: string, details: Record<string, unknown>): void {
  logGrowthEngine(`deal_intelligence_${event}`, details)
}

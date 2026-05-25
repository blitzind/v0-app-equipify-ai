import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import type { ComputedMeetingOutcomeIntelligenceScore } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-score-engine"
import type {
  MeetingOutcomeDashboardItem,
  MeetingOutcomeDashboardSummary,
  MeetingOutcomeIntelligenceScorePublicView,
  MeetingOutcomeScoreInputs,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import {
  GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
  MEETING_OUTCOME_FOLLOW_UP_RECOMMENDATION_LABELS,
  MEETING_OUTCOME_MOMENTUM_TREND_LABELS,
  MEETING_OUTCOME_SCORE_VERSION,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"

const SCORECARD_SELECT =
  "id, lead_id, meeting_id, opportunity_id, owner_user_id, meeting_outcome_score, meeting_quality_score, next_step_confidence, follow_up_recommendation, buying_signal_count, objection_count, champion_detected, decision_maker_present, timeline_detected, budget_signal, urgency_signal, no_show_risk_pattern, momentum_trend, recommended_next_step, safe_summary, computed_at"

type ScoreRow = {
  id: string
  lead_id: string
  meeting_id: string
  opportunity_id: string | null
  owner_user_id: string | null
  meeting_outcome_score: number
  meeting_quality_score: number
  next_step_confidence: number
  follow_up_recommendation: string
  buying_signal_count: number
  objection_count: number
  champion_detected: boolean
  decision_maker_present: boolean
  timeline_detected: boolean
  budget_signal: boolean
  urgency_signal: boolean
  no_show_risk_pattern: boolean
  momentum_trend: string
  recommended_next_step: string
  safe_summary: string
  computed_at: string
  leads?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null
  meetings?: { title?: string | null } | Array<{ title?: string | null }> | null
}

function scoresTable(admin: SupabaseClient) {
  return admin.schema("growth").from("meeting_outcome_intelligence_scores")
}

export function mapMeetingOutcomeScoreRow(row: ScoreRow): MeetingOutcomeIntelligenceScorePublicView {
  const recommendation = row.follow_up_recommendation as MeetingOutcomeIntelligenceScorePublicView["followUpRecommendation"]
  const momentum = row.momentum_trend as MeetingOutcomeIntelligenceScorePublicView["momentumTrend"]
  return {
    id: row.id,
    leadId: row.lead_id,
    meetingId: row.meeting_id,
    opportunityId: row.opportunity_id,
    ownerUserId: row.owner_user_id,
    meetingOutcomeScore: row.meeting_outcome_score,
    meetingQualityScore: row.meeting_quality_score,
    nextStepConfidence: row.next_step_confidence,
    followUpRecommendation: recommendation,
    followUpRecommendationLabel: MEETING_OUTCOME_FOLLOW_UP_RECOMMENDATION_LABELS[recommendation],
    buyingSignalCount: row.buying_signal_count,
    objectionCount: row.objection_count,
    championDetected: row.champion_detected,
    decisionMakerPresent: row.decision_maker_present,
    timelineDetected: row.timeline_detected,
    budgetSignal: row.budget_signal,
    urgencySignal: row.urgency_signal,
    noShowRiskPattern: row.no_show_risk_pattern,
    momentumTrend: momentum,
    momentumTrendLabel: MEETING_OUTCOME_MOMENTUM_TREND_LABELS[momentum],
    recommendedNextStep: row.recommended_next_step,
    safeSummary: row.safe_summary,
    computedAt: row.computed_at,
  }
}

function mapDashboardItem(row: ScoreRow): MeetingOutcomeDashboardItem {
  const leadJoin = Array.isArray(row.leads) ? row.leads[0] : row.leads
  const meetingJoin = Array.isArray(row.meetings) ? row.meetings[0] : row.meetings
  const score = mapMeetingOutcomeScoreRow(row)
  return {
    id: score.id,
    leadId: score.leadId,
    meetingId: score.meetingId,
    companyName: leadJoin?.company_name ?? "Lead",
    title: meetingJoin?.title ?? "Meeting",
    meetingOutcomeScore: score.meetingOutcomeScore,
    meetingQualityScore: score.meetingQualityScore,
    followUpRecommendation: score.followUpRecommendation,
    followUpRecommendationLabel: score.followUpRecommendationLabel,
    recommendedNextStep: score.recommendedNextStep,
    momentumTrend: score.momentumTrend,
    ctaHref: commandLeadFocusHref(score.leadId, "meetings"),
  }
}

export async function insertMeetingOutcomeIntelligenceScore(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    opportunityId?: string | null
    ownerUserId?: string | null
    computed: ComputedMeetingOutcomeIntelligenceScore
    scoreInputs: MeetingOutcomeScoreInputs
  },
): Promise<MeetingOutcomeIntelligenceScorePublicView> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data, error } = await scoresTable(admin)
    .insert({
      organization_id: orgId,
      lead_id: input.leadId,
      meeting_id: input.meetingId,
      opportunity_id: input.opportunityId ?? null,
      owner_user_id: input.ownerUserId ?? null,
      score_version: MEETING_OUTCOME_SCORE_VERSION,
      meeting_outcome_score: input.computed.meetingOutcomeScore,
      meeting_quality_score: input.computed.meetingQualityScore,
      next_step_confidence: input.computed.nextStepConfidence,
      follow_up_recommendation: input.computed.followUpRecommendation,
      buying_signal_count: input.computed.buyingSignalCount,
      objection_count: input.computed.objectionCount,
      champion_detected: input.computed.championDetected,
      decision_maker_present: input.computed.decisionMakerPresent,
      timeline_detected: input.computed.timelineDetected,
      budget_signal: input.computed.budgetSignal,
      urgency_signal: input.computed.urgencySignal,
      no_show_risk_pattern: input.computed.noShowRiskPattern,
      momentum_trend: input.computed.momentumTrend,
      recommended_next_step: input.computed.recommendedNextStep,
      safe_summary: input.computed.safeSummary,
      score_inputs: input.scoreInputs,
    })
    .select(SCORECARD_SELECT)
    .single()
  if (error) throw new Error(error.message)

  await admin
    .schema("growth")
    .from("meetings")
    .update({
      latest_meeting_outcome_score_id: data.id,
      meeting_outcome_score: input.computed.meetingOutcomeScore,
      meeting_quality_score: input.computed.meetingQualityScore,
      meeting_outcome_recommendation: input.computed.followUpRecommendation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.meetingId)

  return mapMeetingOutcomeScoreRow(data as ScoreRow)
}

export async function fetchLatestMeetingOutcomeScoreForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<MeetingOutcomeIntelligenceScorePublicView | null> {
  const { data, error } = await scoresTable(admin)
    .select(SCORECARD_SELECT)
    .eq("lead_id", leadId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMeetingOutcomeScoreRow(data as ScoreRow) : null
}

export async function listMeetingOutcomeScoresForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 10,
): Promise<MeetingOutcomeIntelligenceScorePublicView[]> {
  const { data, error } = await scoresTable(admin)
    .select(SCORECARD_SELECT)
    .eq("lead_id", leadId)
    .order("computed_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMeetingOutcomeScoreRow(row as ScoreRow))
}

export async function fetchMeetingOutcomeDashboard(
  admin: SupabaseClient,
): Promise<MeetingOutcomeDashboardSummary> {
  const { data, error } = await scoresTable(admin)
    .select(`${SCORECARD_SELECT}, leads(company_name), meetings(title)`)
    .order("computed_at", { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as ScoreRow[]
  const items = rows.map(mapDashboardItem)
  const latestByMeeting = new Map<string, MeetingOutcomeDashboardItem>()
  for (const item of items) {
    if (!latestByMeeting.has(item.meetingId)) latestByMeeting.set(item.meetingId, item)
  }
  const unique = [...latestByMeeting.values()]

  const stalledOpportunities = unique.filter((item) => item.followUpRecommendation === "risk_of_stall")
  const noShowRecoveryQueue = unique.filter((item) => item.followUpRecommendation === "no_show_recovery")
  const followUpRecommendations = unique.filter((item) =>
    ["needs_follow_up", "book_next_meeting_recommendation", "send_proposal_recommendation"].includes(
      item.followUpRecommendation,
    ),
  )
  const highQualityMeetings = unique.filter((item) => item.meetingQualityScore >= 70)
  const atRiskMeetings = unique.filter(
    (item) => item.momentumTrend === "at_risk" || item.followUpRecommendation === "executive_escalation_recommended",
  )

  const averageOutcomeScore =
    unique.length > 0
      ? Math.round(unique.reduce((sum, item) => sum + item.meetingOutcomeScore, 0) / unique.length)
      : 0
  const averageQualityScore =
    unique.length > 0
      ? Math.round(unique.reduce((sum, item) => sum + item.meetingQualityScore, 0) / unique.length)
      : 0

  return {
    qaMarker: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
    generatedAt: new Date().toISOString(),
    stalledOpportunities: stalledOpportunities.slice(0, 10),
    noShowRecoveryQueue: noShowRecoveryQueue.slice(0, 10),
    followUpRecommendations: followUpRecommendations.slice(0, 10),
    highQualityMeetings: highQualityMeetings.slice(0, 10),
    atRiskMeetings: atRiskMeetings.slice(0, 10),
    averageOutcomeScore,
    averageQualityScore,
    scoredMeetings: unique.length,
  }
}

export async function recomputeMeetingOutcomeForMeeting(
  admin: SupabaseClient,
  meetingId: string,
): Promise<MeetingOutcomeIntelligenceScorePublicView | null> {
  const meeting = await fetchGrowthMeetingById(admin, meetingId)
  if (!meeting) return null

  const { gatherMeetingOutcomeScoreInputs } = await import(
    "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-score-inputs"
  )
  const { computeMeetingOutcomeIntelligenceScore } = await import(
    "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-score-engine"
  )
  const { emitMeetingOutcomeIntelligenceNotifications } = await import(
    "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-notifications"
  )

  const scoreInputs = await gatherMeetingOutcomeScoreInputs(admin, meetingId)
  if (!scoreInputs) return null

  const computed = computeMeetingOutcomeIntelligenceScore(scoreInputs)
  const score = await insertMeetingOutcomeIntelligenceScore(admin, {
    leadId: meeting.leadId,
    meetingId: meeting.id,
    opportunityId: meeting.opportunityId,
    ownerUserId: meeting.ownerUserId,
    computed,
    scoreInputs,
  })

  await emitMeetingOutcomeIntelligenceNotifications(admin, {
    score,
    companyName: meeting.title,
  })

  return score
}

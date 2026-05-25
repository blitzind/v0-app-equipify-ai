import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import type {
  CallIntelligenceDashboardSummary,
  CallIntelligenceExtractedSignals,
  CallIntelligenceScorecardPublicView,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import {
  CALL_INTELLIGENCE_SCORE_VERSION,
  GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { ComputedCallIntelligenceScore } from "@/lib/growth/call-intelligence/call-score-engine"

const SCORECARD_SELECT =
  "id, organization_id, lead_id, opportunity_id, meeting_id, realtime_session_id, owner_user_id, score_version, overall_score, conversation_quality_score, discovery_score, objection_handling_score, buying_signal_score, next_step_score, talk_listen_balance_score, competitor_risk_score, confidence_score, risk_level, outcome, detected_objections, buying_signals, competitor_mentions, discovery_gaps, next_step_commitments, coaching_opportunities, safe_summary, recommended_next_action, metrics, computed_at"

type ScorecardRow = {
  id: string
  organization_id: string
  lead_id: string
  opportunity_id: string | null
  meeting_id: string | null
  realtime_session_id: string | null
  owner_user_id: string | null
  score_version: string
  overall_score: number | null
  conversation_quality_score: number | null
  discovery_score: number | null
  objection_handling_score: number | null
  buying_signal_score: number | null
  next_step_score: number | null
  talk_listen_balance_score: number | null
  competitor_risk_score: number | null
  confidence_score: number | null
  risk_level: string | null
  outcome: string | null
  detected_objections: unknown
  buying_signals: unknown
  competitor_mentions: unknown
  discovery_gaps: unknown
  next_step_commitments: unknown
  coaching_opportunities: unknown
  safe_summary: string | null
  recommended_next_action: string | null
  metrics: unknown
  computed_at: string
}

function scorecardsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("call_intelligence_scorecards")
}

function mapSignalLabels(raw: unknown): CallIntelligenceScorecardPublicView["detectedObjections"] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const row = entry as Record<string, unknown>
      return { key: String(row.key ?? "signal"), label: String(row.label ?? "Signal") }
    })
}

function mapMetrics(raw: unknown): CallIntelligenceScorecardPublicView["metrics"] {
  if (!raw || typeof raw !== "object") return {}
  const row = raw as Record<string, unknown>
  return {
    transcriptFinalizedCount: typeof row.transcriptFinalizedCount === "number" ? row.transcriptFinalizedCount : undefined,
    guidanceGeneratedCount: typeof row.guidanceGeneratedCount === "number" ? row.guidanceGeneratedCount : undefined,
    sessionHealthScore: typeof row.sessionHealthScore === "number" ? row.sessionHealthScore : undefined,
    executionScore: typeof row.executionScore === "number" ? row.executionScore : undefined,
    providerInterruptions: typeof row.providerInterruptions === "number" ? row.providerInterruptions : undefined,
    guidanceLatencyMs: typeof row.guidanceLatencyMs === "number" ? row.guidanceLatencyMs : undefined,
    sessionDurationMs: typeof row.sessionDurationMs === "number" ? row.sessionDurationMs : undefined,
    incomplete: row.incomplete === true,
  }
}

export function mapCallIntelligenceScorecardRow(row: ScorecardRow): CallIntelligenceScorecardPublicView {
  return {
    id: row.id,
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    meetingId: row.meeting_id,
    realtimeSessionId: row.realtime_session_id,
    ownerUserId: row.owner_user_id,
    overallScore: row.overall_score ?? 0,
    conversationQualityScore: row.conversation_quality_score ?? 0,
    discoveryScore: row.discovery_score ?? 0,
    objectionHandlingScore: row.objection_handling_score ?? 0,
    buyingSignalScore: row.buying_signal_score ?? 0,
    nextStepScore: row.next_step_score ?? 0,
    talkListenBalanceScore: row.talk_listen_balance_score ?? 0,
    competitorRiskScore: row.competitor_risk_score ?? 0,
    confidenceScore: row.confidence_score ?? 0,
    riskLevel: (row.risk_level ?? "medium") as CallIntelligenceScorecardPublicView["riskLevel"],
    outcome: (row.outcome ?? "unknown") as CallIntelligenceScorecardPublicView["outcome"],
    detectedObjections: mapSignalLabels(row.detected_objections),
    buyingSignals: mapSignalLabels(row.buying_signals),
    competitorMentions: mapSignalLabels(row.competitor_mentions),
    discoveryGaps: mapSignalLabels(row.discovery_gaps),
    nextStepCommitments: mapSignalLabels(row.next_step_commitments),
    coachingOpportunities: mapSignalLabels(row.coaching_opportunities),
    safeSummary: row.safe_summary ?? "",
    recommendedNextAction: row.recommended_next_action ?? "Manual review",
    metrics: mapMetrics(row.metrics),
    computedAt: row.computed_at,
  }
}

export async function fetchCallIntelligenceScorecardBySession(
  admin: SupabaseClient,
  realtimeSessionId: string,
): Promise<CallIntelligenceScorecardPublicView | null> {
  const { data, error } = await scorecardsTable(admin)
    .select(SCORECARD_SELECT)
    .eq("realtime_session_id", realtimeSessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCallIntelligenceScorecardRow(data as ScorecardRow) : null
}

export async function fetchLatestCallIntelligenceScorecardForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<CallIntelligenceScorecardPublicView | null> {
  const { data, error } = await scorecardsTable(admin)
    .select(SCORECARD_SELECT)
    .eq("lead_id", leadId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCallIntelligenceScorecardRow(data as ScorecardRow) : null
}

export async function upsertCallIntelligenceScorecard(
  admin: SupabaseClient,
  input: {
    leadId: string
    opportunityId: string | null
    meetingId: string | null
    realtimeSessionId: string | null
    ownerUserId: string | null
    computed: ComputedCallIntelligenceScore
    signals: CallIntelligenceExtractedSignals
    safeSummary: string
  },
): Promise<CallIntelligenceScorecardPublicView> {
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    throw new Error("Call intelligence is not configured. Set GROWTH_ENGINE_AI_ORG_ID on the server.")
  }

  const row = {
    organization_id: organizationId,
    lead_id: input.leadId,
    opportunity_id: input.opportunityId,
    meeting_id: input.meetingId,
    realtime_session_id: input.realtimeSessionId,
    owner_user_id: input.ownerUserId,
    score_version: CALL_INTELLIGENCE_SCORE_VERSION,
    overall_score: input.computed.overallScore,
    conversation_quality_score: input.computed.conversationQualityScore,
    discovery_score: input.computed.discoveryScore,
    objection_handling_score: input.computed.objectionHandlingScore,
    buying_signal_score: input.computed.buyingSignalScore,
    next_step_score: input.computed.nextStepScore,
    talk_listen_balance_score: input.computed.talkListenBalanceScore,
    competitor_risk_score: input.computed.competitorRiskScore,
    confidence_score: input.computed.confidenceScore,
    risk_level: input.computed.riskLevel,
    outcome: input.computed.outcome,
    detected_objections: input.signals.detectedObjections,
    buying_signals: input.signals.buyingSignals,
    competitor_mentions: input.signals.competitorMentions,
    discovery_gaps: input.signals.discoveryGaps,
    next_step_commitments: input.signals.nextStepCommitments,
    coaching_opportunities: input.signals.coachingOpportunities,
    safe_summary: input.safeSummary,
    recommended_next_action: input.computed.recommendedNextAction,
    metrics: input.computed.metrics,
    computed_at: new Date().toISOString(),
  }

  if (input.realtimeSessionId) {
    const { data: existing } = await scorecardsTable(admin)
      .select("id")
      .eq("realtime_session_id", input.realtimeSessionId)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await scorecardsTable(admin)
        .update(row)
        .eq("id", existing.id)
        .select(SCORECARD_SELECT)
        .single()
      if (error) throw new Error(error.message)
      return mapCallIntelligenceScorecardRow(data as ScorecardRow)
    }
  }

  const { data, error } = await scorecardsTable(admin).insert(row).select(SCORECARD_SELECT).single()
  if (error) throw new Error(error.message)
  return mapCallIntelligenceScorecardRow(data as ScorecardRow)
}

export async function fetchCallIntelligenceDashboardSummary(
  admin: SupabaseClient,
): Promise<CallIntelligenceDashboardSummary> {
  const { data, error } = await scorecardsTable(admin)
    .select(SCORECARD_SELECT)
    .order("computed_at", { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as ScorecardRow[]).map(mapCallIntelligenceScorecardRow)
  const scoredCalls = rows.length
  const averageCallScore =
    scoredCalls > 0 ? Math.round(rows.reduce((sum, row) => sum + row.overallScore, 0) / scoredCalls) : 0
  const criticalCallRisks = rows.filter((row) => row.riskLevel === "critical").length
  const callsNeedingFollowUp = rows.filter(
    (row) => row.nextStepScore < 45 || row.recommendedNextAction.toLowerCase().includes("follow-up"),
  ).length
  const unresolvedObjections = rows.reduce((sum, row) => sum + row.detectedObjections.length, 0)
  const competitorMentions = rows.reduce((sum, row) => sum + row.competitorMentions.length, 0)
  const nextStepMissingCount = rows.filter((row) => row.nextStepScore < 45).length

  const coachingCounts = new Map<string, { key: string; label: string; count: number }>()
  for (const row of rows) {
    for (const item of row.coachingOpportunities) {
      const existing = coachingCounts.get(item.key)
      if (existing) existing.count += 1
      else coachingCounts.set(item.key, { key: item.key, label: item.label, count: 1 })
    }
  }

  const topCoachingOpportunities = [...coachingCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    qaMarker: GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
    averageCallScore,
    criticalCallRisks,
    callsNeedingFollowUp,
    unresolvedObjections,
    competitorMentions,
    nextStepMissingCount,
    topCoachingOpportunities,
    scoredCalls,
  }
}

export function logCallIntelligence(event: string, details: Record<string, unknown>): void {
  logGrowthEngine(`call_intelligence_${event}`, details)
}

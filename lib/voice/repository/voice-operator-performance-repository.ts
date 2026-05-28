import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VoiceOperatorPerformanceInsightPublicView, VoiceOperatorPerformanceInsightType } from "@/lib/voice/copilot-strategy/types"
import type { VoiceCopilotStrategySnapshot } from "@/lib/voice/copilot-strategy/types"

type InsightRow = {
  id: string
  insight_type: VoiceOperatorPerformanceInsightType
  metric_value: number | null
  evidence_text: string
  confidence_score: number
  coaching_prompt: string | null
  created_at: string
}

function mapRow(row: InsightRow): VoiceOperatorPerformanceInsightPublicView {
  return {
    id: row.id,
    insightType: row.insight_type,
    metricValue: row.metric_value != null ? Number(row.metric_value) : null,
    evidenceText: row.evidence_text,
    confidenceScore: Number(row.confidence_score),
    coachingPrompt: row.coaching_prompt,
    createdAt: row.created_at,
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

export async function listOperatorPerformanceInsights(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
  limit = 10,
): Promise<VoiceOperatorPerformanceInsightPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_operator_performance_insights")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data as InsightRow[]).map(mapRow)
}

export async function syncOperatorPerformanceInsightsFromStrategy(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    operatorUserId?: string | null
    strategy: VoiceCopilotStrategySnapshot
  },
): Promise<VoiceOperatorPerformanceInsightPublicView[]> {
  const candidates: Array<{
    insightType: VoiceOperatorPerformanceInsightType
    metricValue: number | null
    evidenceText: string
    confidenceScore: number
    coachingPrompt: string | null
  }> = [
    {
      insightType: "pacing_consistency",
      metricValue: input.strategy.pacing.operatorTalkPercent,
      evidenceText: input.strategy.pacing.evidenceText,
      confidenceScore: input.strategy.pacing.confidenceScore,
      coachingPrompt:
        input.strategy.pacing.pacingLabel === "operator_heavy"
          ? "Balance talk time — ask open questions."
          : null,
    },
    {
      insightType: "escalation_avoidance",
      metricValue: input.strategy.escalationLikelihood.score,
      evidenceText: input.strategy.escalationLikelihood.evidenceText,
      confidenceScore: input.strategy.escalationLikelihood.confidenceScore,
      coachingPrompt:
        input.strategy.escalationLikelihood.level !== "low"
          ? "De-escalate before continuing the pitch."
          : null,
    },
  ]

  if (input.strategy.objectionStage.activeObjectionCount > 0) {
    candidates.push({
      insightType: "objection_recovery",
      metricValue: input.strategy.objectionStage.activeObjectionCount,
      evidenceText: input.strategy.objectionStage.evidenceText,
      confidenceScore: input.strategy.objectionStage.confidenceScore,
      coachingPrompt: "Acknowledge objections before advancing.",
    })
  }

  if (input.strategy.closeReadiness.ready) {
    candidates.push({
      insightType: "booking_assistance",
      metricValue: input.strategy.closeReadiness.score,
      evidenceText: input.strategy.closeReadiness.evidenceText,
      confidenceScore: input.strategy.closeReadiness.confidenceScore,
      coachingPrompt: "Close timing looks favorable — operator confirms next step.",
    })
  }

  for (const candidate of candidates) {
    if (!candidate.coachingPrompt && candidate.metricValue == null) continue
    await admin.schema("voice").from("voice_operator_performance_insights").insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      operator_user_id: input.operatorUserId ?? null,
      insight_type: candidate.insightType,
      metric_value: candidate.metricValue,
      evidence_text: candidate.evidenceText,
      confidence_score: candidate.confidenceScore,
      coaching_prompt: candidate.coachingPrompt,
    })
  }

  return listOperatorPerformanceInsights(admin, input.organizationId, input.voiceCallId)
}

export async function countOperatorPerformanceInsights(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_operator_performance_insights")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

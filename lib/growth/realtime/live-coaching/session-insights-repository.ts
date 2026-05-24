import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveCoachingSessionInsightsRollup } from "@/lib/growth/realtime/live-coaching/session-insights-types"

const INSIGHTS_SELECT =
  "session_id, lead_id, session_duration_ms, provider_id, transcript_finalized_count, guidance_generated_count, objection_count, buying_signal_count, discovery_gap_count, competitor_pressure_count, provider_interruptions, reconnect_attempts, retry_attempts, fallback_count, average_transcript_latency_ms, max_transcript_latency_ms, session_health_score, risk_level, computed_at"

type InsightsDbRow = {
  session_id: string
  lead_id: string
  session_duration_ms: number
  provider_id: string | null
  transcript_finalized_count: number
  guidance_generated_count: number
  objection_count: number
  buying_signal_count: number
  discovery_gap_count: number
  competitor_pressure_count: number
  provider_interruptions: number
  reconnect_attempts: number
  retry_attempts: number
  fallback_count: number
  average_transcript_latency_ms: number
  max_transcript_latency_ms: number
  session_health_score: number
  risk_level: string
  computed_at: string
}

function insightsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("realtime_call_session_insights")
}

function mapInsightsRow(row: InsightsDbRow): LiveCoachingSessionInsightsRollup {
  return {
    sessionId: row.session_id,
    leadId: row.lead_id,
    sessionDurationMs: row.session_duration_ms,
    providerId: row.provider_id,
    transcriptFinalizedCount: row.transcript_finalized_count,
    guidanceGeneratedCount: row.guidance_generated_count,
    objectionCount: row.objection_count,
    buyingSignalCount: row.buying_signal_count,
    discoveryGapCount: row.discovery_gap_count,
    competitorPressureCount: row.competitor_pressure_count,
    providerInterruptions: row.provider_interruptions,
    reconnectAttempts: row.reconnect_attempts,
    retryAttempts: row.retry_attempts,
    fallbackCount: row.fallback_count,
    averageTranscriptLatencyMs: row.average_transcript_latency_ms,
    maxTranscriptLatencyMs: row.max_transcript_latency_ms,
    sessionHealthScore: row.session_health_score,
    riskLevel: row.risk_level as LiveCoachingSessionInsightsRollup["riskLevel"],
    computedAt: row.computed_at,
  }
}

function rollupToInsertRow(rollup: LiveCoachingSessionInsightsRollup) {
  const now = new Date().toISOString()
  return {
    session_id: rollup.sessionId,
    lead_id: rollup.leadId,
    session_duration_ms: rollup.sessionDurationMs,
    provider_id: rollup.providerId,
    transcript_finalized_count: rollup.transcriptFinalizedCount,
    guidance_generated_count: rollup.guidanceGeneratedCount,
    objection_count: rollup.objectionCount,
    buying_signal_count: rollup.buyingSignalCount,
    discovery_gap_count: rollup.discoveryGapCount,
    competitor_pressure_count: rollup.competitorPressureCount,
    provider_interruptions: rollup.providerInterruptions,
    reconnect_attempts: rollup.reconnectAttempts,
    retry_attempts: rollup.retryAttempts,
    fallback_count: rollup.fallbackCount,
    average_transcript_latency_ms: rollup.averageTranscriptLatencyMs,
    max_transcript_latency_ms: rollup.maxTranscriptLatencyMs,
    session_health_score: rollup.sessionHealthScore,
    risk_level: rollup.riskLevel,
    computed_at: rollup.computedAt,
    updated_at: now,
  }
}

export async function fetchLiveCoachingSessionInsightsRollup(
  admin: SupabaseClient,
  input: { sessionId: string; leadId: string },
): Promise<LiveCoachingSessionInsightsRollup | null> {
  const { data, error } = await insightsTable(admin)
    .select(INSIGHTS_SELECT)
    .eq("session_id", input.sessionId)
    .eq("lead_id", input.leadId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapInsightsRow(data as InsightsDbRow)
}

export async function upsertLiveCoachingSessionInsightsRollup(
  admin: SupabaseClient,
  rollup: LiveCoachingSessionInsightsRollup,
): Promise<LiveCoachingSessionInsightsRollup> {
  const { data, error } = await insightsTable(admin)
    .upsert(rollupToInsertRow(rollup), { onConflict: "session_id" })
    .select(INSIGHTS_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapInsightsRow(data as InsightsDbRow)
}

export async function listLiveCoachingSessionInsightsRollups(
  admin: SupabaseClient,
  sessionIds: string[],
): Promise<LiveCoachingSessionInsightsRollup[]> {
  if (sessionIds.length === 0) return []

  const { data, error } = await insightsTable(admin)
    .select(INSIGHTS_SELECT)
    .in("session_id", sessionIds)

  if (error) throw new Error(error.message)
  return ((data ?? []) as InsightsDbRow[]).map(mapInsightsRow)
}

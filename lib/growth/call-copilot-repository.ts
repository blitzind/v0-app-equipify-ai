import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import {
  computeBriefEffectivenessScore,
} from "@/lib/growth/call-copilot-heuristics"
import type {
  GrowthCallBriefEffectivenessOutcome,
  GrowthCallCopilotBriefing,
  GrowthCallCopilotCapturedSignal,
  GrowthCallCopilotLiveGuidanceMode,
  GrowthCallCopilotObjectionEntry,
  GrowthCallCopilotSession,
  GrowthCallCopilotSessionStatus,
} from "@/lib/growth/call-copilot-types"

type SessionDbRow = {
  id: string
  lead_id: string
  call_session_id: string | null
  status: string
  live_guidance_mode: string
  started_at: string | null
  ended_at: string | null
  call_goal: string | null
  call_context_snapshot: unknown
  live_notes: string
  detected_objections: unknown
  detected_buying_signals: unknown
  detected_commitment_signals: unknown
  recommended_responses: unknown
  post_call_summary: string | null
  recommended_next_step: string | null
  suggested_disposition: string | null
  call_outcome_confidence: number
  post_call_generation_id: string | null
  summary_approved_at: string | null
  summary_approved_by: string | null
  disposition_approved_at: string | null
  disposition_approved_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const SESSION_SELECT =
  "id, lead_id, call_session_id, status, live_guidance_mode, started_at, ended_at, call_goal, call_context_snapshot, live_notes, detected_objections, detected_buying_signals, detected_commitment_signals, recommended_responses, post_call_summary, recommended_next_step, suggested_disposition, call_outcome_confidence, post_call_generation_id, summary_approved_at, summary_approved_by, disposition_approved_at, disposition_approved_by, created_by, created_at, updated_at"

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("call_copilot_sessions")
}

function effectivenessTable(admin: SupabaseClient) {
  return admin.schema("growth").from("call_brief_effectiveness")
}

function mapSession(row: SessionDbRow): GrowthCallCopilotSession {
  const snapshot = (row.call_context_snapshot as Record<string, unknown>) ?? {}
  return {
    id: row.id,
    leadId: row.lead_id,
    callSessionId: row.call_session_id,
    status: row.status as GrowthCallCopilotSessionStatus,
    liveGuidanceMode: row.live_guidance_mode as GrowthCallCopilotLiveGuidanceMode,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    callGoal: row.call_goal,
    callContextSnapshot: snapshot,
    liveNotes: row.live_notes,
    detectedObjections: (row.detected_objections as GrowthCallCopilotObjectionEntry[]) ?? [],
    detectedBuyingSignals: (row.detected_buying_signals as GrowthCallCopilotCapturedSignal[]) ?? [],
    detectedCommitmentSignals: (row.detected_commitment_signals as GrowthCallCopilotCapturedSignal[]) ?? [],
    recommendedResponses: (row.recommended_responses as Record<string, unknown>) ?? {},
    postCallSummary: row.post_call_summary,
    recommendedNextStep: row.recommended_next_step,
    suggestedDisposition: row.suggested_disposition as GrowthLeadCallDisposition | null,
    callOutcomeConfidence: row.call_outcome_confidence,
    postCallGenerationId: row.post_call_generation_id,
    summaryApprovedAt: row.summary_approved_at,
    summaryApprovedBy: row.summary_approved_by,
    dispositionApprovedAt: row.disposition_approved_at,
    dispositionApprovedBy: row.disposition_approved_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getCallCopilotBriefing(session: GrowthCallCopilotSession): GrowthCallCopilotBriefing | null {
  const briefing = session.callContextSnapshot.briefing
  if (!briefing || typeof briefing !== "object") return null
  return briefing as GrowthCallCopilotBriefing
}

export async function listGrowthCallCopilotSessionsForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 20,
): Promise<GrowthCallCopilotSession[]> {
  const { data, error } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSession(row as SessionDbRow))
}

export async function fetchGrowthCallCopilotSession(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string },
): Promise<GrowthCallCopilotSession | null> {
  const { data, error } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("id", input.sessionId)
    .eq("lead_id", input.leadId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapSession(data as SessionDbRow) : null
}

export async function insertGrowthCallCopilotSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    callSessionId?: string | null
    callGoal?: string | null
    briefing: GrowthCallCopilotBriefing
    liveGuidanceMode?: GrowthCallCopilotLiveGuidanceMode
    createdBy: string
  },
): Promise<GrowthCallCopilotSession> {
  const now = new Date().toISOString()
  const { data, error } = await sessionsTable(admin)
    .insert({
      lead_id: input.leadId,
      call_session_id: input.callSessionId ?? null,
      status: "pre_call",
      live_guidance_mode: input.liveGuidanceMode ?? "manual",
      call_goal: input.callGoal ?? null,
      call_context_snapshot: { briefing: input.briefing },
      created_by: input.createdBy,
      updated_at: now,
    })
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapSession(data as SessionDbRow)
}

export async function updateGrowthCallCopilotSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    patch: Partial<{
      status: GrowthCallCopilotSessionStatus
      startedAt: string | null
      endedAt: string | null
      callGoal: string | null
      liveNotes: string
      detectedObjections: GrowthCallCopilotObjectionEntry[]
      detectedBuyingSignals: GrowthCallCopilotCapturedSignal[]
      detectedCommitmentSignals: GrowthCallCopilotCapturedSignal[]
      recommendedResponses: Record<string, unknown>
      postCallSummary: string | null
      recommendedNextStep: string | null
      suggestedDisposition: GrowthLeadCallDisposition | null
      callOutcomeConfidence: number
      postCallGenerationId: string | null
      summaryApprovedAt: string | null
      summaryApprovedBy: string | null
      dispositionApprovedAt: string | null
      dispositionApprovedBy: string | null
    }>
  },
): Promise<GrowthCallCopilotSession> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.status !== undefined) dbPatch.status = input.patch.status
  if (input.patch.startedAt !== undefined) dbPatch.started_at = input.patch.startedAt
  if (input.patch.endedAt !== undefined) dbPatch.ended_at = input.patch.endedAt
  if (input.patch.callGoal !== undefined) dbPatch.call_goal = input.patch.callGoal
  if (input.patch.liveNotes !== undefined) dbPatch.live_notes = input.patch.liveNotes
  if (input.patch.detectedObjections !== undefined) dbPatch.detected_objections = input.patch.detectedObjections
  if (input.patch.detectedBuyingSignals !== undefined) dbPatch.detected_buying_signals = input.patch.detectedBuyingSignals
  if (input.patch.detectedCommitmentSignals !== undefined) {
    dbPatch.detected_commitment_signals = input.patch.detectedCommitmentSignals
  }
  if (input.patch.recommendedResponses !== undefined) dbPatch.recommended_responses = input.patch.recommendedResponses
  if (input.patch.postCallSummary !== undefined) dbPatch.post_call_summary = input.patch.postCallSummary
  if (input.patch.recommendedNextStep !== undefined) dbPatch.recommended_next_step = input.patch.recommendedNextStep
  if (input.patch.suggestedDisposition !== undefined) dbPatch.suggested_disposition = input.patch.suggestedDisposition
  if (input.patch.callOutcomeConfidence !== undefined) {
    dbPatch.call_outcome_confidence = input.patch.callOutcomeConfidence
  }
  if (input.patch.postCallGenerationId !== undefined) dbPatch.post_call_generation_id = input.patch.postCallGenerationId
  if (input.patch.summaryApprovedAt !== undefined) dbPatch.summary_approved_at = input.patch.summaryApprovedAt
  if (input.patch.summaryApprovedBy !== undefined) dbPatch.summary_approved_by = input.patch.summaryApprovedBy
  if (input.patch.dispositionApprovedAt !== undefined) {
    dbPatch.disposition_approved_at = input.patch.dispositionApprovedAt
  }
  if (input.patch.dispositionApprovedBy !== undefined) {
    dbPatch.disposition_approved_by = input.patch.dispositionApprovedBy
  }

  const { data, error } = await sessionsTable(admin)
    .update(dbPatch)
    .eq("id", input.sessionId)
    .eq("lead_id", input.leadId)
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapSession(data as SessionDbRow)
}

export async function insertGrowthCallBriefEffectiveness(
  admin: SupabaseClient,
  input: {
    sessionId: string
    leadId: string
    outcome: GrowthCallBriefEffectivenessOutcome
    highRiskCall: boolean
    callOutcomeConfidence: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const effectivenessScore = computeBriefEffectivenessScore(input.outcome, input.callOutcomeConfidence)
  const { error } = await effectivenessTable(admin).insert({
    call_copilot_session_id: input.sessionId,
    lead_id: input.leadId,
    outcome: input.outcome,
    high_risk_call: input.highRiskCall,
    call_outcome_confidence: input.callOutcomeConfidence,
    effectiveness_score: effectivenessScore,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function listRecentGrowthCallCopilotSessions(
  admin: SupabaseClient,
  limit = 100,
): Promise<GrowthCallCopilotSession[]> {
  const { data, error } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSession(row as SessionDbRow))
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthBrowserAudioCaptureStatus,
  GrowthRealtimeCallSession,
  GrowthRealtimeCallSessionStatus,
  GrowthRealtimeCallSpeaker,
  GrowthRealtimeCallTranscriptStatus,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import { emptyRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-live-snapshot-defaults"

type SessionRow = {
  id: string
  lead_id: string
  call_copilot_session_id: string | null
  status: string
  started_at: string | null
  ended_at: string | null
  live_guidance_mode: string
  transcript_status: string
  guidance_enabled: boolean
  risk_monitoring_enabled: boolean
  live_snapshot: unknown
  realtime_provider_connection_id: string | null
  provider_id: string | null
  transcript_source: string
  transcript_quality_score: number
  guidance_latency_ms: number
  session_provider_failover_count: number
  browser_audio_capture_enabled: boolean
  browser_audio_capture_status: string
  browser_audio_started_at: string | null
  browser_audio_ended_at: string | null
  browser_audio_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type TranscriptRow = {
  id: string
  session_id: string
  speaker: string
  content: string
  sequence_number: number
  timestamp_ms: number
  created_at: string
}

const SESSION_SELECT =
  "id, lead_id, call_copilot_session_id, status, started_at, ended_at, live_guidance_mode, transcript_status, guidance_enabled, risk_monitoring_enabled, live_snapshot, realtime_provider_connection_id, provider_id, transcript_source, transcript_quality_score, guidance_latency_ms, session_provider_failover_count, browser_audio_capture_enabled, browser_audio_capture_status, browser_audio_started_at, browser_audio_ended_at, browser_audio_error, created_by, created_at, updated_at"

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("realtime_call_sessions")
}

function transcriptTable(admin: SupabaseClient) {
  return admin.schema("growth").from("realtime_call_transcript_events")
}

function mapSession(row: SessionRow): GrowthRealtimeCallSession {
  const snapshot = (row.live_snapshot as GrowthRealtimeLiveSnapshot | null) ?? emptyRealtimeLiveSnapshot()
  return {
    id: row.id,
    leadId: row.lead_id,
    callCopilotSessionId: row.call_copilot_session_id,
    status: row.status as GrowthRealtimeCallSessionStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    liveGuidanceMode: row.live_guidance_mode as "manual" | "future_realtime",
    transcriptStatus: row.transcript_status as GrowthRealtimeCallTranscriptStatus,
    guidanceEnabled: row.guidance_enabled,
    riskMonitoringEnabled: row.risk_monitoring_enabled,
    liveSnapshot: snapshot,
    realtimeProviderConnectionId: row.realtime_provider_connection_id,
    providerId: row.provider_id,
    transcriptSource: row.transcript_source as GrowthRealtimeCallSession["transcriptSource"],
    transcriptQualityScore: row.transcript_quality_score,
    guidanceLatencyMs: row.guidance_latency_ms,
    sessionProviderFailoverCount: row.session_provider_failover_count,
    browserAudioCaptureEnabled: row.browser_audio_capture_enabled ?? false,
    browserAudioCaptureStatus: (row.browser_audio_capture_status ??
      "inactive") as GrowthBrowserAudioCaptureStatus,
    browserAudioStartedAt: row.browser_audio_started_at ?? null,
    browserAudioEndedAt: row.browser_audio_ended_at ?? null,
    browserAudioError: row.browser_audio_error ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTranscript(row: TranscriptRow): GrowthRealtimeTranscriptEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    speaker: row.speaker as GrowthRealtimeCallSpeaker,
    content: row.content,
    sequenceNumber: row.sequence_number,
    timestampMs: row.timestamp_ms,
    createdAt: row.created_at,
  }
}

export async function fetchGrowthRealtimeCallSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GrowthRealtimeCallSession | null> {
  const { data, error } = await sessionsTable(admin).select(SESSION_SELECT).eq("id", sessionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapSession(data as SessionRow)
}

export async function listGrowthRealtimeCallSessionsForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 10,
): Promise<GrowthRealtimeCallSession[]> {
  const { data, error } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as SessionRow[]).map(mapSession)
}

export async function insertGrowthRealtimeCallSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    callCopilotSessionId?: string | null
    createdBy?: string | null
  },
): Promise<GrowthRealtimeCallSession> {
  const { data, error } = await sessionsTable(admin)
    .insert({
      lead_id: input.leadId,
      call_copilot_session_id: input.callCopilotSessionId ?? null,
      created_by: input.createdBy ?? null,
      live_snapshot: emptyRealtimeLiveSnapshot(),
    })
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapSession(data as SessionRow)
}

export async function updateGrowthRealtimeCallSession(
  admin: SupabaseClient,
  sessionId: string,
  patch: Partial<{
    status: GrowthRealtimeCallSessionStatus
    startedAt: string | null
    endedAt: string | null
    transcriptStatus: GrowthRealtimeCallTranscriptStatus
    liveSnapshot: GrowthRealtimeLiveSnapshot
    realtimeProviderConnectionId: string | null
    providerId: string | null
    transcriptSource: GrowthRealtimeCallSession["transcriptSource"]
    transcriptQualityScore: number
    guidanceLatencyMs: number
    sessionProviderFailoverCount: number
    browserAudioCaptureEnabled: boolean
    browserAudioCaptureStatus: GrowthBrowserAudioCaptureStatus
    browserAudioStartedAt: string | null
    browserAudioEndedAt: string | null
    browserAudioError: string | null
  }>,
): Promise<GrowthRealtimeCallSession> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) update.status = patch.status
  if (patch.startedAt !== undefined) update.started_at = patch.startedAt
  if (patch.endedAt !== undefined) update.ended_at = patch.endedAt
  if (patch.transcriptStatus !== undefined) update.transcript_status = patch.transcriptStatus
  if (patch.liveSnapshot !== undefined) update.live_snapshot = patch.liveSnapshot
  if (patch.realtimeProviderConnectionId !== undefined) {
    update.realtime_provider_connection_id = patch.realtimeProviderConnectionId
  }
  if (patch.providerId !== undefined) update.provider_id = patch.providerId
  if (patch.transcriptSource !== undefined) update.transcript_source = patch.transcriptSource
  if (patch.transcriptQualityScore !== undefined) update.transcript_quality_score = patch.transcriptQualityScore
  if (patch.guidanceLatencyMs !== undefined) update.guidance_latency_ms = patch.guidanceLatencyMs
  if (patch.sessionProviderFailoverCount !== undefined) {
    update.session_provider_failover_count = patch.sessionProviderFailoverCount
  }
  if (patch.browserAudioCaptureEnabled !== undefined) {
    update.browser_audio_capture_enabled = patch.browserAudioCaptureEnabled
  }
  if (patch.browserAudioCaptureStatus !== undefined) {
    update.browser_audio_capture_status = patch.browserAudioCaptureStatus
  }
  if (patch.browserAudioStartedAt !== undefined) {
    update.browser_audio_started_at = patch.browserAudioStartedAt
  }
  if (patch.browserAudioEndedAt !== undefined) {
    update.browser_audio_ended_at = patch.browserAudioEndedAt
  }
  if (patch.browserAudioError !== undefined) {
    update.browser_audio_error = patch.browserAudioError
  }

  const { data, error } = await sessionsTable(admin)
    .update(update)
    .eq("id", sessionId)
    .select(SESSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapSession(data as SessionRow)
}

export async function listGrowthRealtimeTranscriptEvents(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GrowthRealtimeTranscriptEvent[]> {
  const { data, error } = await transcriptTable(admin)
    .select("id, session_id, speaker, content, sequence_number, timestamp_ms, created_at")
    .eq("session_id", sessionId)
    .order("sequence_number", { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as TranscriptRow[]).map(mapTranscript)
}

export async function appendGrowthRealtimeTranscriptEvent(
  admin: SupabaseClient,
  input: {
    sessionId: string
    speaker: GrowthRealtimeCallSpeaker
    content: string
    sequenceNumber: number
    timestampMs?: number
  },
): Promise<GrowthRealtimeTranscriptEvent> {
  const { data, error } = await transcriptTable(admin)
    .insert({
      session_id: input.sessionId,
      speaker: input.speaker,
      content: input.content.trim(),
      sequence_number: input.sequenceNumber,
      timestamp_ms: input.timestampMs ?? 0,
    })
    .select("id, session_id, speaker, content, sequence_number, timestamp_ms, created_at")
    .single()
  if (error) throw new Error(error.message)
  return mapTranscript(data as TranscriptRow)
}

export async function listActiveGrowthRealtimeCallSessions(
  admin: SupabaseClient,
  limit = 50,
): Promise<Array<GrowthRealtimeCallSession & { companyName: string }>> {
  const { data, error } = await sessionsTable(admin)
    .select(`${SESSION_SELECT}, leads!inner(company_name)`)
    .in("status", ["preparing", "active", "paused"])
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<SessionRow & { leads: { company_name: string } }>).map((row) => ({
    ...mapSession(row),
    companyName: row.leads.company_name,
  }))
}

export async function listRecentGrowthRealtimeCallSessions(
  admin: SupabaseClient,
  limit = 100,
): Promise<Array<GrowthRealtimeCallSession & { companyName: string }>> {
  const { data, error } = await sessionsTable(admin)
    .select(`${SESSION_SELECT}, leads!inner(company_name)`)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<SessionRow & { leads: { company_name: string } }>).map((row) => ({
    ...mapSession(row),
    companyName: row.leads.company_name,
  }))
}

export async function fetchGrowthRealtimeCallSessionsByIds(
  admin: SupabaseClient,
  sessionIds: string[],
): Promise<GrowthRealtimeCallSession[]> {
  if (sessionIds.length === 0) return []

  const { data, error } = await sessionsTable(admin)
    .select(SESSION_SELECT)
    .in("id", sessionIds)
  if (error) throw new Error(error.message)

  return ((data ?? []) as SessionRow[]).map(mapSession)
}

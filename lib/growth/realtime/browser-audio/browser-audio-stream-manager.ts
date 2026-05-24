import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emptyBrowserAudioStreamMetrics,
  initialBrowserAudioStreamState,
  providerSupportsBrowserAudioStreaming,
  type GrowthBrowserAudioStreamMetrics,
  type GrowthBrowserAudioStreamState,
  type GrowthBrowserAudioStreamStatus,
} from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import { mapBrowserAudioProviderError } from "@/lib/growth/realtime/browser-audio/browser-audio-provider-errors"
import { ProviderStreamingUnavailableError } from "@/lib/growth/realtime/browser-audio/browser-audio-chunk-errors"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"
import { ingestRealtimeProviderTranscriptChunk } from "@/lib/growth/realtime/providers/provider-stream-bridge"
import {
  getActiveProviderForSession,
  isBrowserAudioStreamProvider,
} from "@/lib/growth/realtime/providers/provider-session-manager"
import { updateGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import { recordRealtimeProviderOperationalEvent } from "@/lib/growth/realtime/providers/realtime-provider-metrics"
import type { RealtimeProviderLifecycleEventType } from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"
import {
  emitLiveCoachingProviderConnectedTimeline,
  emitLiveCoachingProviderConnectingTimeline,
  emitLiveCoachingProviderDegradedTimeline,
  emitLiveCoachingProviderDisconnectedTimeline,
  emitLiveCoachingProviderRetryTimeline,
} from "@/lib/growth/realtime/live-coaching/session-timeline-emitter"

const MAX_STREAM_RECONNECT_ATTEMPTS = 3
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000] as const

type StreamSessionRecord = GrowthBrowserAudioStreamState & {
  sessionId: string
  providerId: string | null
  transcriptLatencyTotalMs: number
  transcriptLatencyCount: number
  lastIngestAt: number | null
}

const streamSessions = new Map<string, StreamSessionRecord>()

function getOrCreateStreamSession(sessionId: string, providerId: string | null): StreamSessionRecord {
  const existing = streamSessions.get(sessionId)
  if (existing) return existing
  const created: StreamSessionRecord = {
    ...initialBrowserAudioStreamState(),
    sessionId,
    providerId,
    transcriptLatencyTotalMs: 0,
    transcriptLatencyCount: 0,
    lastIngestAt: null,
  }
  streamSessions.set(sessionId, created)
  return created
}

function updateStreamMetrics(
  record: StreamSessionRecord,
  patch: Partial<GrowthBrowserAudioStreamMetrics> & { status?: GrowthBrowserAudioStreamStatus },
): GrowthBrowserAudioStreamState {
  if (patch.status) record.status = patch.status
  record.metrics = {
    ...record.metrics,
    ...patch,
  }
  record.metrics.canRetry =
    record.status === "interrupted" && record.metrics.reconnectAttempts < MAX_STREAM_RECONNECT_ATTEMPTS
  return {
    status: record.status,
    metrics: { ...record.metrics },
  }
}

export function getBrowserAudioStreamState(sessionId: string): GrowthBrowserAudioStreamState {
  const record = streamSessions.get(sessionId)
  if (!record) return initialBrowserAudioStreamState()
  return {
    status: record.status,
    metrics: { ...record.metrics },
  }
}

export function clearBrowserAudioStreamState(sessionId: string): void {
  streamSessions.delete(sessionId)
}

export function resetBrowserAudioStreamStateForTests(): void {
  streamSessions.clear()
}

function mapProviderErrorToLifecycleEvent(code: string): RealtimeProviderLifecycleEventType {
  if (code === "provider_auth_failed") return "auth_failure"
  if (code === "provider_rate_limited") return "rate_limit"
  if (code === "stream_timeout") return "timeout"
  return "provider_failure"
}

async function recordStreamOperationalEvent(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  eventType: RealtimeProviderLifecycleEventType,
  message: string,
  metadata?: Record<string, unknown>,
) {
  if (!session.realtimeProviderConnectionId) return
  await recordRealtimeProviderOperationalEvent(admin, {
    connectionId: session.realtimeProviderConnectionId,
    sessionId: session.id,
    eventType,
    message,
    metadata,
  })
}

export async function openBrowserAudioProviderStream(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  actor?: { userId: string | null; email: string | null },
): Promise<GrowthBrowserAudioStreamState> {
  if (!providerSupportsBrowserAudioStreaming(session.providerId)) {
    throw new ProviderStreamingUnavailableError()
  }

  const provider = getActiveProviderForSession(session.id)
  if (!provider || !isBrowserAudioStreamProvider(provider)) {
    throw new ProviderStreamingUnavailableError()
  }

  const record = getOrCreateStreamSession(session.id, session.providerId)
  updateStreamMetrics(record, { status: "connecting", streamFailureReason: null })
  await emitLiveCoachingProviderConnectingTimeline(admin, session)

  const transcriptStarted = Date.now()
  try {
    await provider.openBrowserAudioStream((chunk) => {
      const latencyMs =
        record.lastIngestAt != null ? Date.now() - record.lastIngestAt : Date.now() - transcriptStarted
      record.transcriptLatencyTotalMs += latencyMs
      record.transcriptLatencyCount += 1
      record.metrics.averageProviderTranscriptLatencyMs = Math.round(
        record.transcriptLatencyTotalMs / record.transcriptLatencyCount,
      )

      void ingestRealtimeProviderTranscriptChunk(admin, {
        session,
        chunk,
        actor,
        latencyMs,
      }).catch(async (error) => {
        const mapped = mapBrowserAudioProviderError(error)
        updateStreamMetrics(record, {
          status: "interrupted",
          streamFailureReason: mapped.message,
        })
        await updateGrowthRealtimeCallSession(admin, session.id, {
          transcriptStatus: "failed",
        })
        await emitLiveCoachingProviderDegradedTimeline(admin, session, {
          reasonCode: mapped.code,
        })
        if (session.realtimeProviderConnectionId) {
          void recordStreamOperationalEvent(admin, session, mapProviderErrorToLifecycleEvent(mapped.code), mapped.message)
        }
      })
    })
    if (session.realtimeProviderConnectionId) {
      await recordStreamOperationalEvent(admin, session, "stream_open", "Browser audio provider stream opened.")
    }
  } catch (error) {
    const mapped = mapBrowserAudioProviderError(error)
    updateStreamMetrics(record, {
      status: "interrupted",
      streamFailureReason: mapped.message,
      reconnectAttempts: record.metrics.reconnectAttempts + 1,
    })
    if (session.realtimeProviderConnectionId) {
      await recordStreamOperationalEvent(
        admin,
        session,
        mapProviderErrorToLifecycleEvent(mapped.code),
        mapped.message,
      )
    }
    throw new ProviderStreamingUnavailableError(mapped.message)
  }

  const state = updateStreamMetrics(record, {
    status: "listening",
    streamOpenCount: record.metrics.streamOpenCount + 1,
    streamFailureReason: null,
    reconnectAttempts: 0,
    lastActivityAt: new Date().toISOString(),
  })
  await emitLiveCoachingProviderConnectedTimeline(admin, session)
  return state
}

export async function ingestBrowserAudioProviderChunk(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  input: {
    encoding: string
    payloadBase64: string
    sequenceNumber: number
    timestampMs: number
    durationMs?: number
  },
): Promise<{ stream: GrowthBrowserAudioStreamState; providerTranscriptLatencyMs: number }> {
  const provider = getActiveProviderForSession(session.id)
  if (!provider || !isBrowserAudioStreamProvider(provider)) {
    throw new ProviderStreamingUnavailableError()
  }

  const record = getOrCreateStreamSession(session.id, session.providerId)
  if (record.status !== "listening") {
    await openBrowserAudioProviderStream(admin, session)
  }

  const payload = Buffer.from(input.payloadBase64, "base64")
  const started = Date.now()
  record.lastIngestAt = started

  try {
    await provider.ingestBrowserAudioChunk({
      encoding: input.encoding,
      payload,
      sequenceNumber: input.sequenceNumber,
      timestampMs: input.timestampMs,
      durationMs: input.durationMs,
    })
  } catch (error) {
    const mapped = mapBrowserAudioProviderError(error)
    updateStreamMetrics(record, {
      status: "interrupted",
      streamFailureReason: mapped.message,
      reconnectAttempts: record.metrics.reconnectAttempts + 1,
    })
    await recordStreamOperationalEvent(
      admin,
      session,
      mapProviderErrorToLifecycleEvent(mapped.code),
      mapped.message,
    )
    throw new ProviderStreamingUnavailableError(mapped.message)
  }

  updateStreamMetrics(record, { lastActivityAt: new Date().toISOString() })
  const providerTranscriptLatencyMs = record.metrics.averageProviderTranscriptLatencyMs
  void started
  return {
    stream: getBrowserAudioStreamState(session.id),
    providerTranscriptLatencyMs,
  }
}

export async function closeBrowserAudioProviderStream(
  sessionId: string,
  input?: { admin?: SupabaseClient; session?: GrowthRealtimeCallSession },
): Promise<GrowthBrowserAudioStreamState> {
  const provider = getActiveProviderForSession(sessionId)
  if (provider && isBrowserAudioStreamProvider(provider)) {
    await provider.closeBrowserAudioStream?.()
  }

  const record = streamSessions.get(sessionId)
  if (!record) return initialBrowserAudioStreamState()

  if (input?.admin && input?.session?.realtimeProviderConnectionId) {
    await recordStreamOperationalEvent(input.admin, input.session, "stream_close", "Browser audio provider stream closed.")
  }
  if (input?.admin && input?.session) {
    await emitLiveCoachingProviderDisconnectedTimeline(input.admin, input.session, {
      reasonCode: record.metrics.streamFailureReason,
    })
  }

  return updateStreamMetrics(record, {
    status: "closed",
    streamCloseCount: record.metrics.streamCloseCount + 1,
  })
}

export async function retryBrowserAudioProviderStream(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  actor?: { userId: string | null; email: string | null },
): Promise<GrowthBrowserAudioStreamState> {
  const record = getOrCreateStreamSession(session.id, session.providerId)
  if (record.metrics.reconnectAttempts >= MAX_STREAM_RECONNECT_ATTEMPTS) {
    throw new ProviderStreamingUnavailableError("Maximum stream retry attempts reached. Use manual transcript mode.")
  }

  const backoffMs = RECONNECT_BACKOFF_MS[record.metrics.reconnectAttempts] ?? 4000
  await new Promise((resolve) => setTimeout(resolve, backoffMs))

  if (session.realtimeProviderConnectionId) {
    await recordStreamOperationalEvent(admin, session, "reconnect_attempt", "Retrying browser audio provider stream.")
  }
  await emitLiveCoachingProviderRetryTimeline(admin, session, {
    attempt: record.metrics.reconnectAttempts + 1,
  })

  await closeBrowserAudioProviderStream(session.id, { admin, session })
  return openBrowserAudioProviderStream(admin, session, actor)
}

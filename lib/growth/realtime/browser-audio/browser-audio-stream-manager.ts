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
      }).catch(async (error) => {
        const mapped = mapBrowserAudioProviderError(error)
        updateStreamMetrics(record, {
          status: "interrupted",
          streamFailureReason: mapped.message,
        })
        await updateGrowthRealtimeCallSession(admin, session.id, {
          transcriptStatus: "failed",
        })
      })
    })
  } catch (error) {
    const mapped = mapBrowserAudioProviderError(error)
    updateStreamMetrics(record, {
      status: "interrupted",
      streamFailureReason: mapped.message,
      reconnectAttempts: record.metrics.reconnectAttempts + 1,
    })
    throw new ProviderStreamingUnavailableError(mapped.message)
  }

  return updateStreamMetrics(record, {
    status: "listening",
    streamOpenCount: record.metrics.streamOpenCount + 1,
    streamFailureReason: null,
    reconnectAttempts: 0,
  })
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
    throw new ProviderStreamingUnavailableError(mapped.message)
  }

  const providerTranscriptLatencyMs = record.metrics.averageProviderTranscriptLatencyMs
  void started
  return {
    stream: getBrowserAudioStreamState(session.id),
    providerTranscriptLatencyMs,
  }
}

export async function closeBrowserAudioProviderStream(sessionId: string): Promise<GrowthBrowserAudioStreamState> {
  const provider = getActiveProviderForSession(sessionId)
  if (provider && isBrowserAudioStreamProvider(provider)) {
    await provider.closeBrowserAudioStream?.()
  }

  const record = streamSessions.get(sessionId)
  if (!record) return initialBrowserAudioStreamState()

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

  await closeBrowserAudioProviderStream(session.id)
  return openBrowserAudioProviderStream(admin, session, actor)
}

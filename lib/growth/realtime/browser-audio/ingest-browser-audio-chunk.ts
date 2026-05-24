import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getBrowserAudioCaptureMetrics,
  getBrowserAudioLastChunkSequence,
  recordBrowserAudioChunkFailure,
  recordBrowserAudioChunkSequence,
  recordBrowserAudioChunkSuccess,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-service"
import { isDuplicateBrowserAudioChunkSequence } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-guards"
import { evaluateBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import type { GrowthBrowserAudioCaptureMetrics } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import {
  ProviderStreamingUnavailableError,
} from "@/lib/growth/realtime/browser-audio/browser-audio-chunk-errors"
import {
  ingestBrowserAudioProviderChunk,
} from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import { providerSupportsBrowserAudioStreaming } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"

export { ProviderStreamingUnavailableError, mapBrowserAudioChunkError } from "@/lib/growth/realtime/browser-audio/browser-audio-chunk-errors"

export type IngestBrowserAudioChunkInput = {
  sessionId: string
  leadId: string
  encoding: string
  payloadBase64: string
  sequenceNumber: number
  timestampMs: number
  durationMs?: number
}

export type IngestBrowserAudioChunkResult = {
  session: GrowthRealtimeCallSession
  metrics: GrowthBrowserAudioCaptureMetrics
  scaffold: boolean
  message: string
}

const MAX_CHUNK_BYTES = 256 * 1024

export async function ingestBrowserAudioChunk(
  admin: SupabaseClient,
  input: IngestBrowserAudioChunkInput,
): Promise<IngestBrowserAudioChunkResult> {
  const started = Date.now()
  const session = await fetchGrowthRealtimeCallSession(admin, input.sessionId)
  if (!session || session.leadId !== input.leadId) throw new Error("not_found")
  if (session.status === "completed" || session.status === "discarded") throw new Error("session_closed")

  const capability = evaluateBrowserAudioCaptureCapability({ session })
  if (!capability.canStart && session.transcriptSource !== "browser_mic") {
    throw new ProviderStreamingUnavailableError(capability.disabledReason ?? undefined)
  }

  const payloadBytes = Buffer.byteLength(input.payloadBase64, "base64")
  if (payloadBytes <= 0 || payloadBytes > MAX_CHUNK_BYTES) {
    recordBrowserAudioChunkFailure(input.sessionId)
    throw new Error("invalid_audio_chunk")
  }

  if (!providerSupportsBrowserAudioStreaming(session.providerId)) {
    recordBrowserAudioChunkFailure(input.sessionId)
    throw new ProviderStreamingUnavailableError()
  }

  if (
    isDuplicateBrowserAudioChunkSequence({
      lastSequenceNumber: getBrowserAudioLastChunkSequence(input.sessionId),
      nextSequenceNumber: input.sequenceNumber,
    })
  ) {
    recordBrowserAudioChunkFailure(input.sessionId)
    throw new Error("duplicate_audio_chunk")
  }

  try {
    const forwarded = await ingestBrowserAudioProviderChunk(admin, session, input)
    const latencyMs = Date.now() - started
    const metrics = recordBrowserAudioChunkSuccess(input.sessionId, {
      latencyMs,
      providerTranscriptLatencyMs: forwarded.providerTranscriptLatencyMs,
    })
    recordBrowserAudioChunkSequence(input.sessionId, input.sequenceNumber)

    return {
      session,
      metrics,
      scaffold: false,
      message: "Audio chunk forwarded to provider stream.",
    }
  } catch (error) {
    recordBrowserAudioChunkFailure(input.sessionId)
    throw error
  }
}

export function getBrowserAudioCaptureDetail(sessionId: string) {
  return getBrowserAudioCaptureMetrics(sessionId)
}

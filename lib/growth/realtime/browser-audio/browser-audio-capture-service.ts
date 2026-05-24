import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthBrowserAudioCaptureMetrics } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import {
  closeBrowserAudioProviderStream,
  clearBrowserAudioStreamState,
} from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import type { GrowthBrowserAudioCaptureStatus } from "@/lib/growth/realtime/realtime-call-types"
import {
  fetchGrowthRealtimeCallSession,
  updateGrowthRealtimeCallSession,
} from "@/lib/growth/realtime/realtime-call-repository"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"

const metricsBySession = new Map<string, GrowthBrowserAudioCaptureMetrics>()

function emptyMetrics(): GrowthBrowserAudioCaptureMetrics {
  return {
    chunkCount: 0,
    failedChunkCount: 0,
    averageChunkSendLatencyMs: 0,
    providerTranscriptLatencyMs: 0,
    lastChunkAt: null,
  }
}

export function getBrowserAudioCaptureMetrics(sessionId: string): GrowthBrowserAudioCaptureMetrics {
  return metricsBySession.get(sessionId) ?? emptyMetrics()
}

export function clearBrowserAudioCaptureMetrics(sessionId: string): void {
  metricsBySession.delete(sessionId)
}

export function recordBrowserAudioChunkSuccess(
  sessionId: string,
  input: { latencyMs: number; providerTranscriptLatencyMs?: number },
): GrowthBrowserAudioCaptureMetrics {
  const current = metricsBySession.get(sessionId) ?? emptyMetrics()
  const nextCount = current.chunkCount + 1
  const prevTotal = current.averageChunkSendLatencyMs * current.chunkCount
  const next: GrowthBrowserAudioCaptureMetrics = {
    chunkCount: nextCount,
    failedChunkCount: current.failedChunkCount,
    averageChunkSendLatencyMs: Math.round((prevTotal + input.latencyMs) / nextCount),
    providerTranscriptLatencyMs: input.providerTranscriptLatencyMs ?? current.providerTranscriptLatencyMs,
    lastChunkAt: new Date().toISOString(),
  }
  metricsBySession.set(sessionId, next)
  return next
}

export function recordBrowserAudioChunkFailure(sessionId: string): GrowthBrowserAudioCaptureMetrics {
  const current = metricsBySession.get(sessionId) ?? emptyMetrics()
  const next = { ...current, failedChunkCount: current.failedChunkCount + 1 }
  metricsBySession.set(sessionId, next)
  return next
}

export async function updateBrowserAudioCaptureStatus(
  admin: SupabaseClient,
  input: {
    sessionId: string
    status: GrowthBrowserAudioCaptureStatus
    error?: string | null
    enabled?: boolean
    transcriptSource?: GrowthRealtimeCallSession["transcriptSource"]
  },
): Promise<GrowthRealtimeCallSession> {
  const session = await fetchGrowthRealtimeCallSession(admin, input.sessionId)
  if (!session) throw new Error("not_found")

  const now = new Date().toISOString()
  const patch: Parameters<typeof updateGrowthRealtimeCallSession>[2] = {
    browserAudioCaptureStatus: input.status,
    browserAudioError: input.error ?? null,
  }

  if (input.enabled !== undefined) patch.browserAudioCaptureEnabled = input.enabled
  if (input.transcriptSource !== undefined) patch.transcriptSource = input.transcriptSource

  if (input.status === "active") {
    patch.browserAudioCaptureEnabled = true
    patch.browserAudioStartedAt = session.browserAudioStartedAt ?? now
    patch.browserAudioEndedAt = null
    patch.transcriptSource = "browser_mic"
  }

  if (input.status === "stopped" || input.status === "failed") {
    patch.browserAudioCaptureEnabled = false
    patch.browserAudioEndedAt = now
  }

  if (input.status === "inactive") {
    patch.browserAudioCaptureEnabled = false
    patch.browserAudioEndedAt = session.browserAudioEndedAt ?? now
    clearBrowserAudioCaptureMetrics(input.sessionId)
    clearBrowserAudioChunkSequence(input.sessionId)
  }

  return updateGrowthRealtimeCallSession(admin, input.sessionId, patch)
}

export async function stopBrowserAudioCaptureForSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const session = await fetchGrowthRealtimeCallSession(admin, sessionId)
  if (!session) return
  if (session.browserAudioCaptureStatus === "inactive" || session.browserAudioCaptureStatus === "stopped") {
    clearBrowserAudioCaptureMetrics(sessionId)
    return
  }
  await updateBrowserAudioCaptureStatus(admin, {
    sessionId,
    status: "stopped",
    enabled: false,
  })
  await closeBrowserAudioProviderStream(sessionId, { admin, session })
  clearBrowserAudioStreamState(sessionId)
  clearBrowserAudioCaptureMetrics(sessionId)
  clearBrowserAudioChunkSequence(sessionId)
}

const lastChunkSequenceBySession = new Map<string, number>()

export function getBrowserAudioLastChunkSequence(sessionId: string): number | null {
  return lastChunkSequenceBySession.get(sessionId) ?? null
}

export function clearBrowserAudioChunkSequence(sessionId: string): void {
  lastChunkSequenceBySession.delete(sessionId)
}

export function recordBrowserAudioChunkSequence(sessionId: string, sequenceNumber: number): void {
  lastChunkSequenceBySession.set(sessionId, sequenceNumber)
}

export function resetBrowserAudioCaptureMetricsForTests(): void {
  metricsBySession.clear()
}

export function resetBrowserAudioChunkSequenceForTests(): void {
  lastChunkSequenceBySession.clear()
}

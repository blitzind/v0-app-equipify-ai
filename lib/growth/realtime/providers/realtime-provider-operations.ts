import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getBrowserAudioStreamState,
  getBrowserAudioStreamStatusChangedAt,
} from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import { REALTIME_PROVIDER_STUCK_STREAM_MS } from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"
import { appendRealtimeProviderLifecycleEvent } from "@/lib/growth/realtime/providers/realtime-provider-lifecycle-events"
import {
  detachRealtimeProviderFromSession,
  getActiveProviderSessionIds,
} from "@/lib/growth/realtime/providers/provider-session-manager"
import { fetchGrowthRealtimeCallSessionsByIds } from "@/lib/growth/realtime/realtime-call-repository"

export type RealtimeProviderCleanupResult = {
  staleStreamsClosed: number
  orphanSessionsDetached: number
  stuckStreamsDetected: number
}

function streamIdleMs(sessionId: string, stream: ReturnType<typeof getBrowserAudioStreamState>): number | null {
  const lastChunkAt = stream.metrics.lastActivityAt
  if (lastChunkAt) {
    return Date.now() - new Date(lastChunkAt).getTime()
  }

  const statusChangedAt = getBrowserAudioStreamStatusChangedAt(sessionId)
  if (statusChangedAt) {
    return Date.now() - new Date(statusChangedAt).getTime()
  }

  return null
}

export async function runRealtimeProviderOperationalCleanup(
  admin: SupabaseClient,
): Promise<RealtimeProviderCleanupResult> {
  let staleStreamsClosed = 0
  let orphanSessionsDetached = 0
  let stuckStreamsDetected = 0

  const activeSessionIds = getActiveProviderSessionIds()
  if (activeSessionIds.length === 0) {
    return { staleStreamsClosed, orphanSessionsDetached, stuckStreamsDetected }
  }

  const sessions = await fetchGrowthRealtimeCallSessionsByIds(admin, activeSessionIds)
  const sessionById = new Map(sessions.map((session) => [session.id, session]))

  for (const sessionId of activeSessionIds) {
    const session = sessionById.get(sessionId)
    if (!session || session.status === "completed" || session.status === "discarded") {
      await detachRealtimeProviderFromSession(sessionId)
      orphanSessionsDetached += 1
      await appendRealtimeProviderLifecycleEvent(admin, {
        sessionId,
        connectionId: session?.realtimeProviderConnectionId ?? null,
        eventType: "orphan_cleanup",
        message: "Detached orphan provider session after call ended.",
        metadata: { sessionStatus: session?.status ?? "missing" },
      })
      continue
    }

    const stream = getBrowserAudioStreamState(sessionId)
    if (stream.status === "connecting" || stream.status === "listening") {
      const idleMs = streamIdleMs(sessionId, stream)
      if (idleMs != null && idleMs > REALTIME_PROVIDER_STUCK_STREAM_MS) {
        stuckStreamsDetected += 1
        await detachRealtimeProviderFromSession(sessionId)
        staleStreamsClosed += 1
        await appendRealtimeProviderLifecycleEvent(admin, {
          sessionId,
          connectionId: session.realtimeProviderConnectionId,
          eventType: "stale_cleanup",
          message: "Closed stuck provider stream after inactivity timeout.",
          metadata: { idleMs, streamStatus: stream.status },
        })
      }
    }
  }

  return { staleStreamsClosed, orphanSessionsDetached, stuckStreamsDetected }
}

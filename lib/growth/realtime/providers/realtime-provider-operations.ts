import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getBrowserAudioStreamState } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import { REALTIME_PROVIDER_STUCK_STREAM_MS } from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"
import { appendRealtimeProviderLifecycleEvent } from "@/lib/growth/realtime/providers/realtime-provider-lifecycle-events"
import {
  detachRealtimeProviderFromSession,
  getActiveProviderSessionIds,
} from "@/lib/growth/realtime/providers/provider-session-manager"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"

export type RealtimeProviderCleanupResult = {
  staleStreamsClosed: number
  orphanSessionsDetached: number
  stuckStreamsDetected: number
}

export async function runRealtimeProviderOperationalCleanup(
  admin: SupabaseClient,
): Promise<RealtimeProviderCleanupResult> {
  let staleStreamsClosed = 0
  let orphanSessionsDetached = 0
  let stuckStreamsDetected = 0

  const activeSessionIds = getActiveProviderSessionIds()
  for (const sessionId of activeSessionIds) {
    const session = await fetchGrowthRealtimeCallSession(admin, sessionId)
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
      const lastChunkAt = stream.metrics.lastActivityAt
      if (lastChunkAt) {
        const idleMs = Date.now() - new Date(lastChunkAt).getTime()
        if (idleMs > REALTIME_PROVIDER_STUCK_STREAM_MS) {
          stuckStreamsDetected += 1
          await detachRealtimeProviderFromSession(sessionId)
          staleStreamsClosed += 1
          await appendRealtimeProviderLifecycleEvent(admin, {
            sessionId,
            connectionId: session.realtimeProviderConnectionId,
            eventType: "stale_cleanup",
            message: "Closed stuck provider stream after inactivity timeout.",
            metadata: { idleMs },
          })
        }
      }
    }
  }

  return { staleStreamsClosed, orphanSessionsDetached, stuckStreamsDetected }
}

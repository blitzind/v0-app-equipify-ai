import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  incrementRealtimeProviderMetric,
  updateRealtimeProviderConnection,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import {
  buildProviderRuntimeConfigForConnection,
  resolveRealtimeProviderRoute,
} from "@/lib/growth/realtime/providers/provider-router"
import {
  clearRealtimeProviderStreamState,
  ingestRealtimeProviderTranscriptChunk,
} from "@/lib/growth/realtime/providers/provider-stream-bridge"
import type {
  RealtimeTranscriptProvider,
} from "@/lib/growth/realtime/providers/provider-types"
import { closeBrowserAudioProviderStream } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"
import { updateGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"

export { isBrowserAudioStreamProvider } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-provider"

type ActiveProviderSession = {
  sessionId: string
  connectionId: string | null
  provider: RealtimeTranscriptProvider
  unsubscribe: () => void
}

const activeSessions = new Map<string, ActiveProviderSession>()

export function getActiveProviderForSession(sessionId: string): RealtimeTranscriptProvider | null {
  return activeSessions.get(sessionId)?.provider ?? null
}

export async function attachRealtimeProviderToSession(
  admin: SupabaseClient,
  session: GrowthRealtimeCallSession,
  actor?: { userId: string | null; email: string | null },
): Promise<GrowthRealtimeCallSession> {
  await detachRealtimeProviderFromSession(session.id)

  const route = await resolveRealtimeProviderRoute(admin)
  const runtime =
    route.connectionId != null
      ? await buildProviderRuntimeConfigForConnection(admin, route.connectionId)
      : null

  if (runtime) {
    await route.provider.connect(session.id, runtime.runtimeConfig)
  } else {
    await route.provider.connect(session.id, {
      connectionId: route.connectionId ?? "none",
      providerId: route.providerId,
      configJson: {},
      credentials: null,
      speakerSeparationEnabled: false,
      keywordEventsEnabled: false,
      confidenceThreshold: 70,
      customKeywords: [],
      industryProfile: {},
    })
  }

  const unsubscribe = await route.provider.stream((chunk) => {
    void ingestRealtimeProviderTranscriptChunk(admin, {
      session,
      chunk,
      actor,
    }).catch(async () => {
      if (route.connectionId) {
        await incrementRealtimeProviderMetric(admin, route.connectionId, "disconnect")
      }
      await updateGrowthRealtimeCallSession(admin, session.id, {
        transcriptStatus: "failed",
        transcriptSource: "manual",
      })
    })
  })

  activeSessions.set(session.id, {
    sessionId: session.id,
    connectionId: route.connectionId,
    provider: route.provider,
    unsubscribe,
  })

  if (route.connectionId && !route.failoverApplied) {
    await updateRealtimeProviderConnection(admin, route.connectionId, { status: "connected" })
  }

  return updateGrowthRealtimeCallSession(admin, session.id, {
    realtimeProviderConnectionId: route.connectionId,
    providerId: route.providerId,
    transcriptSource: route.transcriptSource,
    transcriptStatus: route.transcriptSource === "provider" ? "live" : "live",
    sessionProviderFailoverCount: route.failoverApplied
      ? session.sessionProviderFailoverCount + 1
      : session.sessionProviderFailoverCount,
  })
}

export async function detachRealtimeProviderFromSession(sessionId: string): Promise<void> {
  const active = activeSessions.get(sessionId)
  if (!active) return
  await closeBrowserAudioProviderStream(sessionId)
  await active.provider.disconnect()
  active.unsubscribe()
  activeSessions.delete(sessionId)
  clearRealtimeProviderStreamState(sessionId)
}

export function hasActiveRealtimeProviderSession(sessionId: string): boolean {
  return activeSessions.has(sessionId)
}

export function resetActiveProviderSessionsForTests(): void {
  activeSessions.clear()
}

import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getBrowserAudioCaptureMetrics,
  updateBrowserAudioCaptureStatus,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-service"
import { evaluateBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import { BROWSER_AUDIO_TROUBLESHOOTING } from "@/lib/growth/realtime/browser-audio/browser-audio-troubleshooting"
import {
  closeBrowserAudioProviderStream,
  getBrowserAudioStreamState,
  openBrowserAudioProviderStream,
  retryBrowserAudioProviderStream,
} from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import { buildLiveCoachingQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { countLiveCoachingReadyProviders } from "@/lib/growth/realtime/live-coaching/live-coaching-provider-selection"
import { fetchRealtimeProviderConnection } from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import { isRealtimeProviderCircuitOpen } from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import { listRealtimeProviderConnections } from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import { mapBrowserAudioChunkError } from "@/lib/growth/realtime/browser-audio/ingest-browser-audio-chunk"
import { GROWTH_MEETING_CAPTURE_SOURCE_MODES, GROWTH_MEETING_PROVIDERS } from "@/lib/growth/realtime/browser-audio/meeting-capture-types"
import {
  emitLiveCoachingMeetingCaptureFailedTimeline,
  emitLiveCoachingMeetingCaptureStartedTimeline,
  emitLiveCoachingMeetingCaptureStoppedTimeline,
  emitLiveCoachingMeetingAudioPermissionTimeline,
  emitLiveCoachingMeetingProviderDetectedTimeline,
  emitLiveCoachingMixedAudioEnabledTimeline,
  emitLiveCoachingMicPermissionTimeline,
  emitLiveCoachingSessionStoppedTimeline,
} from "@/lib/growth/realtime/live-coaching/session-timeline-emitter"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  action: z.enum(["request", "start", "pause", "stop", "fail", "retry"]),
  error: z.string().trim().max(500).optional().nullable(),
  captureSourceMode: z.enum(GROWTH_MEETING_CAPTURE_SOURCE_MODES).optional(),
  meetingProvider: z.enum(GROWTH_MEETING_PROVIDERS).optional().nullable(),
  mixedAudioEnabled: z.boolean().optional(),
  meetingAudioActive: z.boolean().optional(),
  microphoneActive: z.boolean().optional(),
})

async function resolveProviderConnectionForSession(
  admin: SupabaseClient,
  session: NonNullable<Awaited<ReturnType<typeof fetchGrowthRealtimeCallSession>>>,
) {
  if (!session.realtimeProviderConnectionId) return null
  return fetchRealtimeProviderConnection(admin, session.realtimeProviderConnectionId)
}

function evaluateCaptureCapabilityForSession(
  session: NonNullable<Awaited<ReturnType<typeof fetchGrowthRealtimeCallSession>>>,
  providerConnection: Awaited<ReturnType<typeof resolveProviderConnectionForSession>>,
) {
  return evaluateBrowserAudioCaptureCapability({
    session,
    providerConnection,
    providerHealthy: session.transcriptStatus === "live",
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid browser audio action." }, { status: 400 })
  }

  try {
    const existing = await fetchGrowthRealtimeCallSession(access.admin, sessionId)
    if (!existing || existing.leadId !== leadId) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }

    if (parsed.data.action === "start" || parsed.data.action === "retry") {
      if (parsed.data.action === "start" && existing.browserAudioCaptureStatus === "active") {
        return NextResponse.json(
          {
            error: "duplicate_capture_start",
            message: BROWSER_AUDIO_TROUBLESHOOTING.doubleStartBlocked,
          },
          { status: 409 },
        )
      }

      const providerConnection = await resolveProviderConnectionForSession(access.admin, existing)
      if (providerConnection && isRealtimeProviderCircuitOpen(providerConnection)) {
        return NextResponse.json(
          {
            error: "provider_circuit_open",
            message: BROWSER_AUDIO_TROUBLESHOOTING.providerCircuitOpen,
          },
          { status: 409 },
        )
      }

      const capability = evaluateCaptureCapabilityForSession(existing, providerConnection)
      if (!capability.canStart) {
        return NextResponse.json(
          {
            error: "provider_streaming_unavailable",
            message: capability.disabledReason ?? "Mic capture unavailable.",
          },
          { status: 409 },
        )
      }
    }

    if (parsed.data.action === "retry") {
      const stream = await retryBrowserAudioProviderStream(access.admin, existing, {
        userId: access.userId,
        email: access.email,
      })
      const session = await updateBrowserAudioCaptureStatus(access.admin, {
        sessionId,
        status: "active",
        enabled: true,
      })
      return NextResponse.json({
        ok: true,
        session,
        metrics: getBrowserAudioCaptureMetrics(sessionId),
        stream,
        capability: evaluateCaptureCapabilityForSession(
          session,
          await resolveProviderConnectionForSession(access.admin, session),
        ),
      })
    }

    const statusMap = {
      request: "requesting",
      start: "active",
      pause: "paused",
      stop: "stopped",
      fail: "failed",
    } as const

    const action = parsed.data.action
    const captureSourceMode = parsed.data.captureSourceMode ?? existing.meetingCaptureMode ?? "microphone"
    const meetingProvider = parsed.data.meetingProvider ?? existing.meetingProvider ?? null
    const mixedAudioEnabled = parsed.data.mixedAudioEnabled ?? existing.mixedAudioEnabled ?? false
    const meetingAudioActive = parsed.data.meetingAudioActive ?? false
    const microphoneActive = parsed.data.microphoneActive ?? captureSourceMode === "microphone"

    const session = await updateBrowserAudioCaptureStatus(access.admin, {
      sessionId,
      status: statusMap[action],
      error: parsed.data.error,
      enabled: parsed.data.action === "start" || parsed.data.action === "pause",
      meetingCaptureMode: captureSourceMode,
      meetingProvider,
      mixedAudioEnabled,
      meetingAudioActive: parsed.data.action === "start" ? meetingAudioActive : false,
      microphoneActive: parsed.data.action === "start" ? microphoneActive : false,
    })

    let stream = getBrowserAudioStreamState(sessionId)
    if (parsed.data.action === "start") {
      stream = await openBrowserAudioProviderStream(access.admin, session, {
        userId: access.userId,
        email: access.email,
      })
    }
    if (parsed.data.action === "pause" || parsed.data.action === "stop" || parsed.data.action === "fail") {
      stream = await closeBrowserAudioProviderStream(sessionId, { admin: access.admin, session })
    }

    if (parsed.data.action === "start") {
      if (captureSourceMode === "microphone") {
        await emitLiveCoachingMicPermissionTimeline(access.admin, session, { granted: true })
      } else {
        await emitLiveCoachingMeetingCaptureStartedTimeline(access.admin, session, {
          captureSourceMode,
          meetingProvider,
          mixedAudioEnabled,
        })
        if (meetingProvider) {
          await emitLiveCoachingMeetingProviderDetectedTimeline(access.admin, session, {
            meetingProvider,
          })
        }
        if (mixedAudioEnabled) {
          await emitLiveCoachingMixedAudioEnabledTimeline(access.admin, session)
        }
      }
    }
    if (parsed.data.action === "fail") {
      if (captureSourceMode === "microphone") {
        await emitLiveCoachingMicPermissionTimeline(access.admin, session, {
          granted: false,
          errorCode: parsed.data.error ?? "mic_permission_denied",
        })
      } else if ((parsed.data.error ?? "").toLowerCase().includes("permission")) {
        await emitLiveCoachingMeetingAudioPermissionTimeline(access.admin, session, {
          errorCode: parsed.data.error ?? "meeting_audio_permission_denied",
        })
      } else {
        await emitLiveCoachingMeetingCaptureFailedTimeline(access.admin, session, {
          errorCode: parsed.data.error ?? "meeting_capture_failed",
        })
      }
    }
    if (parsed.data.action === "stop") {
      await emitLiveCoachingSessionStoppedTimeline(access.admin, session)
      if (captureSourceMode !== "microphone") {
        await emitLiveCoachingMeetingCaptureStoppedTimeline(access.admin, session)
      }
    }

    const providerConnection = await resolveProviderConnectionForSession(access.admin, session)
    return NextResponse.json({
      ok: true,
      session,
      metrics: getBrowserAudioCaptureMetrics(sessionId),
      stream,
      capability: evaluateCaptureCapabilityForSession(session, providerConnection),
    })
  } catch (e) {
    const mapped = mapBrowserAudioChunkError(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const session = await fetchGrowthRealtimeCallSession(access.admin, sessionId)
  if (!session || session.leadId !== leadId) {
    return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
  }

  const providerConnection = await resolveProviderConnectionForSession(access.admin, session)
  const connections = await listRealtimeProviderConnections(access.admin)
  const qaProof = buildLiveCoachingQaProofMarker({
    providerCount: connections.length,
    readyProviderCount: countLiveCoachingReadyProviders(connections),
  })

  return NextResponse.json({
    ok: true,
    session,
    metrics: getBrowserAudioCaptureMetrics(sessionId),
    stream: getBrowserAudioStreamState(sessionId),
    capability: evaluateCaptureCapabilityForSession(session, providerConnection),
    qaProof,
  })
}

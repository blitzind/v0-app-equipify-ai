import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getBrowserAudioCaptureMetrics,
  updateBrowserAudioCaptureStatus,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-service"
import { evaluateBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import {
  closeBrowserAudioProviderStream,
  getBrowserAudioStreamState,
  openBrowserAudioProviderStream,
  retryBrowserAudioProviderStream,
} from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import { mapBrowserAudioChunkError } from "@/lib/growth/realtime/browser-audio/ingest-browser-audio-chunk"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  action: z.enum(["request", "start", "pause", "stop", "fail", "retry"]),
  error: z.string().trim().max(500).optional().nullable(),
})

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
      const capability = evaluateBrowserAudioCaptureCapability({ session: existing })
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
        capability: evaluateBrowserAudioCaptureCapability({ session }),
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
    const session = await updateBrowserAudioCaptureStatus(access.admin, {
      sessionId,
      status: statusMap[action],
      error: parsed.data.error,
      enabled: parsed.data.action === "start" || parsed.data.action === "pause",
    })

    let stream = getBrowserAudioStreamState(sessionId)
    if (parsed.data.action === "start") {
      stream = await openBrowserAudioProviderStream(access.admin, session, {
        userId: access.userId,
        email: access.email,
      })
    }
    if (parsed.data.action === "pause" || parsed.data.action === "stop" || parsed.data.action === "fail") {
      stream = await closeBrowserAudioProviderStream(sessionId)
    }

    return NextResponse.json({
      ok: true,
      session,
      metrics: getBrowserAudioCaptureMetrics(sessionId),
      stream,
      capability: evaluateBrowserAudioCaptureCapability({ session }),
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

  return NextResponse.json({
    ok: true,
    session,
    metrics: getBrowserAudioCaptureMetrics(sessionId),
    stream: getBrowserAudioStreamState(sessionId),
    capability: evaluateBrowserAudioCaptureCapability({ session }),
  })
}

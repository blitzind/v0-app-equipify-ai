import { NextResponse } from "next/server"
import {
  fetchCallWorkspaceLiveCoaching,
  startCallWorkspaceLiveCoaching,
} from "@/lib/growth/native-dialer/call-workspace-coaching-service"
import { GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { requireVoiceOperatorRouteContext } from "@/lib/voice/api/voice-operator-route"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid session id." }, { status: 400 })
  }

  const access = await requireVoiceOperatorRouteContext({
    sessionId,
    requireSessionOwner: true,
  })
  if (!access.ok) return access.response

  try {
    const coaching = await fetchCallWorkspaceLiveCoaching(access.admin, sessionId)
    return NextResponse.json({ ok: true, qaMarker: GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER, coaching })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load live coaching."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid session id." }, { status: 400 })
  }

  const access = await requireVoiceOperatorRouteContext({
    sessionId,
    requireSessionOwner: true,
  })
  if (!access.ok) return access.response

  try {
    const coaching = await startCallWorkspaceLiveCoaching(access.admin, {
      nativeSessionId: sessionId,
      createdBy: access.userId,
      userEmail: access.userEmail,
    })
    if (coaching.linkResult && !coaching.linkResult.linked) {
      return NextResponse.json({
        ok: false,
        qaMarker: GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
        error: "link_failed",
        reason: coaching.linkResult.reason,
        coaching,
      }, { status: 409 })
    }
    return NextResponse.json({ ok: true, qaMarker: GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER, coaching })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start live coaching."
    return NextResponse.json({ error: "start_failed", message }, { status: 500 })
  }
}

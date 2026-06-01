import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { retryGrowthNativeCallMediaStream } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { sessionId } = await context.params
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: "invalid_session", message: "Session id required." }, { status: 400 })
  }

  try {
    const result = await retryGrowthNativeCallMediaStream(access.admin, sessionId.trim())
    return NextResponse.json({
      ok: result.started,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      started: result.started,
      reason: result.reason,
      wssHost: result.wssHost,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not restart media stream."
    return NextResponse.json({ ok: false, error: "media_stream_restart_failed", message }, { status: 500 })
  }
}

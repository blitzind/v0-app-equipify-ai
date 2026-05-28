import { NextResponse } from "next/server"
import { fetchVoiceBrowserCallingReadiness } from "@/lib/voice/browser-calling/readiness"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { listVoiceOperatorPresence } from "@/lib/voice/repository/voice-browser-calling-repository"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const readiness = await fetchVoiceBrowserCallingReadiness(ctx.admin, ctx.organizationId)
  const operators = await listVoiceOperatorPresence(ctx.admin, ctx.organizationId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    readiness,
    operators,
  })
}

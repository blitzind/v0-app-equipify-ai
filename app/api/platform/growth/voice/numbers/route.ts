import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchVoiceNumbersList } from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const numbers = await fetchVoiceNumbersList(ctx.admin, ctx.organizationId)

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_OPERATIONS_QA_MARKER,
    numbers,
    provisioningMessage:
      "Number provisioning will be connected after provider credentials are fully validated.",
  })
}

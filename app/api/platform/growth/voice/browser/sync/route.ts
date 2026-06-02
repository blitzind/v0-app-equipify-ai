import { NextResponse } from "next/server"
import { buildVoiceBrowserSyncSnapshot } from "@/lib/voice/browser-calling/workspace-bridge"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { listVoiceOperatorPresence } from "@/lib/voice/repository/voice-browser-calling-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const url = new URL(request.url)
  const clientIdentity = url.searchParams.get("clientIdentity")
  const workspaceSessionId = url.searchParams.get("workspaceSessionId")
  const includePresence = url.searchParams.get("includePresence") === "1"
  const mode = url.searchParams.get("mode") === "enrichment" ? "enrichment" : "fast"

  const snapshot = await buildVoiceBrowserSyncSnapshot(ctx.admin, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
    workspaceSessionId,
    mode,
  })

  const operators = includePresence
    ? await listVoiceOperatorPresence(ctx.admin, ctx.organizationId)
    : undefined

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    snapshot,
    diagnostics: snapshot.diagnostics,
    operators,
  })
}

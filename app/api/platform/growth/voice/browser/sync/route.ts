import { NextResponse } from "next/server"
import { buildVoiceBrowserSyncSnapshot } from "@/lib/voice/browser-calling/workspace-bridge"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { normalizeNativeSessionId } from "@/lib/voice/api/native-session-id-validation"
import { requireVoiceOperatorRouteContext } from "@/lib/voice/api/voice-operator-route"
import { listVoiceOperatorPresence } from "@/lib/voice/repository/voice-browser-calling-repository"
import { probeVoiceSchemaHealthCached } from "@/lib/voice/schema-health"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientIdentity = url.searchParams.get("clientIdentity")
  const rawWorkspaceSessionId = url.searchParams.get("workspaceSessionId")?.trim() || null
  const workspaceSessionId = normalizeNativeSessionId(rawWorkspaceSessionId)
  const includePresence = url.searchParams.get("includePresence") === "1"
  const mode = url.searchParams.get("mode") === "enrichment" ? "enrichment" : "fast"

  const ctx = await requireVoiceOperatorRouteContext({
    sessionId: workspaceSessionId,
    requireSessionOwner: Boolean(workspaceSessionId),
  })
  if (!ctx.ok) return ctx.response

  const schemaProbe = await probeVoiceSchemaHealthCached(ctx.admin)
  if (schemaProbe.missingTables.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "voice_schema_incomplete",
        message: schemaProbe.message,
        qaMarker: VOICE_OPERATIONS_QA_MARKER,
        probeUncertain: schemaProbe.probeUncertain,
      },
      { status: 503 },
    )
  }

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

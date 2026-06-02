import { NextResponse } from "next/server"
import { buildVoiceBrowserSyncSnapshot } from "@/lib/voice/browser-calling/workspace-bridge"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { normalizeNativeSessionId } from "@/lib/voice/api/native-session-id-validation"
import { requireVoiceOperatorRouteContext } from "@/lib/voice/api/voice-operator-route"
import { listVoiceOperatorPresence } from "@/lib/voice/repository/voice-browser-calling-repository"
import { probeVoiceSchemaHealthCached } from "@/lib/voice/schema-health"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

const BROWSER_SYNC_ROUTE = "GET /api/platform/growth/voice/browser/sync"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientIdentity = url.searchParams.get("clientIdentity")
  const rawWorkspaceSessionId = url.searchParams.get("workspaceSessionId")?.trim() || null
  const workspaceSessionId = normalizeNativeSessionId(rawWorkspaceSessionId)
  const includePresence = url.searchParams.get("includePresence") === "1"
  const mode = url.searchParams.get("mode") === "enrichment" ? "enrichment" : "fast"
  const syncStartedAt = Date.now()

  const ctx = await requireVoiceOperatorRouteContext({
    request,
    sessionId: workspaceSessionId,
    requireSessionOwner: Boolean(workspaceSessionId),
    sessionIdDiagnostics: workspaceSessionId
      ? {
          route: BROWSER_SYNC_ROUTE,
          sessionIdSource: "query.workspaceSessionId",
          nativeSessionId: workspaceSessionId,
        }
      : undefined,
  })
  if (!ctx.ok) {
    const deniedBody = (await ctx.response.clone().json().catch(() => ({}))) as {
      error?: string
      authStage?: string
    }
    logVoiceInfrastructure("voice_browser_sync_auth_denied", {
      route: BROWSER_SYNC_ROUTE,
      mode,
      workspaceSessionIdPresent: Boolean(workspaceSessionId),
      error: deniedBody.error ?? null,
      authStage: deniedBody.authStage ?? null,
      durationMs: Date.now() - syncStartedAt,
    })
    return ctx.response
  }

  logVoiceInfrastructure("voice_browser_sync_auth_success", {
    route: BROWSER_SYNC_ROUTE,
    organizationId: ctx.organizationId,
    operatorUserId: ctx.userId,
    workspaceSessionId: workspaceSessionId ?? null,
    mode,
  })

  const schemaProbe = await probeVoiceSchemaHealthCached(ctx.admin)
  if (schemaProbe.missingTables.length > 0) {
    logVoiceInfrastructure("voice_browser_sync_failed", {
      route: BROWSER_SYNC_ROUTE,
      reason: "voice_schema_incomplete",
      mode,
      durationMs: Date.now() - syncStartedAt,
    })
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

  logVoiceInfrastructure("voice_browser_sync_success", {
    route: BROWSER_SYNC_ROUTE,
    organizationId: ctx.organizationId,
    operatorUserId: ctx.userId,
    workspaceSessionId: workspaceSessionId ?? snapshot.workspaceSessionId ?? null,
    mode,
    browserCallState: snapshot.browserCallState,
    durationMs: Date.now() - syncStartedAt,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    snapshot,
    diagnostics: snapshot.diagnostics,
    operators,
  })
}

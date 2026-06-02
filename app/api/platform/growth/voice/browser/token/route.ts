import { NextResponse } from "next/server"
import { buildVoiceBrowserClientIdentity } from "@/lib/voice/browser-calling/status-mapping"
import { resolveVoiceBrowserCallingProvider } from "@/lib/voice/browser-calling/provider-registry"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { requireVoiceOperatorRouteContext } from "@/lib/voice/api/voice-operator-route"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const ctx = await requireVoiceOperatorRouteContext()
  if (!ctx.ok) return ctx.response

  const body = (await request.json().catch(() => ({}))) as { ttlSeconds?: number }
  const clientIdentity = buildVoiceBrowserClientIdentity({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  })
  const provider = resolveVoiceBrowserCallingProvider()
  const validation = provider.validateRegistrationContext({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
  })
  if (!validation.ok) {
    return NextResponse.json({ ok: false, message: validation.message }, { status: 400 })
  }

  const tokenResult = await provider.createAccessToken({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
  })

  logVoiceInfrastructure("voice_browser_token_issued", {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    provider: tokenResult.provider,
    stubMode: tokenResult.stubMode,
    clientIdentity,
    ttlSeconds: body.ttlSeconds ?? 3600,
    tokenMessage: tokenResult.message,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    provider: tokenResult.provider,
    token: tokenResult.token,
    clientIdentity,
    expiresAt: tokenResult.expiresAt,
    stubMode: tokenResult.stubMode,
    message: tokenResult.message,
  })
}

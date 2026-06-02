import { NextResponse } from "next/server"
import { buildVoiceBrowserClientIdentity } from "@/lib/voice/browser-calling/status-mapping"
import { resolveVoiceBrowserCallingProvider } from "@/lib/voice/browser-calling/provider-registry"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { requireVoiceBrowserLightweightOperatorContext } from "@/lib/voice/api/voice-operator-route"
import { logVoiceInfrastructure, type VoiceTelemetryEvent } from "@/lib/voice/telemetry"

export const runtime = "nodejs"

const BROWSER_TOKEN_ROUTE = "POST /api/platform/growth/voice/browser/token"

function createBrowserTokenStepLogger() {
  const requestStartedAt = Date.now()
  let stepStartedAt = requestStartedAt

  return {
    logStep(event: VoiceTelemetryEvent, extra?: Record<string, unknown>) {
      const now = Date.now()
      logVoiceInfrastructure(event, {
        route: "browser_token",
        stepTs: new Date(now).toISOString(),
        durationMs: now - stepStartedAt,
        totalDurationMs: now - requestStartedAt,
        ...extra,
      })
      stepStartedAt = now
    },
    logResponse(extra: Record<string, unknown>) {
      const now = Date.now()
      logVoiceInfrastructure("browser_token_response", {
        route: "browser_token",
        stepTs: new Date(now).toISOString(),
        durationMs: now - stepStartedAt,
        totalDurationMs: now - requestStartedAt,
        ...extra,
      })
    },
    totalDurationMs(): number {
      return Date.now() - requestStartedAt
    },
  }
}

export async function POST(request: Request) {
  const steps = createBrowserTokenStepLogger()
  steps.logStep("browser_token_request_start")

  const ctx = await requireVoiceBrowserLightweightOperatorContext({
    request,
    route: BROWSER_TOKEN_ROUTE,
    diagnostics: {
      onAuthComplete: (durationMs) =>
        steps.logStep("browser_token_auth_complete", { authDurationMs: durationMs }),
      onMembershipComplete: (durationMs) =>
        steps.logStep("browser_token_membership_complete", { membershipDurationMs: durationMs }),
    },
  })
  if (!ctx.ok) {
    const deniedBody = (await ctx.response.clone().json().catch(() => ({}))) as {
      error?: string
      authStage?: string
    }
    logVoiceInfrastructure("voice_browser_token_auth_denied", {
      route: BROWSER_TOKEN_ROUTE,
      error: deniedBody.error ?? null,
      authStage: deniedBody.authStage ?? null,
      durationMs: steps.totalDurationMs(),
    })
    steps.logResponse({
      ok: false,
      status: ctx.response.status,
      stage: "operator_context",
    })
    return ctx.response
  }

  logVoiceInfrastructure("voice_browser_token_auth_success", {
    route: BROWSER_TOKEN_ROUTE,
    organizationId: ctx.organizationId,
    operatorUserId: ctx.userId,
    durationMs: steps.totalDurationMs(),
  })

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
    steps.logResponse({ ok: false, status: 400, message: validation.message })
    return NextResponse.json({ ok: false, message: validation.message }, { status: 400 })
  }

  steps.logStep("browser_token_before_create_access_token", {
    provider: provider.providerId,
    clientIdentity,
  })

  const tokenResult = await provider.createAccessToken({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    clientIdentity,
  })

  steps.logStep("browser_token_after_create_access_token", {
    provider: tokenResult.provider,
    stubMode: tokenResult.stubMode,
    hasToken: Boolean(tokenResult.token),
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

  steps.logResponse({
    ok: true,
    status: 200,
    provider: tokenResult.provider,
    stubMode: tokenResult.stubMode,
    hasToken: Boolean(tokenResult.token),
    clientIdentity,
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

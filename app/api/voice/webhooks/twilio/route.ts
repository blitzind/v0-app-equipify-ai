import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { parseTwilioFormBody, twilioFormBodyToPayload } from "@/lib/voice/webhooks/normalizer"
import { ingestVoiceProviderWebhook } from "@/lib/voice/webhooks/ingestion"
import { VOICE_WEBHOOK_INGESTION_QA_MARKER } from "@/lib/voice/webhooks/types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled", message: "Growth Engine is not enabled." }, { status: 403 })
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured for voice webhooks." }, { status: 503 })
  }

  const schemaProbe = await probeVoiceSchemaHealth(admin)
  if (!isVoiceWebhookSchemaReady(schemaProbe)) {
    return NextResponse.json(
      {
        error: "voice_schema_incomplete",
        message: schemaProbe.message,
        migrationId: schemaProbe.migrationId,
      },
      { status: 503 },
    )
  }

  const rawBody = await request.text()
  if (!rawBody.trim()) {
    return NextResponse.json({ error: "invalid_body", message: "Expected Twilio form body." }, { status: 400 })
  }

  const formParams = parseTwilioFormBody(rawBody)
  const payload = twilioFormBodyToPayload(formParams)
  const signatureHeader = request.headers.get("x-twilio-signature")
  const requestUrl = request.url

  logVoiceInfrastructure("voice_webhook_received", {
    provider: "twilio",
    qaMarker: VOICE_WEBHOOK_INGESTION_QA_MARKER,
    hasSignature: Boolean(signatureHeader),
  })

  const skipSignatureValidation = process.env.VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION?.trim() === "true"

  const result = await ingestVoiceProviderWebhook(admin, {
    provider: "twilio",
    rawBody,
    payload,
    signatureHeader,
    requestUrl,
    formParams,
    skipSignatureValidation,
  })

  if (!result.ok) {
    logGrowthEngine("voice_webhook_rejected", {
      provider: "twilio",
      code: result.code,
      message: result.message,
    })
    const status =
      result.code === "signature_failed"
        ? 401
        : result.code === "invalid_payload" || result.code === "organization_unresolved"
          ? 400
          : 500
    return NextResponse.json({ error: result.code, message: result.message }, { status })
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    voiceCallId: result.voiceCallId,
    eventType: result.normalizedEvent.canonicalEventType,
    qaMarker: VOICE_WEBHOOK_INGESTION_QA_MARKER,
  })
}

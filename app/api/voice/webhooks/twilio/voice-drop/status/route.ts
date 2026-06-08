import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { UUID_RE } from "@/lib/voice/api/voice-platform-route"
import {
  ingestVoiceDropTwilioStatusWebhook,
  parseTwilioVoiceDropWebhookPayload,
  validateTwilioVoiceDropWebhook,
} from "@/lib/voice/voice-drops/twilio-voice-drop-webhooks"
import { VOICE_DROP_TWILIO_VD_1A_QA_MARKER } from "@/lib/voice/voice-drops/twilio-voice-drop-config"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { parseTwilioFormBody } from "@/lib/voice/webhooks/normalizer"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 })
  }

  const url = new URL(request.url)
  const organizationId = url.searchParams.get("organizationId") ?? ""
  const recipientId = url.searchParams.get("recipientId") ?? ""

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(recipientId)) {
    return NextResponse.json(
      { error: "invalid_params", message: "organizationId and recipientId must be valid UUIDs." },
      { status: 400 },
    )
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config" }, { status: 503 })
  }

  const schemaProbe = await probeVoiceSchemaHealth(admin)
  if (!isVoiceWebhookSchemaReady(schemaProbe)) {
    return NextResponse.json({ error: "voice_schema_incomplete", message: schemaProbe.message }, { status: 503 })
  }

  const rawBody = await request.text()
  if (!rawBody.trim()) {
    return NextResponse.json({ error: "invalid_body", message: "Expected Twilio form body." }, { status: 400 })
  }

  const formParams = parseTwilioFormBody(rawBody)
  const payload = parseTwilioVoiceDropWebhookPayload(rawBody)

  const validation = await validateTwilioVoiceDropWebhook({
    rawBody,
    requestUrl: request.url,
    signatureHeader: request.headers.get("x-twilio-signature"),
    formParams,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: "signature_failed", message: validation.message }, { status: 401 })
  }

  logVoiceInfrastructure("voice_drop_status_webhook_received", {
    qaMarker: VOICE_DROP_TWILIO_VD_1A_QA_MARKER,
    recipientId,
    callSid: typeof payload.CallSid === "string" ? payload.CallSid : null,
    callStatus: typeof payload.CallStatus === "string" ? payload.CallStatus : null,
  })

  const result = await ingestVoiceDropTwilioStatusWebhook(admin, {
    organizationId,
    recipientId,
    payload,
  })

  if (!result.ok) {
    const status = result.message.includes("not found") ? 404 : 400
    return NextResponse.json({ error: "ingest_failed", message: result.message }, { status })
  }

  return NextResponse.json({ ok: true, updated: result.updated })
}

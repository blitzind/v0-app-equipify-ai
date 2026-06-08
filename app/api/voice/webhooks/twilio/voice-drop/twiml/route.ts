import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { UUID_RE } from "@/lib/voice/api/voice-platform-route"
import {
  parseTwilioVoiceDropWebhookPayload,
  resolveVoiceDropTwimlResponse,
  validateTwilioVoiceDropWebhook,
} from "@/lib/voice/voice-drops/twilio-voice-drop-webhooks"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { parseTwilioFormBody } from "@/lib/voice/webhooks/normalizer"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_DROP_TWILIO_VD_1A_QA_MARKER } from "@/lib/voice/voice-drops/twilio-voice-drop-config"

export const runtime = "nodejs"

function invalidParamResponse(message: string) {
  return NextResponse.json({ error: "invalid_params", message }, { status: 400 })
}

async function handleTwiml(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 })
  }

  const url = new URL(request.url)
  const organizationId = url.searchParams.get("organizationId") ?? ""
  const recipientId = url.searchParams.get("recipientId") ?? ""

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(recipientId)) {
    return invalidParamResponse("organizationId and recipientId must be valid UUIDs.")
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

  const rawBody = request.method === "POST" ? await request.text() : ""
  const formParams = rawBody ? parseTwilioFormBody(rawBody) : {}
  const payload =
    rawBody.length > 0
      ? parseTwilioVoiceDropWebhookPayload(rawBody)
      : Object.fromEntries(url.searchParams.entries())

  const validation = await validateTwilioVoiceDropWebhook({
    rawBody,
    requestUrl: request.url,
    signatureHeader: request.headers.get("x-twilio-signature"),
    formParams,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: "signature_failed", message: validation.message }, { status: 401 })
  }

  const twiml = await resolveVoiceDropTwimlResponse(admin, {
    organizationId,
    recipientId,
    payload,
  })

  if ("error" in twiml) {
    return NextResponse.json({ error: twiml.error }, { status: 404 })
  }

  logVoiceInfrastructure("voice_drop_twiml_response", {
    qaMarker: VOICE_DROP_TWILIO_VD_1A_QA_MARKER,
    recipientId,
  })

  return new NextResponse(twiml.body, {
    status: 200,
    headers: { "Content-Type": twiml.contentType },
  })
}

export async function GET(request: Request) {
  return handleTwiml(request)
}

export async function POST(request: Request) {
  return handleTwiml(request)
}

import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { buildVoiceRecordingCallbackUrl } from "@/lib/voice/call-control/urls"
import { handleTwilioInboundCall } from "@/lib/voice/call-control/inbound-handler"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { parseTwilioFormBody, twilioFormBodyToPayload } from "@/lib/voice/webhooks/normalizer"
import { resolveTwilioWebhookValidationUrl } from "@/lib/voice/webhooks/twilio-request-url"
import { validateTwilioIncomingWebhook } from "@/lib/voice/webhooks/twilio-incoming-webhook"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return new NextResponse("<Response><Reject/></Response>", {
      status: 403,
      headers: { "Content-Type": "application/xml" },
    })
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return new NextResponse("<Response><Say>Server configuration error.</Say></Response>", {
      status: 503,
      headers: { "Content-Type": "application/xml" },
    })
  }

  const schemaProbe = await probeVoiceSchemaHealth(admin)
  if (!isVoiceWebhookSchemaReady(schemaProbe)) {
    return new NextResponse("<Response><Say>Voice schema unavailable.</Say></Response>", {
      status: 503,
      headers: { "Content-Type": "application/xml" },
    })
  }

  const rawBody = await request.text()
  const formParams = parseTwilioFormBody(rawBody)
  const payload = twilioFormBodyToPayload(formParams)
  const signatureHeader = request.headers.get("x-twilio-signature")
  const validationUrl = resolveTwilioWebhookValidationUrl(request)

  const validation = await validateTwilioIncomingWebhook({
    signatureHeader,
    requestUrl: validationUrl,
    rawBody,
    params: formParams,
  })
  if (!validation.ok) {
    logVoiceInfrastructure("voice_webhook_signature_failed", {
      qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
      route: "inbound",
      message: validation.message,
      validation_url: validationUrl,
      request_url: request.url,
    })
    return new NextResponse("<Response><Reject/></Response>", {
      status: 401,
      headers: { "Content-Type": "application/xml" },
    })
  }

  const origin = new URL(validationUrl).origin
  const result = await handleTwilioInboundCall({
    admin,
    payload,
    recordingCallbackUrl: buildVoiceRecordingCallbackUrl(origin),
    statusCallbackUrl: `${origin}/api/voice/webhooks/twilio`,
    mediaStreamOrigin: origin,
  })

  return new NextResponse(result.twiml, {
    status: result.ok ? 200 : 404,
    headers: {
      "Content-Type": "application/xml",
      "X-Voice-QA-Marker": VOICE_CALL_CONTROL_QA_MARKER,
    },
  })
}

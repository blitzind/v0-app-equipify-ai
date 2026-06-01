import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { buildVoiceRecordingCallbackUrl } from "@/lib/voice/call-control/urls"
import { buildTwilioSayAndHangup } from "@/lib/voice/call-control/twilio-twiml"
import { handleTwilioInboundCall } from "@/lib/voice/call-control/inbound-handler"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"
import { probeVoiceSchemaHealth, isVoiceWebhookSchemaReady } from "@/lib/voice/schema-health"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { parseTwilioFormBody, twilioFormBodyToPayload } from "@/lib/voice/webhooks/normalizer"
import { resolveTwilioWebhookValidationUrl } from "@/lib/voice/webhooks/twilio-request-url"
import { validateTwilioIncomingWebhook } from "@/lib/voice/webhooks/twilio-incoming-webhook"

export const runtime = "nodejs"

/** Twilio treats non-2xx webhook responses as application errors — always return 200 with TwiML. */
function twimlResponse(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "X-Voice-QA-Marker": VOICE_CALL_CONTROL_QA_MARKER,
    },
  })
}

function fallbackInboundTwiml(message: string): string {
  return buildTwilioSayAndHangup(message)
}

export async function POST(request: Request) {
  try {
    if (!isGrowthEngineEnabledEnv()) {
      return twimlResponse("<Response><Reject/></Response>")
    }

    let admin
    try {
      admin = createServiceRoleSupabaseClient()
    } catch {
      return twimlResponse(fallbackInboundTwiml("Server configuration error."))
    }

    const schemaProbe = await probeVoiceSchemaHealth(admin)
    if (!isVoiceWebhookSchemaReady(schemaProbe)) {
      logVoiceInfrastructure("voice_inbound_schema_unavailable", {
        qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
        missingTables: schemaProbe.missingTables,
        probeUncertain: schemaProbe.probeUncertain,
      })
      return twimlResponse(fallbackInboundTwiml("Voice calling is temporarily unavailable."))
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
      return twimlResponse("<Response><Reject/></Response>")
    }

    const origin = new URL(validationUrl).origin
    const result = await handleTwilioInboundCall({
      admin,
      payload,
      recordingCallbackUrl: buildVoiceRecordingCallbackUrl(origin),
      statusCallbackUrl: `${origin}/api/voice/webhooks/twilio`,
      mediaStreamOrigin: origin,
    })

    if (!result.ok) {
      logVoiceInfrastructure("voice_inbound_route_unresolved", {
        qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
        code: result.code,
        message: result.message,
      })
    }

    return twimlResponse(result.twiml)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown inbound webhook error"
    logVoiceInfrastructure("voice_inbound_webhook_failed", {
      qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
      message,
    })
    return twimlResponse(
      fallbackInboundTwiml("We are unable to connect your call right now."),
    )
  }
}

import { NextResponse } from "next/server"
import { buildTwilioSayAndHangup } from "@/lib/voice/call-control/twilio-twiml"
import { parseTwilioFormBody } from "@/lib/voice/webhooks/normalizer"
import {
  buildTwilioVoiceIncomingStubTwiml,
  extractTwilioIncomingCallMetadata,
  logTwilioIncomingWebhookReceived,
  TWILIO_VOICE_INCOMING_QA_MARKER,
  validateTwilioIncomingWebhook,
} from "@/lib/voice/webhooks/twilio-incoming-webhook"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const runtime = "nodejs"

function twimlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/xml",
      "X-Twilio-Voice-QA-Marker": TWILIO_VOICE_INCOMING_QA_MARKER,
    },
  })
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    if (!rawBody.trim()) {
      return twimlResponse(buildTwilioSayAndHangup("Invalid request."), 400)
    }

    const formParams = parseTwilioFormBody(rawBody)
    const metadata = extractTwilioIncomingCallMetadata(formParams)
    const signatureHeader = request.headers.get("x-twilio-signature")

    const validation = await validateTwilioIncomingWebhook({
      signatureHeader,
      requestUrl: request.url,
      rawBody,
      params: formParams,
    })

    if (!validation.ok) {
      logVoiceInfrastructure("voice_webhook_signature_failed", {
        qaMarker: TWILIO_VOICE_INCOMING_QA_MARKER,
        route: "twilio/voice/incoming",
        message: validation.message,
        callSid: metadata.callSid,
      })
      return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>', 401)
    }

    logTwilioIncomingWebhookReceived(metadata)

    return twimlResponse(buildTwilioVoiceIncomingStubTwiml())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logVoiceInfrastructure("twilio_voice_incoming_webhook_failed", {
      qaMarker: TWILIO_VOICE_INCOMING_QA_MARKER,
      message,
    })
    return twimlResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to connect your call right now.</Say><Hangup/></Response>',
      500,
    )
  }
}

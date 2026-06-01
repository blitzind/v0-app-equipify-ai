import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createInboundVoiceCallFromTwilio } from "@/lib/voice/browser-calling/workspace-bridge"
import { buildTwilioSayAndHangup } from "@/lib/voice/call-control/twilio-twiml"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import { parseTwilioFormBody } from "@/lib/voice/webhooks/normalizer"
import {
  buildTwilioVoiceIncomingStreamTwiml,
  buildTwilioVoiceIncomingStubTwiml,
  extractTwilioIncomingCallMetadata,
  logTwilioIncomingWebhookReceived,
  resolveTwilioVoiceIncomingMediaStreamWssUrl,
  shouldUseTwilioVoiceIncomingMediaStream,
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
      "X-Voice-Media-Foundation-Marker": VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    },
  })
}

async function provisionAiOperatorVoiceCall(metadata: {
  callSid: string | null
  from: string | null
  to: string | null
}): Promise<void> {
  if (!metadata.callSid) return

  const organizationId = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (!organizationId) {
    logVoiceInfrastructure("voice_transcript_failed", {
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      callSid: metadata.callSid,
      message: "GROWTH_ENGINE_AI_ORG_ID not configured — media stream org resolution will fail.",
    })
    return
  }

  try {
    const admin = createServiceRoleSupabaseClient()
    await createInboundVoiceCallFromTwilio(admin, {
      organizationId,
      providerCallId: metadata.callSid,
      fromNumber: metadata.from ?? "unknown",
      toNumber: metadata.to ?? "unknown",
    })
  } catch (error) {
    logVoiceInfrastructure("voice_transcript_failed", {
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      callSid: metadata.callSid,
      message: error instanceof Error ? error.message : "voice_call_provision_failed",
    })
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    if (!rawBody.trim()) {
      return twimlResponse(buildTwilioSayAndHangup("Invalid request."))
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
        foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        route: "twilio/voice/incoming",
        message: validation.message,
        callSid: metadata.callSid,
      })
      return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>')
    }

    logTwilioIncomingWebhookReceived(metadata)

    if (shouldUseTwilioVoiceIncomingMediaStream()) {
      await provisionAiOperatorVoiceCall(metadata)
      const twiml = buildTwilioVoiceIncomingStreamTwiml({
        mediaStreamWssUrl: resolveTwilioVoiceIncomingMediaStreamWssUrl(request.url),
        callSid: metadata.callSid,
      })
      return twimlResponse(twiml)
    }

    return twimlResponse(buildTwilioVoiceIncomingStubTwiml())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logVoiceInfrastructure("twilio_voice_incoming_webhook_failed", {
      qaMarker: TWILIO_VOICE_INCOMING_QA_MARKER,
      foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      message,
    })
    return twimlResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to connect your call right now.</Say><Hangup/></Response>',
    )
  }
}

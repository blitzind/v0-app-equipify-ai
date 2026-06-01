import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildVoiceMediaStreamTwilioWssUrl } from "@/lib/voice/call-control/urls"
import { findActiveMediaSessionForCall } from "@/lib/voice/repository/voice-media-streaming-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

function readTwilioCredentials(): { accountSid: string; authToken: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) return null
  return { accountSid, authToken }
}

/**
 * Inbound browser calls can ring for a long time while the initial `<Start><Stream>` leg
 * has already stopped. Restart Twilio Media Streams when the operator answers so transcript
 * segments reach the Growth coaching bridge.
 */
export async function ensureAnsweredInboundCallMediaStream(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    providerCallId: string
    mediaStreamOrigin?: string | null
  },
): Promise<{ started: boolean; reason: string }> {
  const activeMedia = await findActiveMediaSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (activeMedia) {
    return { started: false, reason: "active_media_session_exists" }
  }

  const credentials = readTwilioCredentials()
  if (!credentials) {
    return { started: false, reason: "twilio_credentials_missing" }
  }

  const wssUrl = buildVoiceMediaStreamTwilioWssUrl(input.mediaStreamOrigin ?? null)
  if (!wssUrl.trim()) {
    return { started: false, reason: "media_stream_url_missing" }
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Calls/${encodeURIComponent(input.providerCallId)}/Streams.json`
  const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Url: wssUrl,
        Track: "both_tracks",
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
        voiceCallId: input.voiceCallId,
        providerCallId: input.providerCallId,
        status: response.status,
        message: body.slice(0, 240),
      })
      return { started: false, reason: "twilio_stream_create_failed" }
    }

    logVoiceInfrastructure("voice_answered_inbound_media_stream_started", {
      voiceCallId: input.voiceCallId,
      providerCallId: input.providerCallId,
      wssUrl,
    })
    return { started: true, reason: "stream_created" }
  } catch (error) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      voiceCallId: input.voiceCallId,
      providerCallId: input.providerCallId,
      message: error instanceof Error ? error.message : String(error),
    })
    return { started: false, reason: "twilio_stream_create_failed" }
  }
}

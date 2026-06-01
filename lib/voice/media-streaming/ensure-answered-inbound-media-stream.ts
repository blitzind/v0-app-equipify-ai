import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildVoiceMediaStreamTwilioWssUrl } from "@/lib/voice/call-control/urls"
import {
  findActiveMediaSessionForCall,
  updateMediaSessionStatus,
} from "@/lib/voice/repository/voice-media-streaming-repository"
import { isStaleRingPhaseMediaSession } from "@/lib/voice/media-streaming/inbound-media-stream-restart-logic"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

function readTwilioCredentials(): { accountSid: string; authToken: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) return null
  return { accountSid, authToken }
}

async function stopTwilioCallStream(input: {
  accountSid: string
  authToken: string
  providerCallId: string
  providerStreamSid: string
}): Promise<void> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Calls/${encodeURIComponent(input.providerCallId)}/Streams/${encodeURIComponent(input.providerStreamSid)}.json`
  const auth = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64")
  await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ Status: "stopped" }),
  }).catch(() => undefined)
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
  const baseLog = {
    voiceCallId: input.voiceCallId,
    providerCallId: input.providerCallId,
  }

  const { data: voiceCallRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("answered_at")
    .eq("id", input.voiceCallId)
    .maybeSingle()
  const answeredAtMs = Date.parse((voiceCallRow?.answered_at as string) ?? "")
  if (!Number.isFinite(answeredAtMs)) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_skipped", {
      ...baseLog,
      reason: "call_not_answered",
    })
    return { started: false, reason: "call_not_answered" }
  }

  const activeMedia = await findActiveMediaSessionForCall(admin, input.organizationId, input.voiceCallId)
  const staleRingStream =
    activeMedia !== null && isStaleRingPhaseMediaSession({ mediaSession: activeMedia, answeredAtMs })

  if (activeMedia && !staleRingStream) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_skipped", {
      ...baseLog,
      reason: "active_media_session_exists",
      mediaSessionId: activeMedia.id,
    })
    return { started: false, reason: "active_media_session_exists" }
  }

  const credentials = readTwilioCredentials()
  if (!credentials) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_skipped", {
      ...baseLog,
      reason: "twilio_credentials_missing",
    })
    return { started: false, reason: "twilio_credentials_missing" }
  }

  const wssUrl = buildVoiceMediaStreamTwilioWssUrl(input.mediaStreamOrigin ?? null)
  if (!wssUrl.trim()) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_skipped", {
      ...baseLog,
      reason: "media_stream_url_missing",
    })
    return { started: false, reason: "media_stream_url_missing" }
  }

  if (activeMedia && staleRingStream) {
    await stopTwilioCallStream({
      accountSid: credentials.accountSid,
      authToken: credentials.authToken,
      providerCallId: input.providerCallId,
      providerStreamSid: activeMedia.providerStreamSid,
    })
    await updateMediaSessionStatus(admin, {
      organizationId: input.organizationId,
      mediaSessionId: activeMedia.id,
      streamStatus: "stopped",
      endedAt: new Date().toISOString(),
      metadataPatch: {
        ...(activeMedia.metadataJson ?? {}),
        stoppedReason: "answered_inbound_stream_restart",
      },
    })
    logVoiceInfrastructure("voice_answered_inbound_media_stream_stale_stopped", {
      ...baseLog,
      mediaSessionId: activeMedia.id,
      providerStreamSid: activeMedia.providerStreamSid,
    })
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
        "Parameter1.Name": "callSid",
        "Parameter1.Value": input.providerCallId,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
        ...baseLog,
        status: response.status,
        message: body.slice(0, 240),
        restartedAfterStaleRingStream: staleRingStream,
      })
      return { started: false, reason: "twilio_stream_create_failed" }
    }

    logVoiceInfrastructure("voice_answered_inbound_media_stream_started", {
      ...baseLog,
      wssUrl,
      restartedAfterStaleRingStream: staleRingStream,
    })
    return { started: true, reason: staleRingStream ? "stream_created_after_stale_restart" : "stream_created" }
  } catch (error) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      ...baseLog,
      message: error instanceof Error ? error.message : String(error),
      restartedAfterStaleRingStream: staleRingStream,
    })
    return { started: false, reason: "twilio_stream_create_failed" }
  }
}

export { isStaleRingPhaseMediaSession } from "@/lib/voice/media-streaming/inbound-media-stream-restart-logic"

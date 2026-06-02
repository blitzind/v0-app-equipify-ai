import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildVoiceMediaStreamTwilioWssUrl,
  describeVoiceMediaStreamWssTarget,
} from "@/lib/voice/call-control/urls"
import {
  findActiveMediaSessionForCall,
  updateMediaSessionStatus,
} from "@/lib/voice/repository/voice-media-streaming-repository"
import { isStaleRingPhaseMediaSession } from "@/lib/voice/media-streaming/inbound-media-stream-restart-logic"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

const TWILIO_STREAM_CREATE_TIMEOUT_MS = 4_000

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
}): Promise<{ ok: boolean; status?: number; message?: string }> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Calls/${encodeURIComponent(input.providerCallId)}/Streams/${encodeURIComponent(input.providerStreamSid)}.json`
  const auth = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64")
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "stopped" }),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      return { ok: false, status: response.status, message: body.slice(0, 240) }
    }
    return { ok: true, status: response.status }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function readTwilioStreamSid(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const sid = (payload as { sid?: unknown }).sid
  return typeof sid === "string" && sid.trim() ? sid.trim() : null
}

async function fetchTwilioStreamCreate(
  endpoint: string,
  init: RequestInit,
): Promise<{ response: Response | null; timedOut: boolean }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TWILIO_STREAM_CREATE_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, { ...init, signal: controller.signal })
    return { response, timedOut: false }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { response: null, timedOut: true }
    }
    if (error instanceof Error && error.name === "AbortError") {
      return { response: null, timedOut: true }
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
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
  const streamTarget = describeVoiceMediaStreamWssTarget(input.mediaStreamOrigin ?? null)
  const wssUrl = buildVoiceMediaStreamTwilioWssUrl(input.mediaStreamOrigin ?? null)
  const baseLog = {
    voiceCallId: input.voiceCallId,
    providerCallId: input.providerCallId,
    wssUrl,
    wssHost: streamTarget.wssHost,
    originSource: streamTarget.originSource,
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

  if (!wssUrl.trim()) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_skipped", {
      ...baseLog,
      reason: "media_stream_url_missing",
    })
    return { started: false, reason: "media_stream_url_missing" }
  }

  if (activeMedia && staleRingStream) {
    const stopResult = await stopTwilioCallStream({
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
      twilioStopOk: stopResult.ok,
      twilioStopStatus: stopResult.status ?? null,
      twilioStopMessage: stopResult.message ?? null,
    })
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Calls/${encodeURIComponent(input.providerCallId)}/Streams.json`
  const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")
  const createStartedAt = Date.now()

  logVoiceInfrastructure("voice_answered_inbound_media_stream_create_requested", {
    ...baseLog,
    restartedAfterStaleRingStream: staleRingStream,
    staleMediaSessionId: activeMedia?.id ?? null,
    twilioEndpointPath: `/Calls/${input.providerCallId}/Streams.json`,
    timeoutMs: TWILIO_STREAM_CREATE_TIMEOUT_MS,
  })

  try {
    const { response, timedOut } = await fetchTwilioStreamCreate(endpoint, {
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
    const durationMs = Date.now() - createStartedAt

    if (timedOut || !response) {
      logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
        ...baseLog,
        durationMs,
        timeoutMs: TWILIO_STREAM_CREATE_TIMEOUT_MS,
        restartedAfterStaleRingStream: staleRingStream,
        stage: "twilio_stream_create",
        reason: "twilio_stream_create_timeout",
      })
      return { started: false, reason: "twilio_stream_create_timeout" }
    }

    const responseBody = await response.text().catch(() => "")
    if (!response.ok) {
      logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
        ...baseLog,
        status: response.status,
        durationMs,
        message: responseBody.slice(0, 240),
        restartedAfterStaleRingStream: staleRingStream,
        stage: "twilio_stream_create",
      })
      return { started: false, reason: "twilio_stream_create_failed" }
    }

    let providerStreamSid: string | null = null
    try {
      providerStreamSid = readTwilioStreamSid(JSON.parse(responseBody))
    } catch {
      providerStreamSid = null
    }

    logVoiceInfrastructure("voice_answered_inbound_media_stream_started", {
      ...baseLog,
      restartedAfterStaleRingStream: staleRingStream,
      providerStreamSid,
      twilioCreateStatus: response.status,
      durationMs,
      dbMediaSessionPendingWebsocketConnect: true,
    })
    return { started: true, reason: staleRingStream ? "stream_created_after_stale_restart" : "stream_created" }
  } catch (error) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      ...baseLog,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - createStartedAt,
      restartedAfterStaleRingStream: staleRingStream,
      stage: "twilio_stream_create",
    })
    return { started: false, reason: "twilio_stream_create_failed" }
  }
}

export { isStaleRingPhaseMediaSession } from "@/lib/voice/media-streaming/inbound-media-stream-restart-logic"

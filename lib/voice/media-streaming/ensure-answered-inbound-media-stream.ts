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
const STREAMABLE_LEG_STATUSES = ["in_progress", "ringing", "queued"] as const

function readTwilioCredentials(): { accountSid: string; authToken: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) return null
  return { accountSid, authToken }
}

type TwilioStreamCallSidResolution = {
  streamCallSid: string
  source: "voice_call_leg" | "voice_call"
  voiceCallProviderCallId: string | null
  legId: string | null
  legType: string | null
  legStatus: string | null
  callStatus: string | null
  callEndedAt: string | null
  webhookAccountSid: string | null
  accountSidMismatch: boolean
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

async function resolveTwilioStreamCallSid(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    fallbackProviderCallId: string
    credentialAccountSid: string
  },
): Promise<TwilioStreamCallSidResolution> {
  const { data: leg } = await admin
    .schema("voice")
    .from("voice_call_legs")
    .select("id, provider_call_sid, leg_type, status, answered_at, created_at")
    .eq("organization_id", input.organizationId)
    .eq("voice_call_id", input.voiceCallId)
    .eq("provider", "twilio")
    .in("status", [...STREAMABLE_LEG_STATUSES])
    .neq("provider_call_sid", "")
    .order("answered_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const { data: callRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("provider_call_id, status, ended_at, metadata_json")
    .eq("id", input.voiceCallId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  const webhookAccountSid =
    readMetadataString(callRow?.metadata_json, "account_sid") ??
    readMetadataString(callRow?.metadata_json, "twilio_account_sid")
  const accountSidMismatch =
    Boolean(webhookAccountSid) && webhookAccountSid !== input.credentialAccountSid

  if (leg?.provider_call_sid) {
    return {
      streamCallSid: String(leg.provider_call_sid),
      source: "voice_call_leg",
      voiceCallProviderCallId: (callRow?.provider_call_id as string | null) ?? input.fallbackProviderCallId,
      legId: String(leg.id),
      legType: (leg.leg_type as string | null) ?? null,
      legStatus: (leg.status as string | null) ?? null,
      callStatus: (callRow?.status as string | null) ?? null,
      callEndedAt: (callRow?.ended_at as string | null) ?? null,
      webhookAccountSid,
      accountSidMismatch,
    }
  }

  return {
    streamCallSid: (callRow?.provider_call_id as string | null) ?? input.fallbackProviderCallId,
    source: "voice_call",
    voiceCallProviderCallId: (callRow?.provider_call_id as string | null) ?? input.fallbackProviderCallId,
    legId: null,
    legType: null,
    legStatus: null,
    callStatus: (callRow?.status as string | null) ?? null,
    callEndedAt: (callRow?.ended_at as string | null) ?? null,
    webhookAccountSid,
    accountSidMismatch,
  }
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

  const resolvedStreamCallSid = await resolveTwilioStreamCallSid(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    fallbackProviderCallId: input.providerCallId,
    credentialAccountSid: credentials.accountSid,
  })
  // Inbound dial `<Start><Stream>` attaches to the parent PSTN call. Post-answer REST
  // stream create/stop must use the same CallSid or Twilio rejects the request.
  const twilioStreamCallSid =
    resolvedStreamCallSid.voiceCallProviderCallId ??
    input.providerCallId ??
    resolvedStreamCallSid.streamCallSid
  const streamLog = {
    ...baseLog,
    providerCallId: twilioStreamCallSid,
    voiceCallProviderCallId: resolvedStreamCallSid.voiceCallProviderCallId,
    providerCallIdSource: "voice_call",
    callLegId: resolvedStreamCallSid.legId,
    callLegType: resolvedStreamCallSid.legType,
    callLegStatus: resolvedStreamCallSid.legStatus,
    voiceCallStatus: resolvedStreamCallSid.callStatus,
    voiceCallEndedAt: resolvedStreamCallSid.callEndedAt,
    webhookAccountSid: resolvedStreamCallSid.webhookAccountSid,
    credentialAccountSid: credentials.accountSid,
    accountSidMismatch: resolvedStreamCallSid.accountSidMismatch,
  }

  logVoiceInfrastructure("voice_answered_inbound_media_stream_call_sid_resolved", streamLog)

  if (resolvedStreamCallSid.callEndedAt) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_skipped", {
      ...streamLog,
      reason: "call_already_ended",
    })
    return { started: false, reason: "call_already_ended" }
  }

  if (resolvedStreamCallSid.accountSidMismatch) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      ...streamLog,
      stage: "twilio_stream_create",
      reason: "twilio_account_sid_mismatch",
    })
    return { started: false, reason: "twilio_account_sid_mismatch" }
  }

  if (activeMedia && staleRingStream) {
    const stopResult = await stopTwilioCallStream({
      accountSid: credentials.accountSid,
      authToken: credentials.authToken,
      providerCallId: twilioStreamCallSid,
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
      ...streamLog,
      mediaSessionId: activeMedia.id,
      providerStreamSid: activeMedia.providerStreamSid,
      twilioStopOk: stopResult.ok,
      twilioStopStatus: stopResult.status ?? null,
      twilioStopMessage: stopResult.message ?? null,
    })
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Calls/${encodeURIComponent(twilioStreamCallSid)}/Streams.json`
  const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")
  const createStartedAt = Date.now()

  logVoiceInfrastructure("voice_answered_inbound_media_stream_create_requested", {
    ...streamLog,
    restartedAfterStaleRingStream: staleRingStream,
    staleMediaSessionId: activeMedia?.id ?? null,
    twilioEndpointPath: `/Calls/${twilioStreamCallSid}/Streams.json`,
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
        "Parameter1.Value": twilioStreamCallSid,
      }),
    })
    const durationMs = Date.now() - createStartedAt

    if (timedOut || !response) {
      logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
        ...streamLog,
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
        ...streamLog,
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
      ...streamLog,
      restartedAfterStaleRingStream: staleRingStream,
      providerStreamSid,
      twilioCreateStatus: response.status,
      durationMs,
      dbMediaSessionPendingWebsocketConnect: true,
    })
    return { started: true, reason: staleRingStream ? "stream_created_after_stale_restart" : "stream_created" }
  } catch (error) {
    logVoiceInfrastructure("voice_answered_inbound_media_stream_failed", {
      ...streamLog,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - createStartedAt,
      restartedAfterStaleRingStream: staleRingStream,
      stage: "twilio_stream_create",
    })
    return { started: false, reason: "twilio_stream_create_failed" }
  }
}

export { isStaleRingPhaseMediaSession } from "@/lib/voice/media-streaming/inbound-media-stream-restart-logic"

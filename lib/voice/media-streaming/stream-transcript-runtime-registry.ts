import "server-only"

import {
  DeepgramTwilioRealtimeBridge,
  type DeepgramTwilioTranscriptEvent,
} from "@/lib/voice/media-streaming/deepgram-twilio-realtime-bridge"
import {
  createInitialVoiceStreamLifecycleSnapshot,
  transitionVoiceStreamLifecycle,
  type VoiceStreamLifecycleSnapshot,
  VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
} from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

const TWILIO_MEDIA_TRACKS = ["inbound", "outbound"] as const
type TwilioMediaTrack = (typeof TWILIO_MEDIA_TRACKS)[number]

type StreamTranscriptRuntimeRecord = {
  mediaSessionId: string
  voiceCallId: string
  organizationId: string
  bridges: Map<TwilioMediaTrack, DeepgramTwilioRealtimeBridge>
  lifecycle: VoiceStreamLifecycleSnapshot
  lastTrack?: string
}

const runtimeByMediaSession = new Map<string, StreamTranscriptRuntimeRecord>()

export function resetStreamTranscriptRuntimeForTests(): void {
  runtimeByMediaSession.clear()
}

function logLifecycleTransition(
  record: StreamTranscriptRuntimeRecord,
  nextState: VoiceStreamLifecycleSnapshot["state"],
  details: Record<string, unknown> = {},
): void {
  record.lifecycle = transitionVoiceStreamLifecycle(record.lifecycle, nextState, {
    mediaSessionId: record.mediaSessionId,
    callSid: record.lifecycle.callSid,
    streamSid: record.lifecycle.streamSid,
    transcriptSessionId: record.lifecycle.transcriptSessionId,
  })
  logVoiceInfrastructure("voice_stream_lifecycle_transition", {
    qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    state: record.lifecycle.state,
    mediaSessionId: record.mediaSessionId,
    voiceCallId: record.voiceCallId,
    callSid: record.lifecycle.callSid,
    streamSid: record.lifecycle.streamSid,
    ...details,
  })
}

async function createTrackBridge(input: {
  mediaSessionId: string
  voiceCallId: string
  track: TwilioMediaTrack
  onFinalTranscript: (event: DeepgramTwilioTranscriptEvent, track?: string) => Promise<void>
  onInterimTranscript?: (event: DeepgramTwilioTranscriptEvent, track?: string) => Promise<void>
  onLifecycle: (record: StreamTranscriptRuntimeRecord, event: DeepgramTwilioTranscriptEvent) => void
  record: StreamTranscriptRuntimeRecord
}): Promise<DeepgramTwilioRealtimeBridge> {
  const bridge = new DeepgramTwilioRealtimeBridge({
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    fixedTrack: input.track,
    onTranscript: async (event) => {
      input.onLifecycle(input.record, event)
      await input.onFinalTranscript(event, input.track)
    },
    onInterim: async (event) => {
      await input.onInterimTranscript?.(event, input.track)
    },
    onError: (message) => {
      logLifecycleTransition(input.record, "failed", { message, track: input.track })
      logVoiceInfrastructure("voice_transcript_failed", {
        qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        mediaSessionId: input.mediaSessionId,
        track: input.track,
        message,
      })
    },
    onStateChange: (state) => {
      if (state === "open") {
        logLifecycleTransition(input.record, "transcribing", { track: input.track })
        logVoiceInfrastructure("voice_transcript_started", {
          qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
          mediaSessionId: input.mediaSessionId,
          voiceCallId: input.voiceCallId,
          track: input.track,
        })
      }
      if (state === "failed") {
        logLifecycleTransition(input.record, "failed", { track: input.track })
      }
    },
  })

  await bridge.connect()
  return bridge
}

export async function startStreamTranscriptRuntime(input: {
  organizationId: string
  mediaSessionId: string
  voiceCallId: string
  transcriptSessionId: string | null
  callSid?: string | null
  streamSid?: string | null
  onFinalTranscript: (event: DeepgramTwilioTranscriptEvent, track?: string) => Promise<void>
  onInterimTranscript?: (event: DeepgramTwilioTranscriptEvent, track?: string) => Promise<void>
}): Promise<{ ok: boolean; message: string }> {
  const existing = runtimeByMediaSession.get(input.mediaSessionId)
  if (existing && [...existing.bridges.values()].some((bridge) => bridge.isOpen)) {
    return { ok: true, message: "Stream transcript runtime already active." }
  }

  const lifecycle = createInitialVoiceStreamLifecycleSnapshot({ callSid: input.callSid ?? null })
  lifecycle.mediaSessionId = input.mediaSessionId
  lifecycle.transcriptSessionId = input.transcriptSessionId
  lifecycle.streamSid = input.streamSid ?? null

  const record: StreamTranscriptRuntimeRecord = {
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    organizationId: input.organizationId,
    bridges: new Map(),
    lifecycle: transitionVoiceStreamLifecycle(lifecycle, "streaming", {
      streamSid: input.streamSid ?? null,
      mediaSessionId: input.mediaSessionId,
      transcriptSessionId: input.transcriptSessionId,
    }),
  }
  runtimeByMediaSession.set(input.mediaSessionId, record)
  logLifecycleTransition(record, "connected", { streamSid: input.streamSid ?? null })

  try {
    for (const track of TWILIO_MEDIA_TRACKS) {
      const bridge = await createTrackBridge({
        mediaSessionId: input.mediaSessionId,
        voiceCallId: input.voiceCallId,
        track,
        onFinalTranscript: input.onFinalTranscript,
        onInterimTranscript: input.onInterimTranscript,
        record,
        onLifecycle: (runtimeRecord, event) => {
          logLifecycleTransition(runtimeRecord, "transcribing", {
            latencyMs: event.latencyMs,
            transcriptLength: event.normalized.transcriptText.length,
            track,
          })
          runtimeRecord.lifecycle.transcriptReady = true
          runtimeRecord.lifecycle.latencyMs = event.latencyMs
        },
      })
      record.bridges.set(track, bridge)
    }
    return { ok: true, message: "Deepgram stream transcript runtime started." }
  } catch (error) {
    for (const bridge of record.bridges.values()) {
      await bridge.close("startup_failed").catch(() => undefined)
    }
    runtimeByMediaSession.delete(input.mediaSessionId)
    const message = error instanceof Error ? error.message : "deepgram_connect_failed"
    logVoiceInfrastructure("voice_transcript_failed", {
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      mediaSessionId: input.mediaSessionId,
      message,
    })
    return { ok: false, message }
  }
}

function resolveTrackBridge(
  record: StreamTranscriptRuntimeRecord,
  track?: string,
): DeepgramTwilioRealtimeBridge | null {
  if (track === "inbound" || track === "outbound") {
    return record.bridges.get(track) ?? null
  }
  return record.bridges.get("inbound") ?? record.bridges.get("outbound") ?? null
}

export function ingestStreamTranscriptAudio(input: {
  mediaSessionId: string
  payload: string
  track?: string
}): boolean {
  const record = runtimeByMediaSession.get(input.mediaSessionId)
  if (!record) return false
  record.lastTrack = input.track
  const bridge = resolveTrackBridge(record, input.track)
  if (!bridge) return false
  bridge.sendMulawPayload(input.payload, input.track)
  if (record.lifecycle.state === "connected") {
    logLifecycleTransition(record, "streaming", { track: input.track ?? null })
  }
  return true
}

export async function stopStreamTranscriptRuntime(input: {
  mediaSessionId: string
  reason?: string
}): Promise<void> {
  const record = runtimeByMediaSession.get(input.mediaSessionId)
  if (!record) return

  logLifecycleTransition(record, "disconnecting", { reason: input.reason ?? "stream_stop" })
  for (const bridge of record.bridges.values()) {
    await bridge.close(input.reason ?? "stream_stop").catch(() => undefined)
  }
  logLifecycleTransition(record, "completed", { reason: input.reason ?? "stream_stop" })
  runtimeByMediaSession.delete(input.mediaSessionId)

  logVoiceInfrastructure("voice_stream_disconnected", {
    qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    mediaSessionId: input.mediaSessionId,
    voiceCallId: record.voiceCallId,
    reason: input.reason ?? "stream_stop",
  })
}

export function getStreamTranscriptLifecycle(
  mediaSessionId: string,
): VoiceStreamLifecycleSnapshot | null {
  return runtimeByMediaSession.get(mediaSessionId)?.lifecycle ?? null
}

export function getActiveStreamTranscriptRuntimeCount(): number {
  return runtimeByMediaSession.size
}

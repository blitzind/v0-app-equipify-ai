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

type StreamTranscriptRuntimeRecord = {
  mediaSessionId: string
  voiceCallId: string
  organizationId: string
  bridge: DeepgramTwilioRealtimeBridge
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
  if (existing?.bridge.isOpen) {
    return { ok: true, message: "Stream transcript runtime already active." }
  }

  const lifecycle = createInitialVoiceStreamLifecycleSnapshot({ callSid: input.callSid ?? null })
  lifecycle.mediaSessionId = input.mediaSessionId
  lifecycle.transcriptSessionId = input.transcriptSessionId
  lifecycle.streamSid = input.streamSid ?? null

  const bridge = new DeepgramTwilioRealtimeBridge({
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    onTranscript: async (event) => {
      const record = runtimeByMediaSession.get(input.mediaSessionId)
      if (record) {
        logLifecycleTransition(record, "transcribing", {
          latencyMs: event.latencyMs,
          transcriptLength: event.normalized.transcriptText.length,
        })
        record.lifecycle.transcriptReady = true
        record.lifecycle.latencyMs = event.latencyMs
      }
      await input.onFinalTranscript(event, record?.lastTrack)
    },
    onInterim: async (event) => {
      await input.onInterimTranscript?.(event, runtimeByMediaSession.get(input.mediaSessionId)?.lastTrack)
    },
    onError: (message) => {
      const record = runtimeByMediaSession.get(input.mediaSessionId)
      if (record) {
        logLifecycleTransition(record, "failed", { message })
      }
      logVoiceInfrastructure("voice_transcript_failed", {
        qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        mediaSessionId: input.mediaSessionId,
        message,
      })
    },
    onStateChange: (state) => {
      const record = runtimeByMediaSession.get(input.mediaSessionId)
      if (!record) return
      if (state === "open") {
        logLifecycleTransition(record, "transcribing")
        logVoiceInfrastructure("voice_transcript_started", {
          qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
          mediaSessionId: input.mediaSessionId,
          voiceCallId: input.voiceCallId,
        })
      }
      if (state === "failed") {
        logLifecycleTransition(record, "failed")
      }
    },
  })

  const record: StreamTranscriptRuntimeRecord = {
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    organizationId: input.organizationId,
    bridge,
    lifecycle: transitionVoiceStreamLifecycle(lifecycle, "streaming", {
      streamSid: input.streamSid ?? null,
      mediaSessionId: input.mediaSessionId,
      transcriptSessionId: input.transcriptSessionId,
    }),
  }
  runtimeByMediaSession.set(input.mediaSessionId, record)
  logLifecycleTransition(record, "connected", { streamSid: input.streamSid ?? null })

  try {
    await bridge.connect()
    return { ok: true, message: "Deepgram stream transcript runtime started." }
  } catch (error) {
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

export function ingestStreamTranscriptAudio(input: {
  mediaSessionId: string
  payload: string
  track?: string
}): boolean {
  const record = runtimeByMediaSession.get(input.mediaSessionId)
  if (!record) return false
  record.lastTrack = input.track
  record.bridge.sendMulawPayload(input.payload, input.track)
  if (record.lifecycle.state === "connected") {
    logLifecycleTransition(record, "streaming")
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
  await record.bridge.close(input.reason ?? "stream_stop")
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

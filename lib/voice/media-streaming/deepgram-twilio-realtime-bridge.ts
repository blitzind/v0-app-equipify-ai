import "server-only"

import type { VoiceSpeakerType } from "@/lib/voice/media-streaming/types"
import type { NormalizedTranscriptEvent } from "@/lib/voice/transcripts/providers/types"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

const DEEPGRAM_LIVE_URL = "wss://api.deepgram.com/v1/listen"

type DeepgramLiveMessage = {
  type?: string
  channel?: {
    alternatives?: Array<{
      transcript?: string
      confidence?: number
    }>
  }
  is_final?: boolean
  speech_final?: boolean
  start?: number
  duration?: number
}

export type DeepgramTwilioTranscriptEvent = {
  normalized: NormalizedTranscriptEvent
  latencyMs: number | null
}

export type DeepgramTwilioRealtimeBridgeOptions = {
  mediaSessionId: string
  voiceCallId: string
  /** When set, transcript events always use this Twilio track for speaker attribution. */
  fixedTrack?: "inbound" | "outbound"
  onTranscript: (event: DeepgramTwilioTranscriptEvent) => void | Promise<void>
  onInterim?: (event: DeepgramTwilioTranscriptEvent) => void | Promise<void>
  onError?: (message: string) => void
  onStateChange?: (state: "connecting" | "open" | "closed" | "failed") => void
}

function mapTwilioTrackToSpeaker(track?: string): {
  speakerIdentity: string
  speakerType: VoiceSpeakerType
} {
  if (track === "inbound") return { speakerIdentity: "caller", speakerType: "customer" }
  if (track === "outbound") return { speakerIdentity: "operator", speakerType: "operator" }
  return { speakerIdentity: "unknown", speakerType: "unknown" }
}

function resolveDeepgramApiKey(): string | null {
  return process.env.DEEPGRAM_API_KEY?.trim() || null
}

function resolveDeepgramModel(): string {
  return "nova-2"
}

function buildDeepgramTwilioListenUrl(): string {
  const params = new URLSearchParams({
    model: resolveDeepgramModel(),
    language: "en-US",
    encoding: "mulaw",
    sample_rate: "8000",
    channels: "1",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true",
  })
  return `${DEEPGRAM_LIVE_URL}?${params.toString()}`
}

function normalizeDeepgramMessage(
  raw: string,
  input: { track?: string; openedAt: number | null },
): DeepgramTwilioTranscriptEvent | null {
  let parsed: DeepgramLiveMessage
  try {
    parsed = JSON.parse(raw) as DeepgramLiveMessage
  } catch {
    return null
  }

  if (
    parsed.type === "Metadata" ||
    parsed.type === "SpeechStarted" ||
    parsed.type === "UtteranceEnd"
  ) {
    return null
  }

  const alternative = parsed.channel?.alternatives?.[0]
  const transcript = alternative?.transcript?.trim() ?? ""
  if (!transcript) return null

  const isFinal = Boolean(parsed.is_final || parsed.speech_final)
  const speaker = mapTwilioTrackToSpeaker(input.track)
  const confidenceRaw = alternative?.confidence
  const confidence =
    typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw) ? confidenceRaw : null
  const startedAt =
    typeof parsed.start === "number"
      ? new Date(Date.now() - Math.max(0, (parsed.duration ?? 0) * 1000)).toISOString()
      : null
  const endedAt = isFinal ? new Date().toISOString() : null
  const latencyMs =
    input.openedAt != null && typeof parsed.start === "number"
      ? Math.max(0, Math.round(Date.now() - input.openedAt - parsed.start * 1000))
      : null

  return {
    latencyMs,
    normalized: {
      speakerIdentity: speaker.speakerIdentity,
      speakerType: speaker.speakerType,
      transcriptText: transcript,
      confidenceScore: confidence,
      startedAt,
      endedAt,
      isFinal,
      metadata: {
        provider: "deepgram",
        qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        track: input.track ?? null,
      },
    },
  }
}

export class DeepgramTwilioRealtimeBridge {
  private ws: WebSocket | null = null
  private openedAt: number | null = null
  private activeTrack: string | undefined
  private reconnectAttempts = 0
  private closed = false

  constructor(private readonly options: DeepgramTwilioRealtimeBridgeOptions) {}

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async connect(): Promise<void> {
    if (this.closed || this.isOpen) return

    const apiKey = resolveDeepgramApiKey()
    if (!apiKey) {
      this.options.onError?.("DEEPGRAM_API_KEY is not configured.")
      this.options.onStateChange?.("failed")
      return
    }

    this.options.onStateChange?.("connecting")
    const url = buildDeepgramTwilioListenUrl()
    this.openedAt = Date.now()

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      })
      this.ws = ws

      ws.addEventListener("open", () => {
        this.reconnectAttempts = 0
        this.options.onStateChange?.("open")
        logVoiceInfrastructure("voice_deepgram_stream_open", {
          qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
          mediaSessionId: this.options.mediaSessionId,
          voiceCallId: this.options.voiceCallId,
        })
        resolve()
      })

      ws.addEventListener("message", (event) => {
        void this.handleMessage(String(event.data ?? ""))
      })

      ws.addEventListener("error", () => {
        this.options.onError?.("Deepgram websocket error.")
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error("deepgram_connect_failed"))
        }
      })

      ws.addEventListener("close", () => {
        this.ws = null
        this.options.onStateChange?.("closed")
        if (!this.closed && this.reconnectAttempts < 2) {
          this.reconnectAttempts += 1
          logVoiceInfrastructure("voice_deepgram_stream_reconnect", {
            qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
            mediaSessionId: this.options.mediaSessionId,
            attempt: this.reconnectAttempts,
          })
          void this.connect().catch(() => {
            this.options.onStateChange?.("failed")
          })
        }
      })
    })
  }

  sendMulawPayload(base64Payload: string, track?: string): void {
    if (!base64Payload || this.closed) return
    if (track) this.activeTrack = track
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    try {
      const audio = Buffer.from(base64Payload, "base64")
      this.ws.send(audio)
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error.message : "audio_send_failed")
    }
  }

  async close(reason = "stream_stopped"): Promise<void> {
    this.closed = true
    const ws = this.ws
    if (!ws) return

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "CloseStream" }))
      } catch {
        // Best-effort close — never log raw audio.
      }
    }

    ws.close()
    this.ws = null
    this.openedAt = null
    logVoiceInfrastructure("voice_deepgram_stream_closed", {
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      mediaSessionId: this.options.mediaSessionId,
      reason,
    })
  }

  private resolveAttributionTrack(): string | undefined {
    return this.options.fixedTrack ?? this.activeTrack
  }

  private async handleMessage(raw: string): Promise<void> {
    const event = normalizeDeepgramMessage(raw, {
      track: this.resolveAttributionTrack(),
      openedAt: this.openedAt,
    })
    if (!event) return

    if (event.normalized.isFinal) {
      await this.options.onTranscript(event)
      return
    }

    await this.options.onInterim?.(event)
  }
}

export function isDeepgramTwilioStreamingConfigured(): boolean {
  return Boolean(resolveDeepgramApiKey())
}

import { hasRealtimeProviderCredential } from "@/lib/growth/realtime/providers/base-provider"
import type { RealtimeProviderRuntimeConfig } from "@/lib/growth/realtime/providers/provider-types"

const OPENAI_REALTIME_WS_BASE_URL = "wss://api.openai.com/v1/realtime"
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-realtime-whisper"

export function resolveOpenAiRealtimeApiKey(config: RealtimeProviderRuntimeConfig): string | null {
  if (!hasRealtimeProviderCredential(config, "OPENAI_API_KEY")) return null
  const fromConfig = config.credentials?.apiKey
  if (fromConfig && String(fromConfig).trim()) return String(fromConfig).trim()
  const fromEnv = process.env.OPENAI_API_KEY?.trim()
  return fromEnv || null
}

export function resolveOpenAiRealtimeTranscriptionModel(config: RealtimeProviderRuntimeConfig): string {
  return config.configJson.model?.trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL
}

export function buildOpenAiRealtimeListenUrl(config: RealtimeProviderRuntimeConfig): string {
  const model = resolveOpenAiRealtimeTranscriptionModel(config)
  return `${OPENAI_REALTIME_WS_BASE_URL}?model=${encodeURIComponent(model)}`
}

export function buildOpenAiTranscriptionSessionUpdate(config: RealtimeProviderRuntimeConfig): {
  type: "session.update"
  session: {
    type: "transcription"
    audio: {
      input: {
        format: { type: "audio/pcm"; rate: number }
        transcription: { model: string; language: string }
      }
    }
  }
} {
  const model = resolveOpenAiRealtimeTranscriptionModel(config)
  return {
    type: "session.update",
    session: {
      type: "transcription",
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          transcription: {
            model,
            language: "en",
          },
        },
      },
    },
  }
}

export function isOpenAiBrowserAudioEncodingSupported(encoding: string): boolean {
  const normalized = encoding.toLowerCase()
  return (
    normalized.includes("webm") ||
    normalized.includes("opus") ||
    normalized.includes("pcm") ||
    normalized.includes("wav")
  )
}

export function isOpenAiRealtimeTranscriptionModelSupported(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  return (
    normalized.includes("whisper") ||
    normalized.includes("transcribe") ||
    normalized.includes("gpt-realtime-whisper")
  )
}

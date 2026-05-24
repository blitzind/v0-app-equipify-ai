import { hasRealtimeProviderCredential } from "@/lib/growth/realtime/providers/base-provider"
import type { RealtimeProviderRuntimeConfig } from "@/lib/growth/realtime/providers/provider-types"

const ASSEMBLYAI_LIVE_URL = "wss://streaming.assemblyai.com/v3/ws"
const ASSEMBLYAI_LIVE_EU_URL = "wss://streaming.eu.assemblyai.com/v3/ws"

export function resolveAssemblyAiApiKey(config: RealtimeProviderRuntimeConfig): string | null {
  if (!hasRealtimeProviderCredential(config, "ASSEMBLYAI_API_KEY")) return null
  const fromConfig = config.credentials?.apiKey
  if (fromConfig && String(fromConfig).trim()) return String(fromConfig).trim()
  const fromEnv = process.env.ASSEMBLYAI_API_KEY?.trim()
  return fromEnv || null
}

export function buildAssemblyAiListenUrl(config: RealtimeProviderRuntimeConfig): string {
  const params = new URLSearchParams({
    speech_model: config.configJson.model?.trim() || "universal-streaming-english",
    sample_rate: resolveAssemblyAiSampleRate(config),
    format_turns: "true",
  })

  const baseUrl =
    config.configJson.region?.trim().toLowerCase() === "eu" ? ASSEMBLYAI_LIVE_EU_URL : ASSEMBLYAI_LIVE_URL

  return `${baseUrl}?${params.toString()}`
}

export function isAssemblyAiBrowserAudioEncodingSupported(encoding: string): boolean {
  const normalized = encoding.toLowerCase()
  return (
    normalized.includes("webm") ||
    normalized.includes("opus") ||
    normalized.includes("pcm") ||
    normalized.includes("wav")
  )
}

function resolveAssemblyAiSampleRate(config: RealtimeProviderRuntimeConfig): string {
  const fromNotes = config.configJson.notes?.match(/sample_rate=(\d+)/i)?.[1]
  if (fromNotes) return fromNotes
  return "48000"
}

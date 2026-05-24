import type {
  RealtimeProviderHealth,
  RealtimeProviderRuntimeConfig,
  RealtimeTranscriptChunk,
  RealtimeTranscriptProvider,
} from "@/lib/growth/realtime/providers/provider-types"

export function hasRealtimeProviderCredential(
  config: RealtimeProviderRuntimeConfig,
  envKey: string,
): boolean {
  if (config.credentials?.apiKey && String(config.credentials.apiKey).trim()) return true
  return Boolean(process.env[envKey]?.trim())
}

export abstract class BaseRealtimeTranscriptProvider implements RealtimeTranscriptProvider {
  abstract readonly providerId: RealtimeTranscriptProvider["providerId"]
  protected runtimeConfig: RealtimeProviderRuntimeConfig | null = null
  protected connectedSessionId: string | null = null

  abstract supportsRealtime(): boolean
  abstract supportsSpeakerDetection(): boolean
  abstract supportsKeywordEvents(): boolean
  supportsBrowserAudioStreaming(): boolean {
    return false
  }
  supportsLiveTranscriptStreaming(): boolean {
    return this.supportsBrowserAudioStreaming()
  }
  supportsLiveGuidanceCompatible(): boolean {
    return this.supportsRealtime()
  }
  protected abstract credentialEnvKey(): string
  protected abstract providerLabel(): string

  async connect(sessionId: string, config: RealtimeProviderRuntimeConfig): Promise<void> {
    this.runtimeConfig = config
    this.connectedSessionId = sessionId
  }

  async disconnect(): Promise<void> {
    this.connectedSessionId = null
  }

  async health(config: RealtimeProviderRuntimeConfig): Promise<RealtimeProviderHealth> {
    const hasKey = hasRealtimeProviderCredential(config, this.credentialEnvKey())
    const started = Date.now()
    const latencyMs = Date.now() - started
    return {
      ok: hasKey,
      providerId: this.providerId,
      mode: hasKey ? "live" : "stub",
      message: hasKey
        ? `${this.providerLabel()} credentials available.`
        : `${this.providerLabel()} credentials missing — manual/stub fallback.`,
      latencyMs,
      capabilities: {
        realtime: this.supportsRealtime(),
        speakerDetection: this.supportsSpeakerDetection(),
        keywordEvents: this.supportsKeywordEvents(),
        browserAudioStreaming: this.supportsBrowserAudioStreaming(),
        liveTranscriptStreaming: this.supportsLiveTranscriptStreaming(),
        liveGuidanceCompatible: this.supportsLiveGuidanceCompatible(),
        latencyMs,
      },
    }
  }

  async stream(onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<() => void> {
    if (!this.runtimeConfig || !hasRealtimeProviderCredential(this.runtimeConfig, this.credentialEnvKey())) {
      return () => undefined
    }
    return this.streamLive(onChunk)
  }

  protected async streamLive(_onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<() => void> {
    return () => undefined
  }

  protected matchKeywords(content: string): string[] {
    const keywords = [
      ...(this.runtimeConfig?.customKeywords ?? []),
      ...(this.runtimeConfig?.configJson.customKeywords ?? []),
    ]
    const normalized = content.toLowerCase()
    return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
  }
}

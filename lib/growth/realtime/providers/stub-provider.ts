import type {
  RealtimeProviderHealth,
  RealtimeProviderRuntimeConfig,
  RealtimeTranscriptChunk,
  RealtimeTranscriptProvider,
} from "@/lib/growth/realtime/providers/provider-types"

export class StubRealtimeTranscriptProvider implements RealtimeTranscriptProvider {
  readonly providerId = "stub" as const

  async connect(_sessionId: string, _config: RealtimeProviderRuntimeConfig): Promise<void> {
    return
  }

  async disconnect(): Promise<void> {
    return
  }

  async health(_config: RealtimeProviderRuntimeConfig): Promise<RealtimeProviderHealth> {
    return {
      ok: true,
      providerId: this.providerId,
      mode: "stub",
      message: "Stub provider ready — no live audio ingestion.",
      capabilities: {
        realtime: false,
        speakerDetection: false,
        keywordEvents: false,
        latencyMs: 0,
      },
    }
  }

  async stream(_onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<() => void> {
    return () => undefined
  }

  supportsRealtime(): boolean {
    return false
  }

  supportsSpeakerDetection(): boolean {
    return false
  }

  supportsKeywordEvents(): boolean {
    return false
  }
}

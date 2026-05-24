import type { RealtimeTranscriptChunk, RealtimeTranscriptProviderHealth } from "@/lib/growth/realtime/realtime-transcript-provider-types"

export type RealtimeTranscriptProvider = {
  readonly providerId: string
  connect(sessionId: string): Promise<void>
  disconnect(): Promise<void>
  stream(onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<() => void>
  health(): Promise<RealtimeTranscriptProviderHealth>
}

export class StubRealtimeTranscriptProvider implements RealtimeTranscriptProvider {
  readonly providerId = "stub"

  async connect(_sessionId: string): Promise<void> {
    return
  }

  async disconnect(): Promise<void> {
    return
  }

  async stream(_onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<() => void> {
    return () => undefined
  }

  async health(): Promise<RealtimeTranscriptProviderHealth> {
    return {
      ok: true,
      providerId: this.providerId,
      mode: "stub",
      message: "Stub provider ready — no live audio ingestion.",
    }
  }
}

export const REALTIME_TRANSCRIPT_PROVIDER_IDS = ["stub", "deepgram", "assemblyai", "openai_realtime", "custom"] as const

export function createRealtimeTranscriptProvider(providerId: string): RealtimeTranscriptProvider {
  if (providerId === "stub" || !REALTIME_TRANSCRIPT_PROVIDER_IDS.includes(providerId as (typeof REALTIME_TRANSCRIPT_PROVIDER_IDS)[number])) {
    return new StubRealtimeTranscriptProvider()
  }
  return new StubRealtimeTranscriptProvider()
}

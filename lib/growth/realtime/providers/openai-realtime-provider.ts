import { BaseRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/base-provider"

export class OpenAiRealtimeTranscriptProvider extends BaseRealtimeTranscriptProvider {
  readonly providerId = "openai_realtime" as const

  supportsRealtime(): boolean {
    return true
  }

  supportsSpeakerDetection(): boolean {
    return false
  }

  supportsKeywordEvents(): boolean {
    return true
  }

  protected credentialEnvKey(): string {
    return "OPENAI_API_KEY"
  }

  protected providerLabel(): string {
    return "OpenAI Realtime"
  }
}

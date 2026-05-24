import { BaseRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/base-provider"

export class DeepgramRealtimeTranscriptProvider extends BaseRealtimeTranscriptProvider {
  readonly providerId = "deepgram" as const

  supportsRealtime(): boolean {
    return true
  }

  supportsSpeakerDetection(): boolean {
    return true
  }

  supportsKeywordEvents(): boolean {
    return true
  }

  protected credentialEnvKey(): string {
    return "DEEPGRAM_API_KEY"
  }

  protected providerLabel(): string {
    return "Deepgram"
  }
}

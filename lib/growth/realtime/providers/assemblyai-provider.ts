import { BaseRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/base-provider"

export class AssemblyAiRealtimeTranscriptProvider extends BaseRealtimeTranscriptProvider {
  readonly providerId = "assemblyai" as const

  supportsRealtime(): boolean {
    return true
  }

  supportsSpeakerDetection(): boolean {
    return true
  }

  supportsKeywordEvents(): boolean {
    return false
  }

  protected credentialEnvKey(): string {
    return "ASSEMBLYAI_API_KEY"
  }

  protected providerLabel(): string {
    return "AssemblyAI"
  }
}

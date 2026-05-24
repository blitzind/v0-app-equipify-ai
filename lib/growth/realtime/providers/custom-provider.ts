import {
  BaseRealtimeTranscriptProvider,
  hasRealtimeProviderCredential,
} from "@/lib/growth/realtime/providers/base-provider"
import type {
  RealtimeProviderHealth,
  RealtimeProviderRuntimeConfig,
} from "@/lib/growth/realtime/providers/provider-types"

export class CustomRealtimeTranscriptProvider extends BaseRealtimeTranscriptProvider {
  readonly providerId = "custom" as const

  supportsRealtime(): boolean {
    return true
  }

  supportsSpeakerDetection(): boolean {
    return Boolean(this.runtimeConfig?.speakerSeparationEnabled)
  }

  supportsKeywordEvents(): boolean {
    return Boolean(this.runtimeConfig?.keywordEventsEnabled)
  }

  protected credentialEnvKey(): string {
    return "GROWTH_REALTIME_CUSTOM_API_KEY"
  }

  protected providerLabel(): string {
    return "Custom websocket provider"
  }

  async health(config: RealtimeProviderRuntimeConfig): Promise<RealtimeProviderHealth> {
    const hasEndpoint = Boolean(config.configJson.endpoint?.trim())
    const hasKey = hasRealtimeProviderCredential(config, this.credentialEnvKey())
    return {
      ok: hasEndpoint && hasKey,
      providerId: this.providerId,
      mode: hasEndpoint && hasKey ? "live" : "stub",
      message:
        hasEndpoint && hasKey
          ? "Custom provider endpoint configured."
          : "Custom provider requires endpoint + credentials.",
      capabilities: {
        realtime: true,
        speakerDetection: config.speakerSeparationEnabled,
        keywordEvents: config.keywordEventsEnabled,
        latencyMs: 0,
      },
    }
  }
}

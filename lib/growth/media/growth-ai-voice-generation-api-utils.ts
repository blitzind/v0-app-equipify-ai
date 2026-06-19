import "server-only"

import { getGrowthElevenLabsVoiceProviderState } from "@/lib/growth/media/growth-ai-voice-provider-config"

export function growthAiVoiceSafetyJson(extra: Record<string, unknown> = {}) {
  const providerState = getGrowthElevenLabsVoiceProviderState()
  return {
    ...extra,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    provider_execution_enabled: providerState.enabled,
    provider_state: providerState,
    outreach_execution: false,
    enrollment_execution: false,
  }
}
